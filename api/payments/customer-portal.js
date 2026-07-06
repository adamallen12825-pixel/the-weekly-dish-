// Return a URL where the authenticated user can manage their subscription.
// Square has no hosted customer portal like Stripe, so this points at the
// customer-facing management surface. Requires a signed-in user.

const { applyCors, requireAuth } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (applyCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  // Placeholder: replace with your real subscription-management URL / flow.
  return res.status(200).json({
    portalUrl: process.env.SUBSCRIPTION_PORTAL_URL || 'https://theweekly-dish.com/account',
  });
};
