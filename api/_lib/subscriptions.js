// Keeps our stored subscription record in step with Square, which is the
// source of truth for billing.

const store = require('./store');
const { getSquareClient } = require('./square');

const recordKey = (userId) => `sub:${userId}`;
const indexKey = (subscriptionId) => `subidx:${subscriptionId}`;

// Reduce a Square subscription to plain JSON-safe fields (the SDK returns
// BigInt values that cannot be serialized as-is).
function toRecord(subscription, previous = {}) {
  return {
    subscriptionId: subscription.id,
    customerId: subscription.customerId || previous.customerId || null,
    status: subscription.status || 'PENDING',
    paidThrough: subscription.chargedThroughDate || previous.paidThrough || null,
    canceledDate: subscription.canceledDate || null,
    startDate: subscription.startDate || previous.startDate || null,
    updatedAt: new Date().toISOString(),
  };
}

async function save(userId, subscription, previous) {
  const record = toRecord(subscription, previous);
  await store.set(recordKey(userId), record);
  await store.set(indexKey(record.subscriptionId), userId);
  return record;
}

// Re-read the subscription from Square and update our record.
async function refresh(userId) {
  const record = await store.get(recordKey(userId));
  if (!record || !record.subscriptionId) return record || null;
  const square = getSquareClient();
  if (!square) return record;
  const response = await square.subscriptions.get({ subscriptionId: record.subscriptionId });
  if (!response.subscription) return record;
  return save(userId, response.subscription, record);
}

async function userForSubscription(subscriptionId) {
  return (await store.get(indexKey(subscriptionId))) || null;
}

module.exports = { toRecord, save, refresh, userForSubscription };
