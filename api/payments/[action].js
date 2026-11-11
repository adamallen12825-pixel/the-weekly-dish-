// Subscription endpoints (Square).
//
//   POST /api/payments/create-subscription   { sourceId }   start a subscription
//   GET  /api/payments/status                               access + subscription state
//   POST /api/payments/cancel                               cancel at period end
//   POST /api/payments/webhook                              Square notifications
//
// Security: the user id and email come from the verified Clerk token, never
// from the request body, and the plan and price come from server environment
// variables. Idempotency keys are derived from the user and payment token, and
// Square is checked for an existing subscription first, so a double click or a
// retry can never bill someone twice.
//
// NOTE: test the full flow in the Square sandbox before taking real payments.
// SQUARE_ENVIRONMENT must be "production" (with production credentials) to
// charge real cards.

const { createClerkClient } = require('@clerk/backend');
const { applyCors, requireAuth } = require('../_lib/auth');
const { getSquareClient, idempotencyKey } = require('../_lib/square');
const { createLogger, errFields } = require('../_lib/log');
const rateLimit = require('../_lib/rateLimit');
const entitlement = require('../_lib/entitlement');
const subscriptions = require('../_lib/subscriptions');

const LIVE = new Set(['ACTIVE', 'PENDING']);

function publicView(access, record) {
  return {
    enforced: access.enforced,
    allowed: access.allowed,
    reason: access.reason,
    trialEndsAt: access.trialEndsAt || null,
    subscription: record
      ? {
          status: record.status,
          active: entitlement.isActive(record),
          paidThrough: record.paidThrough,
          endsOn: record.canceledDate,
        }
      : null,
  };
}

async function createSubscription(req, res, log) {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const square = getSquareClient();
  if (!square || !process.env.SQUARE_LOCATION_ID || !process.env.SQUARE_SUBSCRIPTION_PLAN_ID) {
    log.error('Square not fully configured', { userId });
    return res.status(500).json({ success: false, error: 'Payment system not configured', reqId: log.reqId });
  }
  if (await rateLimit.enforce(req, res, { bucket: 'pay:create', id: userId, max: 6, windowSeconds: 3600 })) return;

  const sourceId = typeof (req.body || {}).sourceId === 'string' ? req.body.sourceId : '';
  if (!sourceId || sourceId.length > 512) {
    return res.status(400).json({ success: false, error: 'Missing payment token', reqId: log.reqId });
  }

  try {
    // Already subscribed according to our records? Confirm with Square.
    const existing = await entitlement.getSubscription(userId);
    if (existing && existing.subscriptionId) {
      const current = await subscriptions.refresh(userId);
      if (current && LIVE.has(current.status) && !current.canceledDate) {
        return res.status(200).json({ success: true, alreadySubscribed: true, status: current.status });
      }
    }

    // Verified email from Clerk (not from the request body).
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(userId);
    const primary =
      (clerkUser.emailAddresses || []).find((e) => e.id === clerkUser.primaryEmailAddressId) ||
      (clerkUser.emailAddresses || [])[0];
    const email = primary && primary.emailAddress;
    if (!email) {
      return res.status(400).json({ success: false, error: 'No email on account', reqId: log.reqId });
    }

    // Find or create the Square customer for this Clerk user.
    const search = await square.customers.search({
      query: { filter: { emailAddress: { exact: email } } },
    });
    const candidates = search.customers || [];
    let customer = candidates.find((c) => c.referenceId === userId) || candidates[0];
    if (!customer) {
      const created = await square.customers.create({
        idempotencyKey: idempotencyKey(userId, 'customer'),
        givenName: clerkUser.firstName || email.split('@')[0],
        familyName: clerkUser.lastName || undefined,
        emailAddress: email,
        referenceId: userId,
      });
      customer = created.customer;
    }

    // Square may already hold a live subscription we have no record of.
    const found = await square.subscriptions.search({
      query: { filter: { customerIds: [customer.id], locationIds: [process.env.SQUARE_LOCATION_ID] } },
    });
    const live = (found.subscriptions || []).find((s) => LIVE.has(s.status) && !s.canceledDate);
    if (live) {
      const record = await subscriptions.save(userId, live);
      log.info('existing subscription adopted', { userId, subscriptionId: record.subscriptionId });
      return res.status(200).json({ success: true, alreadySubscribed: true, status: record.status });
    }

    const cardResult = await square.cards.create({
      idempotencyKey: idempotencyKey(userId, 'card', sourceId),
      sourceId,
      card: { customerId: customer.id },
    });

    const result = await square.subscriptions.create({
      idempotencyKey: idempotencyKey(userId, 'sub', sourceId),
      locationId: process.env.SQUARE_LOCATION_ID,
      planVariationId: process.env.SQUARE_SUBSCRIPTION_PLAN_ID,
      customerId: customer.id,
      cardId: cardResult.card.id,
      timezone: process.env.SQUARE_TIMEZONE || 'America/Chicago',
    });

    const record = await subscriptions.save(userId, result.subscription);
    log.info('subscription created', { userId, subscriptionId: record.subscriptionId, status: record.status });
    return res.status(200).json({ success: true, status: record.status });
  } catch (error) {
    // Square SDK errors carry an .errors array with category/code/detail.
    const squareErrors = Array.isArray(error?.errors)
      ? error.errors.map((e) => ({ category: e.category, code: e.code, detail: e.detail }))
      : undefined;
    log.error('create subscription failed', { userId, ...errFields(error), squareErrors });
    const declined = squareErrors && squareErrors.some((e) => e.category === 'PAYMENT_METHOD_ERROR');
    return res.status(declined ? 402 : 500).json({
      success: false,
      error: declined
        ? 'Your card was declined. Please check the details or try another card.'
        : 'We could not start your subscription. Please try again.',
      reqId: log.reqId,
    });
  }
}

