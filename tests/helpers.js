// Test helpers: fake request/response objects and a stubbed auth module so the
// API handlers can be exercised without Clerk, Redis or the Claude API.
const path = require('path');

function stubModule(relativePath, exports) {
  const resolved = require.resolve(path.join('..', relativePath));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

function stubAuth(userIdRef) {
  stubModule('api/_lib/auth.js', {
    applyCors: (req, res) => {
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
      }
      return false;
    },
    requireAuth: async (req, res) => {
      if (!userIdRef.current) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
      }
      return userIdRef.current;
    },
    ALLOWED_ORIGINS: [],
  });
}

function mockReq({ method = 'GET', query = {}, body, headers = {} } = {}) {
  return { method, query, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, socket: {} };
}

function mockRes() {
  const listeners = {};
  const res = {
    statusCode: 200,
    headers: {},
    chunks: [],
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.writableEnded = true;
      return this;
    },
    write(chunk) {
      this.chunks.push(String(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) this.chunks.push(String(chunk));
      this.writableEnded = true;
      return this;
    },
    on(event, fn) {
      listeners[event] = fn;
      return this;
    },
    events() {
      return this.chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
  return res;
}

const NUTRITION = { calories: 500, protein: 30, carbs: 50, fat: 15, fiber: 6, sugar: 8, sodium: 600, cholesterol: 80 };
const meal = (name, cost = 5, ingredients = ['1 lb chicken thighs', '2 cups rice']) => ({
  name,
  estimatedCost: cost,
  cookingTime: 25,
  difficulty: 'easy',
  nutrition: NUTRITION,
  ingredients,
});
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekPlan = (cost = 4, overrides = {}) => ({
  days: DAYS.map((day) => ({
    day,
    meals: {
      breakfast: meal(`${day} oatmeal`, cost, ['1 cup oats', '1 banana']),
      lunch: meal(`${day} rice bowl`, cost),
      dinner: meal(`${day} chicken dinner`, cost),
      ...(overrides[day] || {}),
    },
  })),
});

const PROFILE = {
  adults: 2,
  kids: 1,
  weeklyBudget: 120,
  mealTypes: ['Breakfast', 'Lunch', 'Dinner'],
  dislikedFoods: ['Mushrooms', 'Tomatoes'],
  cookingTools: ['Stove', 'Oven'],
  prepStyle: 'Cook Every Meal',
};

module.exports = { stubModule, stubAuth, mockReq, mockRes, meal, weekPlan, DAYS, PROFILE };
