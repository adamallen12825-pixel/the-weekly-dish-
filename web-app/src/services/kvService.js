// Storage service: the user's data lives on the server (so it follows them
// across devices) with a copy kept in this browser.
//
// Reliability rules:
//  - Reads come from the server. The browser copy is used only when the server
//    cannot be reached, never when the server answers "not signed in".
//  - Every save goes to the server straight away and is retried if it fails.
//    Saves that still have not gone through are remembered and retried when
//    the connection returns or the app is next opened.
//  - Anything listening via subscribe() is told whether saves are pending or
//    failing, so the app can show it instead of losing changes silently.
import { getAuthToken } from '../utils/authToken';

const API = '/api/kv';
const CACHE_MS = 5 * 60 * 1000;
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [800, 2500];
const BACKGROUND_RETRY_MS = 20000;

export class StorageError extends Error {
  constructor(message, { status = 0, permanent = false } = {}) {
    super(message);
    this.name = 'StorageError';
    this.status = status;
    this.permanent = permanent;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const local = {
  read(name) {
    try {
      const raw = window.localStorage.getItem(name);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  },
  write(name, value) {
    try {
      window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Storage full or unavailable: the server copy is what matters.
    }
  },
  remove(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore.
    }
  },
};

async function request(method, key, body) {
  const token = await getAuthToken();
  if (!token) throw new StorageError('You are signed out. Please sign in again.', { status: 401 });

  let response;
  try {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    response = await fetch(`${API}?key=${encodeURIComponent(key)}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: payload,
      // Lets tiny saves (flags, progress ticks) finish even if the tab closes
      // mid-request. Browsers cap the combined size of such requests at 64 KB,
      // so larger saves must not use it or they fail outright.
      keepalive: Boolean(payload) && payload.length < 4000,
    });
  } catch {
    throw new StorageError('Could not reach the server. Check your connection.');
  }

  if (response.status === 404 && method === 'GET') return { found: false };
  if (!response.ok) {
    const permanent = response.status === 400 || response.status === 413;
    const message =
      response.status === 413
        ? 'That is too much data to save.'
        : response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'The server could not save or load your data.';
    throw new StorageError(message, { status: response.status, permanent });
  }
  if (method !== 'GET') {
    // Read the reply fully so the connection is released straight away.
    await response.text().catch(() => '');
    return { found: true };
  }
  try {
    return { found: true, value: await response.json() };
  } catch {
    throw new StorageError('The server sent an unreadable response.');
  }
}

// Retry temporary failures; give up at once on permanent ones and on 401.
async function withRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.permanent || error.status === 401) break;
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

class KVStorageService {
  constructor() {
    this.cache = new Map(); // "user:key" -> { value, timestamp }
    this.dirty = new Map(); // "user:key" -> { userId, key, value, at }
    this.draining = new Map(); // "user:key" -> promise
    this.listeners = new Set();
    this.failed = false;
    this.retryTimer = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.retryPending());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.retryPending();
      });
    }
  }

  localName(userId, key) {
    return `${userId}_${key}`;
  }

  // --- save status -------------------------------------------------------

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.status());
    return () => this.listeners.delete(listener);
  }

  status() {
    return { pending: this.dirty.size, failed: this.failed && this.dirty.size > 0 };
  }

  emit() {
    const status = this.status();
    this.listeners.forEach((listener) => listener(status));
  }

  persistPending(userId) {
    const entries = [];
    this.dirty.forEach((item) => {
      if (item.userId === userId) entries.push({ key: item.key, at: item.at });
    });
    if (entries.length) local.write(`${userId}__pending`, entries);
    else local.remove(`${userId}__pending`);
  }

  // Called once after sign-in: push any saves a previous visit could not finish.
  resumePending(userId) {
    if (!userId) return;
    const entries = local.read(`${userId}__pending`);
    if (!Array.isArray(entries)) return;
    entries.forEach(({ key, at }) => {
      const cacheKey = `${userId}:${key}`;
      const value = local.read(this.localName(userId, key));
      const fresh = Date.now() - Number(at || 0) < PENDING_MAX_AGE_MS;
      if (value === null || !fresh || this.dirty.has(cacheKey)) return;
      this.dirty.set(cacheKey, { userId, key, value, at });
      this.drain(cacheKey).catch(() => {});
    });
    this.persistPending(userId);
    this.emit();
  }

  retryPending() {
    this.dirty.forEach((_item, cacheKey) => {
      this.drain(cacheKey).catch(() => {});
    });
  }

  scheduleRetry() {
    if (this.retryTimer || this.dirty.size === 0) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryPending();
    }, BACKGROUND_RETRY_MS);
  }

  // --- reads -------------------------------------------------------------

  // Returns the stored value, or null if nothing is stored. Throws a
  // StorageError when the data could not be loaded at all, so callers can tell
  // "nothing saved yet" apart from "could not check".
  async get(userId, key, skipCache = false) {
    if (!userId) return null;
    const cacheKey = `${userId}:${key}`;

    // A save that has not reached the server yet is the newest version.
    if (this.dirty.has(cacheKey)) return this.dirty.get(cacheKey).value;

    if (!skipCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_MS) return cached.value;
    }

    try {
      const result = await withRetry(() => request('GET', key));
      const value = result.found ? result.value : null;
      this.cache.set(cacheKey, { value, timestamp: Date.now() });
      if (value === null) local.remove(this.localName(userId, key));
      else local.write(this.localName(userId, key), value);
      return value;
    } catch (error) {
      // Offline or server trouble: fall back to this browser's copy if there
      // is one. A sign-in problem is never papered over with old data.
      if (error.status !== 401) {
        const fallback = local.read(this.localName(userId, key));
        if (fallback !== null) return fallback;
      }
      throw error;
    }
  }

  // --- writes ------------------------------------------------------------

  // Saves a value. Resolves once the server has it; rejects if it could not be
  // saved after retrying (the save stays queued and is retried later).
  set(userId, key, value) {
    if (!userId) return Promise.resolve(false);
    const cacheKey = `${userId}:${key}`;

    local.write(this.localName(userId, key), value);
    this.cache.set(cacheKey, { value, timestamp: Date.now() });
    this.dirty.set(cacheKey, { userId, key, value, at: Date.now() });
    this.persistPending(userId);
    this.emit();
    return this.drain(cacheKey);
  }

  // Sends the latest value for a key. Saves to the same key are sent one at a
  // time and only the newest value is sent, so an older save can never land
  // after a newer one.
  drain(cacheKey) {
    if (this.draining.has(cacheKey)) return this.draining.get(cacheKey);

    const work = (async () => {
      try {
        while (this.dirty.has(cacheKey)) {
          const item = this.dirty.get(cacheKey);
          try {
            await withRetry(() => request('POST', item.key, { value: item.value }));
          } catch (error) {
            if (error.permanent) {
              if (this.dirty.get(cacheKey) === item) this.dirty.delete(cacheKey);
              this.persistPending(item.userId);
            } else {
              console.warn(`Save of "${item.key}" has not reached the server yet: ${error.message}`);
              this.failed = true;
              this.scheduleRetry();
            }
            throw error;
          }
          if (this.dirty.get(cacheKey) === item) this.dirty.delete(cacheKey);
          this.persistPending(item.userId);
        }
        if (this.dirty.size === 0) this.failed = false;
        return true;
      } finally {
        this.draining.delete(cacheKey);
        this.emit();
      }
    })();

    this.draining.set(cacheKey, work);
    return work;
  }

  async delete(userId, key) {
    if (!userId) return false;
    const cacheKey = `${userId}:${key}`;
    local.remove(this.localName(userId, key));
    this.cache.set(cacheKey, { value: null, timestamp: Date.now() });
    this.dirty.delete(cacheKey);
    this.persistPending(userId);
    this.emit();
    try {
      await withRetry(() => request('DELETE', key));
      return true;
    } catch (error) {
      console.error(`Could not delete ${key}:`, error.message);
      return false;
    }
  }

  // Forget everything this browser holds for a user (used at account deletion
  // and sign-out). Does not touch the server.
  clearLocal(userId) {
    if (!userId) return;
    Array.from(this.cache.keys())
      .filter((k) => k.startsWith(`${userId}:`))
      .forEach((k) => this.cache.delete(k));
    Array.from(this.dirty.keys())
      .filter((k) => k.startsWith(`${userId}:`))
      .forEach((k) => this.dirty.delete(k));
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith(`${userId}_`))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Ignore.
    }
    this.emit();
  }
}

const kvService = new KVStorageService();

export default kvService;
