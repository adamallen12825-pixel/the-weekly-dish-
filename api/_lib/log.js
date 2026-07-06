// Lightweight structured logger for the serverless API.
//
// Emits one JSON line per event so Vercel's function logs are filterable
// (search by reqId, scope, level, userId, status, etc.). Never log secrets:
// no tokens, API keys, card data, emails, or full request payloads — only
// counts, sizes, ids, and error metadata.

function requestId(req) {
  // Vercel sets x-vercel-id; fall back to a short random id locally.
  const vercelId = req?.headers?.['x-vercel-id'];
  if (vercelId) return String(vercelId).split('::').pop();
  return Math.random().toString(36).slice(2, 10);
}

function emit(level, scope, id, msg, fields) {
  const line = { t: new Date().toISOString(), level, scope, reqId: id, msg };
  if (fields) Object.assign(line, fields);
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  try {
    out(JSON.stringify(line));
  } catch {
    out(`[${level}] ${scope} ${msg}`);
  }
}

// Create a logger bound to one request. `logger.reqId` can be returned to the
// client so a browser-side failure can be matched to the exact server log.
function createLogger(scope, req) {
  const id = requestId(req);
  return {
    reqId: id,
    info: (msg, fields) => emit('info', scope, id, msg, fields),
    warn: (msg, fields) => emit('warn', scope, id, msg, fields),
    error: (msg, fields) => emit('error', scope, id, msg, fields),
  };
}

// Normalize any thrown error into safe, loggable fields (no stack secrets).
function errFields(err) {
  return {
    errName: err?.name,
    errMessage: err?.message,
    status: err?.status,
    errType: err?.error?.type || err?.type,
  };
}

module.exports = { createLogger, errFields };
