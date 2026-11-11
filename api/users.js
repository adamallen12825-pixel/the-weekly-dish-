// Public total-user-count endpoint (shown on the landing page).
// Returns only an aggregate count, no personal data, so it does not require
// authentication. The count is cached and the endpoint is rate limited so it
// cannot be used to hammer the Clerk API.
// URL: /api/users?action=count

const { createClerkClient } = require('@clerk/backend');
const { applyCors } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');
const store = require('./_lib/store');
const rateLimit = require('./_lib/rateLimit');

const CACHE_KEY = 'cache:userCount';
const CACHE_SECONDS = 600;

module.exports = async (req, res) => {
  const log = createLogger('users', req);
  if (applyCors(req, res, 'GET,OPTIONS')) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (await rateLimit.enforce(req, res, { bucket: 'users', id: rateLimit.clientIp(req), max: 30, windowSeconds: 60 })) return;
    let count = await store.get(CACHE_KEY);
    if (count === null || count === undefined) {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const { totalCount } = await clerk.users.getUserList({ limit: 1 });
      count = totalCount;
      await store.set(CACHE_KEY, count, CACHE_SECONDS);
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ count: Number(count) || 0 });
  } catch (error) {
    log.error('user count failed', errFields(error));
    return res.status(500).json({ error: 'Unable to get count', count: 0 });
  }
};
