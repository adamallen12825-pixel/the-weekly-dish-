// AI endpoint. The browser names a task and sends the household's data; the
// prompt, model and output format are decided here on the server.
//
//   POST /api/ai   { task: "mealPlan" | "shoppingList" | "replaceMeal" |
//                          "customMeal" | "recipe" | "quickMeal" | "pantryScan",
//                    input: { ... } }
//
// Protection: a verified Clerk session is required, each account has a daily
// allowance per task plus a per-minute burst limit, and there is no way to send
// an arbitrary prompt.
//
// The response is newline-delimited JSON so long generations never sit silent
// long enough to time out:
//   {"type":"progress","stage":"Planning your week","chars":1234}
//   {"type":"result","data":{...}}        (or)
//   {"type":"error","error":"...","code":"..."}

const { applyCors, requireAuth } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');
const rateLimit = require('./_lib/rateLimit');
const entitlement = require('./_lib/entitlement');
const { generate, AiError, MODEL } = require('./_lib/ai/runner');
const { TASKS } = require('./_lib/ai/tasks');

const DAY = 24 * 60 * 60;
const LIMIT_MULTIPLIER = Math.max(0.1, Number(process.env.AI_LIMIT_MULTIPLIER) || 1);

function friendlyError(error) {
  if (error instanceof AiError) return { message: error.message, code: error.code };
  const status = error && error.status;
  if (status === 429 || status === 529) {
    return { message: 'The AI service is busy right now. Please try again in a minute.', code: 'busy' };
  }
  if (error && (error.name === 'APIUserAbortError' || error.name === 'AbortError')) {
    return { message: 'The request was cancelled.', code: 'cancelled' };
  }
  return { message: 'Something went wrong generating that. Please try again.', code: 'ai_failed' };
}

module.exports = async (req, res) => {
  const log = createLogger('ai', req);
  if (applyCors(req, res, 'POST,OPTIONS')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', reqId: log.reqId });
  }

  const userId = await requireAuth(req, res);
  if (!userId) return;

  const { task: taskName, input } = req.body || {};
  const task = Object.prototype.hasOwnProperty.call(TASKS, taskName) ? TASKS[taskName] : null;
  if (!task || !input || typeof input !== 'object') {
    log.warn('bad request', { userId, task: String(taskName).slice(0, 40) });
    return res.status(400).json({
      error: 'This page is out of date. Please refresh and try again.',
      code: 'bad_request',
      reqId: log.reqId,
    });
  }

  try {
    const access = await entitlement.check(userId);
    if (!access.allowed) {
      return res.status(402).json({
        error: 'Your free trial has ended. Subscribe to keep planning meals.',
        code: 'subscription_required',
        reqId: log.reqId,
      });
    }

    if (
      await rateLimit.enforce(req, res, {
        bucket: 'ai:burst',
        id: userId,
        max: 40,
        windowSeconds: 60,
        message: 'You are going a little fast. Please wait a moment and try again.',
      })
    ) {
      return;
    }
    if (
      await rateLimit.enforce(req, res, {
        bucket: `ai:${taskName}`,
        id: userId,
        max: Math.ceil(task.dailyLimit * LIMIT_MULTIPLIER),
        windowSeconds: DAY,
        message: "You have reached today's limit for this feature. It resets tomorrow.",
      })
    ) {
      log.warn('daily limit reached', { userId, task: taskName });
      return;
    }
  } catch (error) {
    log.error('pre-flight failed', { userId, ...errFields(error) });
    return res.status(error.status || 500).json({ error: 'Service temporarily unavailable', reqId: log.reqId });
  }

  // From here on the reply is a stream.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (event) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };

  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  let stage = 'Starting';
  let lastSent = 0;
  const onProgress = (nextStage, chars) => {
    stage = nextStage;
    const now = Date.now();
    if (now - lastSent < 500) return;
    lastSent = now;
    send({ type: 'progress', stage, chars });
  };
  send({ type: 'progress', stage, chars: 0 });
  // Keep the connection warm while the model is thinking and no text flows.
  const heartbeat = setInterval(() => send({ type: 'progress', stage }), 8000);

  const started = Date.now();
  const usage = [];
  try {
    const data = await task.handler(input, { generate, onProgress, signal: abort.signal, usage });
    log.info('task ok', {
      userId,
      task: taskName,
      model: MODEL,
      durationMs: Date.now() - started,
      calls: usage.length,
      inputTokens: usage.reduce((n, u) => n + (u.input_tokens || 0), 0),
      outputTokens: usage.reduce((n, u) => n + (u.output_tokens || 0), 0),
    });
    send({ type: 'result', data });
  } catch (error) {
    const { message, code } = friendlyError(error);
    const level = code === 'bad_request' || code === 'cancelled' ? 'warn' : 'error';
    log[level]('task failed', { userId, task: taskName, code, durationMs: Date.now() - started, ...errFields(error) });
    // Do not count our failures against the user's daily allowance.
    await rateLimit.refund(`ai:${taskName}`, userId, DAY);
    send({ type: 'error', error: message, code, reqId: log.reqId });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
};
