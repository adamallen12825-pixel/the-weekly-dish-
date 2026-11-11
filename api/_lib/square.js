// Square client factory. Environment is driven by SQUARE_ENVIRONMENT so going
// live is a config change (set it to "production" + provide production
// credentials), not a code change.

const crypto = require('crypto');
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

// Idempotency keys are derived from what the request means (user + purpose +
// payment token), so a retried or double-clicked request can never create a
// second card or a second subscription. Square caps keys at 45 characters.
function idempotencyKey(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 45);
}

module.exports = { getSquareClient, idempotencyKey };
