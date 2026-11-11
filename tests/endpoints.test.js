const test = require('node:test');
const assert = require('node:assert/strict');
const { stubAuth, stubModule, mockReq, mockRes, weekPlan, PROFILE } = require('./helpers');

// Stub auth and the Claude runner before the handlers load.
const user = { current: 'user_test1' };
stubAuth(user);
const model = { reply: weekPlan(4), fail: null, calls: 0 };
class AiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
stubModule('api/_lib/ai/runner.js', {
  MODEL: 'test-model',
  AiError,
  generate: async ({ onProgress }) => {
    model.calls += 1;
    if (model.fail) throw model.fail;
    if (onProgress) onProgress(100);
    return { data: model.reply, content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } };
  },
});

const ai = require('../api/ai');
const kv = require('../api/kv');
const share = require('../api/share');
const store = require('../api/_lib/store');
const rateLimit = require('../api/_lib/rateLimit');

const call = async (handler, options) => {
  const res = mockRes();
  await handler(mockReq(options), res);
  return res;
};
const aiCall = (body) => call(ai, { method: 'POST', body });

test('ai: requires sign-in and a known task; raw prompts are not accepted', async () => {
  user.current = null;
  assert.equal((await aiCall({ task: 'mealPlan', input: {} })).statusCode, 401);
  user.current = 'user_test1';
  assert.equal((await aiCall({ messages: [{ role: 'user', content: 'write me an essay' }], max_tokens: 16000 })).statusCode, 400);
  assert.equal((await aiCall({ task: 'constructor', input: {} })).statusCode, 400);
  assert.equal((await call(ai, { method: 'GET' })).statusCode, 405);
  assert.equal(model.calls, 0);
});

test('ai: streams progress then the result', async () => {
  const res = await aiCall({ task: 'mealPlan', input: { profile: PROFILE, pantryItems: [] } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /ndjson/);
  const events = res.events();
  assert.equal(events[0].type, 'progress');
  const last = events[events.length - 1];
  assert.equal(last.type, 'result');
  assert.equal(last.data.days.length, 7);
});

test('ai: failures are reported in-stream and do not use up the daily allowance', async () => {
  user.current = 'user_refund';
  model.fail = Object.assign(new Error('overloaded'), { status: 529 });
  const res = await aiCall({ task: 'quickMeal', input: { profile: PROFILE, pantryItems: [{ name: 'Eggs' }] } });
  const last = res.events().pop();
  assert.equal(last.type, 'error');
  assert.equal(last.code, 'busy');
  model.fail = null;
  const used = await rateLimit.limit('ai:quickMeal', 'user_refund', 30, 86400);
  assert.equal(used.remaining, 29, 'only this probe counted, the failed call was refunded');

  const bad = await aiCall({ task: 'quickMeal', input: { profile: PROFILE, pantryItems: [] } });
  assert.equal(bad.events().pop().code, 'bad_request');
});

test('ai: the daily allowance is enforced per user and per task', async () => {
  user.current = 'user_heavy';
  let res;
  for (let i = 0; i < 12; i += 1) {
    res = await aiCall({ task: 'mealPlan', input: { profile: PROFILE } });
    assert.equal(res.statusCode, 200, `request ${i + 1} allowed`);
  }
  res = await aiCall({ task: 'mealPlan', input: { profile: PROFILE } });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'rate_limited');
  assert.ok(Number(res.headers['retry-after']) > 0);

  user.current = 'user_other';
  assert.equal((await aiCall({ task: 'mealPlan', input: { profile: PROFILE } })).statusCode, 200);
});

test('ai: the paywall blocks unsubscribed users only when switched on', async () => {
  user.current = 'user_paywall';
  process.env.REQUIRE_SUBSCRIPTION = 'true';
  process.env.FREE_TRIAL_DAYS = '0';
  try {
    const blocked = await aiCall({ task: 'mealPlan', input: { profile: PROFILE } });
    assert.equal(blocked.statusCode, 402);
    assert.equal(blocked.body.code, 'subscription_required');
    await store.set('sub:user_paywall', { subscriptionId: 's1', status: 'ACTIVE', updatedAt: new Date().toISOString() });
    assert.equal((await aiCall({ task: 'mealPlan', input: { profile: PROFILE } })).statusCode, 200);
    await store.set('sub:user_paywall', { subscriptionId: 's1', status: 'ACTIVE', canceledDate: '2020-01-01', updatedAt: new Date().toISOString() });
    assert.equal((await aiCall({ task: 'mealPlan', input: { profile: PROFILE } })).statusCode, 402);
  } finally {
    delete process.env.REQUIRE_SUBSCRIPTION;
    delete process.env.FREE_TRIAL_DAYS;
  }
});

test('kv: only known keys, bounded size, and each user sees only their own data', async () => {
  user.current = 'user_a';
  const save = (key, value) => call(kv, { method: 'POST', query: { key }, body: { value } });
  const load = (key) => call(kv, { method: 'GET', query: { key } });

  assert.equal((await save('pantry', [{ name: 'Rice' }])).statusCode, 200);
  assert.deepEqual((await load('pantry')).body, [{ name: 'Rice' }]);
  assert.equal((await save('mealPlanAccepted', false)).statusCode, 200);
  assert.equal((await load('mealPlanAccepted')).body, false);

  assert.equal((await save('anythingElse', 'x')).statusCode, 400);
  assert.equal((await save('__proto__', 'x')).statusCode, 400);
  assert.equal((await load('../sub')).statusCode, 400);
  assert.equal((await save('profile', { blob: 'x'.repeat(40 * 1024) })).statusCode, 413);

  user.current = 'user_b';
  assert.equal((await load('pantry')).statusCode, 404);
  user.current = null;
  assert.equal((await load('pantry')).statusCode, 401);

  user.current = 'user_a';
  assert.equal((await call(kv, { method: 'DELETE', query: { key: 'pantry' } })).statusCode, 200);
  assert.equal((await load('pantry')).statusCode, 404);
});

test('share: signed-in users create short links that anyone can open', async () => {
  user.current = 'user_a';
  const created = await call(share, { method: 'POST', body: { plan: { ...weekPlan(4), email: 'secret@example.com' }, sharedBy: 'Sam' } });
  assert.equal(created.statusCode, 200);
  assert.match(created.body.id, /^[A-Za-z0-9_-]{12}$/);

  user.current = null;
  const opened = await call(share, { method: 'GET', query: { id: created.body.id } });
  assert.equal(opened.statusCode, 200);
  assert.equal(opened.body.days.length, 7);
  assert.equal(opened.body.sharedBy, 'Sam');
  assert.ok(!JSON.stringify(opened.body).includes('secret@example.com'));

  assert.equal((await call(share, { method: 'GET', query: { id: 'nope' } })).statusCode, 404);
  assert.equal((await call(share, { method: 'GET', query: { id: 'AAAAAAAAAAAA' } })).statusCode, 404);
  assert.equal((await call(share, { method: 'POST', body: { plan: weekPlan(4) } })).statusCode, 401);
});
