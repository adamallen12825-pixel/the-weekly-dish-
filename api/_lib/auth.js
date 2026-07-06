// Shared auth + CORS helpers for the serverless API.
// Files/folders prefixed with "_" are ignored by Vercel's function router,
// so this module is bundled into the endpoints that import it but is never
// itself exposed as a route.

const { verifyToken } = require('@clerk/backend');

// Origins allowed to call the API from a browser.
const ALLOWED_ORIGINS = [
  'https://theweekly-dish.com',
  'https://www.theweekly-dish.com',
  'http://localhost:3000',
];

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
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: ALLOWED_ORIGINS,
    });
    if (!payload || !payload.sub) {
      res.status(401).json({ error: 'Invalid session' });
      return null;
    }
    return payload.sub;
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }
}

module.exports = { applyCors, requireAuth, ALLOWED_ORIGINS };
