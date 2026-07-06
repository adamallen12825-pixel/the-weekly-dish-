// Per-user storage for cross-device sync.
//
// Security model:
//  - The user is authenticated via their Clerk session token (Authorization
//    header). The user id ALWAYS comes from the verified token, never from the
//    query string, so a caller can only ever read or write their own data.
//  - Data is stored in Vercel KV (private, server-side only). There are no
//    public URLs — the previous public-blob storage exposed every user's
//    profile/pantry/meal-plan at a guessable URL.

const { applyCors, requireAuth } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');

// Keys must be simple identifiers. This blocks key/path injection while
// letting the app use whatever data keys it needs.
const KEY_PATTERN = /^[a-zA-Z0-9_]{1,64}$/;

function storageKey(userId, key) {
  return `user:${userId}:${key}`;
}

// Lazily create the Redis client (Upstash, provisioned via the Vercel
// Marketplace Redis integration). Falls back to an in-memory store for local
// dev when the env vars are not configured. Supports both the Upstash-native
// var names and the KV_* names that older Vercel integrations expose.
let kvClient = null;
function getKv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    if (!kvClient) {
      const { Redis } = require('@upstash/redis');
      kvClient = new Redis({ url, token });
    }
    return kvClient;
  }
  return null;
}

if (!global.__devKvStore) global.__devKvStore = new Map();
const devStore = global.__devKvStore;

module.exports = async (req, res) => {
  const log = createLogger('kv', req);
  if (applyCors(req, res, 'GET,POST,DELETE,OPTIONS')) return;

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { key } = req.query;
  if (!key || !KEY_PATTERN.test(key)) {
    log.warn('bad request: missing/invalid key', { userId, key });
    return res.status(400).json({ error: 'Missing or invalid key', reqId: log.reqId });
  }

  const fullKey = storageKey(userId, key);
  const kv = getKv();
  if (!kv) {
    log.warn('no Redis configured — using in-memory dev store (data will not persist)', { userId });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const value = kv ? await kv.get(fullKey) : devStore.get(fullKey);
        const found = value !== null && value !== undefined;
        log.info('get', { userId, key, found });
        if (!found) {
          return res.status(404).json({ error: 'Not found', reqId: log.reqId });
        }
        return res.status(200).json(value);
      }

      case 'POST': {
        const { value } = req.body || {};
        if (value === undefined) {
          log.warn('post with no value', { userId, key });
          return res.status(400).json({ error: 'Missing value in request body', reqId: log.reqId });
        }
        const bytes = JSON.stringify(value).length;
        if (kv) {
          await kv.set(fullKey, value);
        } else {
          devStore.set(fullKey, value);
        }
        log.info('set', { userId, key, bytes });
        return res.status(200).json({ success: true });
      }

      case 'DELETE': {
        if (kv) {
          await kv.del(fullKey);
        } else {
          devStore.delete(fullKey);
        }
        log.info('delete', { userId, key });
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: `Method ${req.method} not allowed`, reqId: log.reqId });
    }
  } catch (error) {
    log.error('storage error', { userId, key, method: req.method, ...errFields(error) });
    return res.status(500).json({ error: 'Storage error', reqId: log.reqId });
  }
};