async function status(req, res, log) {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  try {
    const access = await entitlement.check(userId);
    const record = access.subscription !== undefined ? access.subscription : await entitlement.getSubscription(userId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(publicView(access, record));
  } catch (error) {
    log.error('status failed', { userId, ...errFields(error) });
    return res.status(error.status || 500).json({ error: 'Could not load subscription status', reqId: log.reqId });
  }
}

async function cancel(req, res, log) {
  const userId = await requireAuth(req, res);
  if (!userId) return;
  try {
    const record = await entitlement.getSubscription(userId);
    if (!record || !record.subscriptionId) {
      return res.status(404).json({ success: false, error: 'No subscription found', reqId: log.reqId });
    }
    const square = getSquareClient();
    if (!square) return res.status(500).json({ success: false, error: 'Payment system not configured', reqId: log.reqId });

    const result = await square.subscriptions.cancel({ subscriptionId: record.subscriptionId });
    const updated = await subscriptions.save(userId, result.subscription, record);
    log.info('subscription cancelled', { userId, endsOn: updated.canceledDate });
    return res.status(200).json({ success: true, endsOn: updated.canceledDate });
  } catch (error) {
    log.error('cancel failed', { userId, ...errFields(error) });
    return res.status(500).json({
      success: false,
      error: 'We could not cancel your subscription. Please try again or contact support.',
      reqId: log.reqId,
    });
  }
}

// Square calls this when a subscription changes (renewal, failed payment,
// cancellation). The notification is treated only as a hint: the subscription
// it names is re-read from Square before anything is stored, so a forged
// request cannot change anyone's access.
async function webhook(req, res, log) {
  try {
    if (await rateLimit.enforce(req, res, { bucket: 'pay:webhook', id: rateLimit.clientIp(req), max: 120, windowSeconds: 60 })) return;
    const object = req.body && req.body.data && req.body.data.object;
    const subscriptionId = object && object.subscription && object.subscription.id;
    if (typeof subscriptionId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(subscriptionId)) {
      const userId = await subscriptions.userForSubscription(subscriptionId);
      if (userId) {
        const record = await subscriptions.refresh(userId);
        log.info('subscription refreshed from webhook', { userId, status: record && record.status });
      }
    }
  } catch (error) {
    log.error('webhook failed', errFields(error));
  }
  return res.status(200).json({ received: true });
}

const ROUTES = {
  'create-subscription': { method: 'POST', handler: createSubscription },
  status: { method: 'GET', handler: status },
  cancel: { method: 'POST', handler: cancel },
  webhook: { method: 'POST', handler: webhook },
};

module.exports = async (req, res) => {
  const action = String(req.query.action || '');
  const log = createLogger(`payments.${action}`, req);
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : null;
  if (!route) return res.status(404).json({ error: 'Not found' });
  if (applyCors(req, res, `${route.method},OPTIONS`)) return;
  if (req.method !== route.method) {
    res.setHeader('Allow', route.method);
    return res.status(405).json({ error: 'Method not allowed', reqId: log.reqId });
  }
  return route.handler(req, res, log);
};
