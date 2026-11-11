// Shared meal plans.
//
//   POST /api/share            (signed in)  { plan: { days }, sharedBy } -> { id }
//   GET  /api/share?id=<id>    (public)     -> { days, sharedBy, sharedDate }
//
// The plan is stored on the server under a short random id, so share links are
// short, never break on special characters and work for any size of plan.
// A shared plan contains only meal details: no email, profile or pantry data.

const crypto = require('crypto');
const { applyCors, requireAuth } = require('./_lib/auth');
const { createLogger, errFields } = require('./_lib/log');
const store = require('./_lib/store');
const rateLimit = require('./_lib/rateLimit');
const { cleanMeal, MEAL_KEYS, DAYS } = require('./_lib/ai/validate');
const { text, list } = require('./_lib/ai/profile');

const TTL_SECONDS = 180 * 24 * 60 * 60;
const ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

function cleanPlan(raw) {
  const days = Array.isArray(raw && raw.days) ? raw.days.slice(0, 7) : [];
  return days
    .map((day, index) => {
      const source = (day && day.meals) || {};
      const meals = {};
      for (const key of MEAL_KEYS) {
        if (source[key] && source[key].name) meals[key] = cleanMeal(source[key]);
      }
      const snacks = list(
        (Array.isArray(source.snacks) ? source.snacks : []).map((s) => (typeof s === 'string' ? s : s && s.name)),
        8,
        120
      );
      if (snacks.length) meals.snacks = snacks;
      return { day: text(day && day.day, 12) || DAYS[index], meals };
    })
    .filter((day) => Object.keys(day.meals).length > 0);
}

module.exports = async (req, res) => {
  const log = createLogger('share', req);
  if (applyCors(req, res, 'GET,POST,OPTIONS')) return;

  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (!ID_PATTERN.test(id)) return res.status(404).json({ error: 'Not found' });
      if (await rateLimit.enforce(req, res, { bucket: 'share:read', id: rateLimit.clientIp(req), max: 60, windowSeconds: 60 })) return;
      const shared = await store.get(`share:${id}`);
      if (!shared) return res.status(404).json({ error: 'Not found' });
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).json(shared);
    }

    if (req.method === 'POST') {
      const userId = await requireAuth(req, res);
      if (!userId) return;
      if (
        await rateLimit.enforce(req, res, {
          bucket: 'share:create',
          id: userId,
          max: 30,
          windowSeconds: 24 * 60 * 60,
          message: "You have reached today's limit for share links.",
        })
      ) {
        return;
      }
      const body = req.body || {};
      const days = cleanPlan(body.plan);
      if (!days.length) return res.status(400).json({ error: 'There is no meal plan to share.', reqId: log.reqId });

      const id = crypto.randomBytes(9).toString('base64url');
      await store.set(
        `share:${id}`,
        { days, sharedBy: text(body.sharedBy, 40) || 'A Weekly Dish User', sharedDate: new Date().toISOString() },
        TTL_SECONDS
      );
      log.info('created', { userId, days: days.length });
      return res.status(200).json({ id });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    log.error('share error', { method: req.method, ...errFields(error) });
    return res.status(error.status || 500).json({ error: 'Could not process the share link', reqId: log.reqId });
  }
};
