// Fixed-window rate limiting backed by the shared store.

const store = require('./store');

// Returns { ok, remaining, retryAfter }. `id` is a user id or client IP.
// If the store is unavailable the limiter fails open for local development and
// lets the store error surface in deployed environments.
async function limit(bucket, id, max, windowSeconds) {
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${bucket}:${id}:${windowIndex}`;
  const count = await store.incr(key, windowSeconds * 2);
  const windowEnd = (windowIndex + 1) * windowSeconds;
  return {
    ok: count <= max,
    remaining: Math.max(0, max - count),
    retryAfter: Math.max(1, Math.ceil(windowEnd - Date.now() / 1000)),
  };
}

// Give back one unit when the work it was reserved for did not happen
// (for example the AI call failed), so users are not charged for our errors.
async function refund(bucket, id, windowSeconds) {
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${bucket}:${id}:${windowIndex}`;
  try {
    const current = Number(await store.get(key)) || 0;
    if (current > 0) await store.set(key, current - 1, windowSeconds * 2);
  } catch {
    // Best effort only.
  }
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  return (first || req.socket?.remoteAddress || 'unknown').trim().slice(0, 64);
}

// Apply a limit and answer 429 when it is exceeded. Returns true if the caller
// should stop.
async function enforce(req, res, { bucket, id, max, windowSeconds, message }) {
  const result = await limit(bucket, id, max, windowSeconds);
  if (result.ok) return false;
  res.setHeader('Retry-After', String(result.retryAfter));
  res.status(429).json({
    error: message || 'Too many requests. Please try again shortly.',
    code: 'rate_limited',
    retryAfter: result.retryAfter,
  });
  return true;
}

module.exports = { limit, refund, enforce, clientIp };
