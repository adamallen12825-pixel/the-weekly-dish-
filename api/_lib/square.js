// Square client factory. Environment is driven by SQUARE_ENVIRONMENT so going
// live is a config change (set it to "production" + provide production
// credentials), not a code change.

const { SquareClient, SquareEnvironment } = require('square');

let client = null;

function getSquareClient() {
  if (client) return client;
  if (!process.env.SQUARE_ACCESS_TOKEN) return null;

  const environment =
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

  client = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment,
  });
  return client;
}

// Deterministic-ish idempotency key without Math.random/Date restrictions in
// this module (serverless can use both freely).
function idempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

module.exports = { getSquareClient, idempotencyKey };
