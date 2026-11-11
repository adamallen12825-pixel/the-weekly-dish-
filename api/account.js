// Delete the signed-in user's account and everything stored for it.
//
//   DELETE /api/account
//
// Runs entirely on the server so nothing is left behind if the browser tab
// closes part-way: cancels any subscription, removes every stored record for
// the user, then deletes the Clerk account itself.

const { createClerkClient } = require('@clerk/backend');
const { applyCors, requireAuth } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');
const store = require('./_lib/store');
const entitlement = require('./_lib/entitlement');
const { getSquareClient } = require('./_lib/square');

module.exports = async (req, res) => {
  const log = createLogger('account', req);
  if (applyCors(req, res, 'DELETE,OPTIONS')) return;
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed', reqId: log.reqId });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    // Stop billing first. If this fails the account is kept so the user is
    // never left paying for an account they can no longer sign in to.
    const subscription = await entitlement.getSubscription(userId);
    if (subscription && subscription.subscriptionId && entitlement.isActive(subscription) && subscription.status !== 'CANCELED') {
      const square = getSquareClient();
      if (!square) throw new Error('Payment system not configured; cannot cancel subscription');
      await square.subscriptions.cancel({ subscriptionId: subscription.subscriptionId });
      log.info('subscription cancelled', { userId });
    }

    const keys = await store.keysWithPrefix(`user:${userId}:`);
    for (let i = 0; i < keys.length; i += 50) await store.del(...keys.slice(i, i + 50));
    await entitlement.clearSubscription(userId);

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.users.deleteUser(userId);

    log.info('account deleted', { userId, keysRemoved: keys.length });
    return res.status(200).json({ success: true });
  } catch (error) {
    log.error('account deletion failed', { userId, ...errFields(error) });
    return res.status(500).json({
      error: 'We could not delete your account. Please try again or contact support.',
      reqId: log.reqId,
    });
  }
};
