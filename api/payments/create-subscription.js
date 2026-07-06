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

module.exports = async (req, res) => {
  if (applyCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const square = getSquareClient();
  if (!square) {
    return res.status(500).json({ success: false, error: 'Payment system not configured' });
  }

  try {
    const { sourceId } = req.body || {};
    if (!sourceId) {
      return res.status(400).json({ success: false, error: 'Missing payment token' });
    }

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

    return res.status(200).json({
      success: true,
      subscription: subscription.subscription,
      customerId: customer.id,
    });
  } catch (error) {
    console.error('Create subscription error:', error?.message);
    return res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
};
