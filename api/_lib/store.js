// Shared key-value store for the serverless API.
//
// Production uses Redis (Upstash, via the Vercel Marketplace integration).
// Local development without Redis falls back to an in-memory map. In a deployed
// environment the in-memory fallback is refused: it would silently lose every
// user's data when the function instance recycles.

let redis = null;

function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url, token });
  return redis;
}

const isDeployed = () => Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'development';

class StoreUnavailableError extends Error {
  constructor() {
    super('Storage is not configured');
    this.name = 'StoreUnavailableError';
    this.status = 503;
  }
}

if (!global.__weeklyDishMemStore) global.__weeklyDishMemStore = new Map();
const mem = global.__weeklyDishMemStore;

function memGet(key) {
  const entry = mem.get(key);
  if (!entry) return null;
  if (entry.exp && entry.exp <= Date.now()) {
    mem.delete(key);
    return null;
  }
  return entry.v;
}

function backend() {
  const client = getRedis();
  if (client) return client;
  if (isDeployed()) throw new StoreUnavailableError();
  return null;
}

async function get(key) {
  const client = backend();
  if (client) {
    const value = await client.get(key);
    return value === undefined ? null : value;
  }
  return memGet(key);
}

// ttlSeconds is optional; omit for values that never expire.
async function set(key, value, ttlSeconds) {
  const client = backend();
  if (client) {
    if (ttlSeconds) await client.set(key, value, { ex: ttlSeconds });
    else await client.set(key, value);
    return;
  }
  mem.set(key, { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
}

async function del(...keys) {
  if (keys.length === 0) return;
  const client = backend();
  if (client) {
    await client.del(...keys);
    return;
  }
  keys.forEach((k) => mem.delete(k));
}

// Atomically increment a counter. The TTL is applied when the counter is first
// created, so a counter always expires at the end of its window.
async function incr(key, ttlSeconds) {
  const client = backend();
  if (client) {
    const count = await client.incr(key);
    if (count === 1 && ttlSeconds) await client.expire(key, ttlSeconds);
    return count;
  }
  const current = Number(memGet(key)) || 0;
  const existing = mem.get(key);
  mem.set(key, {
    v: current + 1,
    exp: existing && existing.exp ? existing.exp : ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
  });
  return current + 1;
}

// List every key that starts with a prefix.
async function keysWithPrefix(prefix) {
  const client = backend();
  if (client) {
    const found = [];
    let cursor = '0';
    do {
      const [next, batch] = await client.scan(cursor, { match: `${prefix}*`, count: 200 });
      found.push(...batch);
      cursor = String(next);
    } while (cursor !== '0');
    return found;
  }
  return Array.from(mem.keys()).filter((k) => k.startsWith(prefix) && memGet(k) !== null);
}

module.exports = { get, set, del, incr, keysWithPrefix, StoreUnavailableError };
