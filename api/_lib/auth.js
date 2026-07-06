// Shared auth + CORS helpers for the serverless API.
// Files/folders prefixed with "_" are ignored by Vercel's function router,
// so this module is bundled into the endpoints that import it but is never
// itself exposed as a route.

const { verifyToken } = require('@clerk/backend');
const { createLogger, errFields } = require('./log');

// Origins allowed to call the API from a browser. Configurable via the
// APP_ORIGINS env var (comma-separated) so preview/custom domains work without
// a code change; falls back to the known production + local origins.
const DEFAULT_ORIGINS = [
  'https://theweekly-dish.com',
  'https://www.theweekly-dish.com',
  'http://localhost:3000',
];
const ENV_ORIGINS = (process.env.APP_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = ENV_ORIGINS.length ? ENV_ORIGINS : DEFAULT_ORIGINS;

// Optional extra hardening: restrict which origins' Clerk tokens are accepted.
// Off by default — the token signature already proves it came from your Clerk
// instance. Set CLERK_AUTHORIZED_PARTIES (comma-separated) to enable.
const AUTHORIZED_PARTIES = (process.env.CLERK_AUTHORIZED_PARTIES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Apply a locked-down CORS policy. Reflects the request origin only if it is
// on the allowlist; otherwise no CORS headers are sent (browser blocks it).
// Returns true if the caller should stop (an OPTIONS preflight was handled).
function applyCors(req, res, methods = 'GET,POST,OPTIONS') {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Verify the Clerk session token from the Authorization header.
// On success returns the Clerk user id (the token's `sub` claim).
// On failure responds with 401 and returns null — callers must check for null
// and stop. The trusted user id ALWAYS comes from here, never from the request
// body or query string.
async function requireAuth(req, res) {
  const log = createLogger('auth', req);
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    log.warn('missing bearer token', { origin: req.headers.origin });
    res.status(401).json({ error: 'Authentication required', reqId: log.reqId });
    return null;
  }

  if (!process.env.CLERK_SECRET_KEY) {
    log.error('CLERK_SECRET_KEY not set — cannot verify sessions');
    res.status(500).json({ error: 'Auth not configured', reqId: log.reqId });
    return null;
  }

  try {
    const verifyOpts = { secretKey: process.env.CLERK_SECRET_KEY };
    if (AUTHORIZED_PARTIES.length) {
      verifyOpts.authorizedParties = AUTHORIZED_PARTIES;
    }
    const payload = await verifyToken(token, verifyOpts);
    if (!payload || !payload.sub) {
      log.warn('token verified but no subject claim');
      res.status(401).json({ error: 'Invalid session', reqId: log.reqId });
      return null;
    }
    return payload.sub;
  } catch (err) {
    // Common causes: expired token, azp/origin mismatch, wrong secret key.
    log.warn('token verification failed', { origin: req.headers.origin, ...errFields(err) });
    res.status(401).json({ error: 'Invalid or expired session', reqId: log.reqId });
    return null;
  }
}

module.exports = { applyCors, requireAuth, ALLOWED_ORIGINS };
