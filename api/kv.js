// Per-user storage for cross-device sync.
//
// Security model:
//  - The user is authenticated via their Clerk session token. The user id
//    ALWAYS comes from the verified token, never from the request, so a caller
//    can only read or write their own data.
//  - Only the app's own data keys are accepted, each value has a size cap, and
//    writes are rate limited, so an account cannot be used as free storage.
//  - Data lives in Redis (private, server-side). There are no public URLs.

const { applyCors, requireAuth } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');
const store = require('./_lib/store');
const rateLimit = require('./_lib/rateLimit');

// Every key the web app stores, with its maximum size in bytes.
const KB = 1024;
const ALLOWED_KEYS = {
  profile: 32 * KB,
  tosAcceptance: 4 * KB,
  pantry: 400 * KB,
  currentMealPlan: 200 * KB,
  currentShoppingList: 200 * KB,
  shoppingProgress: 32 * KB,
  mealPlanAccepted: 1 * KB,
  mealPlanHistory: 800 * KB,
  recipesCache: 800 * KB,
  recipeFavorites: 32 * KB,
  recipeDislikes: 32 * KB,
  cookingHistory: 200 * KB,
};

const storageKey = (userId, key) => `user:${userId}:${key}`;

module.exports = async (req, res) => {
  const log = createLogger('kv', req);
  if (applyCors(req, res, 'GET,POST,DELETE,OPTIONS')) return;

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const key = String(req.query.key || '');
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_KEYS, key)) {
    log.warn('bad request: unknown key', { userId, key: key.slice(0, 64) });
    return res.status(400).json({ error: 'Missing or invalid key', reqId: log.reqId });
  }
  const fullKey = storageKey(userId, key);
  res.setHeader('Cache-Control', 'no-store');

  try {
    switch (req.method) {
      case 'GET': {
        const value = await store.get(fullKey);
        if (value === null || value === undefined) {
          return res.status(404).json({ error: 'Not found', reqId: log.reqId });
        }
        return res.status(200).json(value);
      }

      case 'POST': {
        const { value } = req.body || {};
        if (value === undefined || value === null) {
          return res.status(400).json({ error: 'Missing value in request body', reqId: log.reqId });
        }
        const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
        if (bytes > ALLOWED_KEYS[key]) {
          log.warn('value too large', { userId, key, bytes });
          return res.status(413).json({ error: 'That is too much data to save.', code: 'too_large', reqId: log.reqId });
        }
        if (await rateLimit.enforce(req, res, { bucket: 'kv:write', id: userId, max: 240, windowSeconds: 60 })) return;
        await store.set(fullKey, value);
        log.info('set', { userId, key, bytes });
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        await store.del(fullKey);
        log.info('delete', { userId, key });
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: `Method ${req.method} not allowed`, reqId: log.reqId });
    }
  } catch (error) {
    log.error('storage error', { userId, key, method: req.method, ...errFields(error) });
    return res.status(error.status || 500).json({ error: 'Storage error', reqId: log.reqId });
  }
};

module.exports.ALLOWED_KEYS = ALLOWED_KEYS;
module.exports.storageKey = storageKey;
