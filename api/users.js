// Public total-user-count endpoint (shown on the landing page).
// Returns only an aggregate count — no personal data — so it does not require
// authentication, but CORS is locked to our own origins.
// URL: /api/users?action=count

const { createClerkClient } = require('@clerk/backend');
const { applyCors } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const { totalCount } = await clerk.users.getUserList({ limit: 1 });
    return res.status(200).json({ count: totalCount });
  } catch (error) {
    console.error('Error getting user count:', error?.message);
    return res.status(500).json({ error: 'Unable to get count', count: 0 });
  }
};
