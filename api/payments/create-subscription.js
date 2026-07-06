// Create a Square subscription for the authenticated user.
//
// Security: the user id and email come from the verified Clerk token, never
// from the request body — a caller cannot create a subscription tied to a
// different account. The plan/pricing comes from server env, never the client.
//
// NOTE: This targets the Square v43 SDK surface (client.customers / client.cards
// / client.subscriptions). It must be tested end-to-end against your Square
// sandbox before launch, and SQUARE_ENVIRONMENT must be set to "production"
// with production credentials to take real payments.

const { applyCors, requireAuth } = require('../_lib/auth');
const { getSquareClient, idempotencyKey } = require('../_lib/square');
const { createClerkClient } = require('@clerk/backend');
const { createLogger, errFields } = require('../_lib/log');

module.exports = async (req, res) => {
  const log = createLogger('payments.create', req);
  if (applyCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', reqId: log.reqId });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const square = getSquareClient();
  if (!square) {
    log.error('Square not configured (SQUARE_ACCESS_TOKEN missing)', { userId });
    return res.status(500).json({ success: false, error: 'Payment system not configured', reqId: log.reqId });
  }

  try {
    const { sourceId } = req.body || {};
    if (!sourceId) {
      log.warn('missing payment token', { userId });
      return res.status(400).json({ success: false, error: 'Missing payment token', reqId: log.reqId });
    }
    log.info('subscription flow start', { userId, env: process.env.SQUARE_ENVIRONMENT || 'sandbox' });

    // Get the user's verified email from Clerk (not from the request body).
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return res.status(400).json({ success: false, error: 'No email on account' });
    }

    // Find or create the Square customer, keyed to the Clerk user id.
    let customer;
    const search = await square.customers.search({
      query: { filter: { emailAddress: { exact: email } } },
    });
    if (search.customers && search.customers.length > 0) {
      customer = search.customers[0];
    } else {
      const created = await square.customers.create({
        givenName: email.split('@')[0],
        emailAddress: email,
        referenceId: userId,
      });
      customer = created.customer;
    }

    // Store the card on file.
    const cardResult = await square.cards.create({
      idempotencyKey: idempotencyKey('card'),
      sourceId,
      card: { customerId: customer.id },
    });
    const cardId = cardResult.card.id;

    // Create the subscription. Plan and location come from server env.
    const subscription = await square.subscriptions.create({
      idempotencyKey: idempotencyKey('sub'),
      locationId: process.env.SQUARE_LOCATION_ID,
      planVariationId: process.env.SQUARE_SUBSCRIPTION_PLAN_ID,
      customerId: customer.id,
      cardId,
      timezone: 'America/New_York',
    });

    log.info('subscription created', { userId, customerId: customer.id, subscriptionId: subscription.subscription?.id });
    return res.status(200).json({
      success: true,
      subscription: subscription.subscription,
      customerId: customer.id,
    });
  } catch (error) {
    // Square SDK errors carry a .errors array with detail/category.
    const squareErrors = Array.isArray(error?.errors) ? error.errors : undefined;
    log.error('create subscription failed', { userId, ...errFields(error), squareErrors });
    return res.status(500).json({ success: false, error: 'Failed to create subscription', reqId: log.reqId });
  }
};
