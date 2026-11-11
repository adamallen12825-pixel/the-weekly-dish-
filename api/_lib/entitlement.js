// Who may use the paid features.
//
// While REQUIRE_SUBSCRIPTION is not "true" (the default, i.e. the free beta),
// every signed-in user is allowed. Once it is "true", a user needs an active
// subscription or must still be inside the free trial (FREE_TRIAL_DAYS after
// sign-up, default 7).
//
// The subscription record is written only by the payment endpoints and lives
// outside the per-user data namespace, so a browser can never grant itself
// access through the storage API.

const { createClerkClient } = require('@clerk/backend');
const store = require('./store');

const ACTIVE_STATUSES = new Set(['ACTIVE', 'PENDING']);
const DAY_MS = 24 * 60 * 60 * 1000;

const subscriptionKey = (userId) => `sub:${userId}`;
const createdKey = (userId) => `acct:${userId}:created`;

async function getSubscription(userId) {
  return (await store.get(subscriptionKey(userId))) || null;
}

async function clearSubscription(userId) {
  await store.del(subscriptionKey(userId), createdKey(userId));
}

const endOfDay = (date) => new Date(`${date}T23:59:59Z`).getTime();

function isActive(record) {
  if (!record) return false;
  // A cancelled subscription stays usable until the end of the paid period.
  if (record.canceledDate) return endOfDay(record.canceledDate) > Date.now();
  if (ACTIVE_STATUSES.has(record.status)) return true;
  if (record.status === 'CANCELED' && record.paidThrough) return endOfDay(record.paidThrough) > Date.now();
  return false;
}

// Square is the source of truth. Re-check a record that has not been confirmed
// for a day so a failed renewal or an ended subscription is noticed even if a
// webhook was missed.
async function currentSubscription(userId) {
  const record = await getSubscription(userId);
  if (!record || !record.subscriptionId) return record;
  const age = Date.now() - new Date(record.updatedAt || 0).getTime();
  if (age < DAY_MS) return record;
  try {
    return await require('./subscriptions').refresh(userId);
  } catch {
    return record;
  }
}

async function accountCreatedAt(userId) {
  const cached = await store.get(createdKey(userId));
  if (cached) return Number(cached);
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const user = await clerk.users.getUser(userId);
  const createdAt = Number(user.createdAt) || Date.now();
  await store.set(createdKey(userId), createdAt);
  return createdAt;
}

const enforced = () => process.env.REQUIRE_SUBSCRIPTION === 'true';
const trialDays = () => Math.max(0, Number(process.env.FREE_TRIAL_DAYS ?? 7) || 0);

// Returns { allowed, reason, enforced, subscription, trialEndsAt }.
async function check(userId) {
  if (!enforced()) return { allowed: true, reason: 'beta', enforced: false };

  const subscription = await currentSubscription(userId);
  if (isActive(subscription)) return { allowed: true, reason: 'subscribed', enforced: true, subscription };

  const days = trialDays();
  if (days > 0) {
    const trialEndsAt = (await accountCreatedAt(userId)) + days * DAY_MS;
    if (trialEndsAt > Date.now()) {
      return { allowed: true, reason: 'trial', enforced: true, subscription, trialEndsAt: new Date(trialEndsAt).toISOString() };
    }
    return { allowed: false, reason: 'trial_ended', enforced: true, subscription, trialEndsAt: new Date(trialEndsAt).toISOString() };
  }
  return { allowed: false, reason: 'not_subscribed', enforced: true, subscription };
}

module.exports = { check, getSubscription, clearSubscription, isActive, enforced };
