// Local end-to-end test server: serves the built web app and runs the real API
// handlers, with sign-in and the Claude call replaced by stand-ins so the whole
// app can be exercised in a browser without any external service.
//
//   npm run build --prefix web-app && node tests/e2e/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { stubModule } = require('../helpers');

const ROOT = path.join(__dirname, '..', '..');
const BUILD = path.join(ROOT, 'web-app', 'build');

// --- stand-ins ---------------------------------------------------------------
stubModule('api/_lib/auth.js', {
  applyCors: (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return true;
    }
    return false;
  },
  requireAuth: async (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token.startsWith('test-token:')) {
      res.status(401).json({ error: 'Authentication required' });
      return null;
    }
    return token.slice('test-token:'.length);
  },
  ALLOWED_ORIGINS: [],
});

const NUTRITION = { calories: 520, protein: 32, carbs: 48, fat: 18, fiber: 6, sugar: 7, sodium: 640, cholesterol: 85 };
const DISHES = {
  breakfast: ['Veggie scrambled eggs with toast', 'Peanut butter banana oatmeal', 'Yogurt parfait with granola', 'Breakfast burritos', 'Cinnamon french toast', 'Egg and cheese muffins', 'Blueberry pancakes'],
  lunch: ['Chicken rice bowls', 'Turkey and cheese wraps', 'Black bean quesadillas', 'Tuna salad sandwiches', 'Leftover chili with cornbread', 'Chicken caesar salad', 'Grilled cheese with tomato soup'],
  dinner: ['Sheet-pan chicken thighs with potatoes and green beans', 'Beef tacos with rice', 'Spaghetti with meat sauce and salad', 'Turkey chili with cornbread', 'Baked salmon with rice and broccoli', 'Chicken stir-fry with rice', 'Slow-roasted pork with mashed potatoes'],
};
const fakeMeal = (name, cost) => ({
  name,
  estimatedCost: cost,
  cookingTime: 25,
  difficulty: 'easy',
  nutrition: NUTRITION,
  ingredients: ['1.5 lb chicken thighs', '2 cups long grain rice', '1 lb frozen broccoli', '2 tbsp vegetable oil', 'salt and pepper'],
});
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COST = { breakfast: 2.5, lunch: 4.25, dinner: 7.5 };

let replacements = 0;
function fakeReply(schema) {
  const props = schema.properties;
  const dayMeals = (keys, index) => {
    const meals = {};
    for (const key of keys) meals[key] = key === 'snacks' ? ['Apple slices', 'Cheese sticks'] : fakeMeal(DISHES[key][index], COST[key]);
    return meals;
  };
  if (props.days) {
    const keys = Object.keys(props.days.items.properties.meals.properties);
    return { days: DAYS.map((day, i) => ({ day, meals: dayMeals(keys, i) })) };
  }
  if (props.meals) return { meals: dayMeals(Object.keys(props.meals.properties), 3) };
  if (props.sections) {
    return {
      sections: [
        { category: 'Produce', items: [
          { name: 'Bananas', quantity: 3, unit: 'lb', estimatedPrice: 1.74, searchTerm: 'bananas' },
          { name: 'Russet Potatoes, 5 lb bag', quantity: 1, unit: '5 lb bag', estimatedPrice: 3.97, searchTerm: 'russet potatoes 5 lb' } ] },
        { category: 'Meat & Seafood', items: [
          { name: 'Chicken Thighs Family Pack', quantity: 2, unit: '4.7 lb pack', estimatedPrice: 22.6, searchTerm: 'chicken thighs family pack' } ] },
        { category: 'Dairy & Eggs', items: [
          { name: 'Great Value 2% Milk, 1 gallon', quantity: 1, unit: 'gallon', estimatedPrice: 3.34, searchTerm: 'great value 2% milk gallon' },
          { name: 'Great Value Large White Eggs, 18 ct', quantity: 1, unit: '18 count', estimatedPrice: 4.12, searchTerm: 'great value large eggs 18' } ] },
      ],
      moneySavingTips: ['Buy the family pack of chicken and freeze half.', 'Store-brand rice is half the price per pound.'],
    };
  }
  if (props.instructions) {
    return {
      name: 'Recipe', servings: 3, cookingTime: 35, cost: 7.5,
      ingredients: ['1.5 lb chicken thighs', '2 cups rice', '1 lb broccoli'],
      instructions: ['Heat the oven to 425°F.', 'Season the chicken and roast for 30 minutes.', 'Cook the rice and steam the broccoli.'],
      nutrition: { calories: 520, protein: 32, carbs: 48, fat: 18 },
      tips: { storage: 'Refrigerate for up to 3 days.', reheating: 'Microwave for 2 minutes.', mealPrepTips: [] },
    };
  }
  if (props.meal && props.recipe) {
    return { meal: 'Cheesy rice and egg skillet', recipe: { ingredients: ['2 cups rice', '4 eggs'], instructions: ['Cook the rice.', 'Scramble in the eggs.'], cookingTime: 15, servings: 3, estimatedCost: 2.1 } };
  }
  if (props.items) {
    return { items: [
      { name: 'Whole Milk', brand: 'Great Value', quantity: '1 gallon', category: 'Dairy', confidence: 96, expiryDate: '' },
      { name: 'Black Beans', brand: 'Bush\'s', quantity: '2 cans', category: 'Canned', confidence: 91, expiryDate: '' } ] };
  }
  replacements += 1;
  return fakeMeal(`Garlic butter shrimp pasta #${replacements}`, 8.25);
}

class AiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const aiState = { failNext: 0, calls: [] };
stubModule('api/_lib/ai/runner.js', {
  MODEL: 'e2e-fake',
  AiError,
  generate: async ({ schema, system, messages, onProgress }) => {
    aiState.calls.push({ system, messages });
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (aiState.failNext > 0) {
      aiState.failNext -= 1;
      throw Object.assign(new Error('overloaded'), { status: 529 });
    }
    if (onProgress) onProgress(500);
    const data = fakeReply(schema);
    return { data, content: [{ type: 'text', text: JSON.stringify(data) }], usage: { input_tokens: 100, output_tokens: 200 } };
  },
});

// --- routing -----------------------------------------------------------------
const handlers = {
  ai: require('../../api/ai'),
  kv: require('../../api/kv'),
  share: require('../../api/share'),
  barcode: require('../../api/barcode/[barcode]'),
  payments: require('../../api/payments/[action]'),
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

function decorate(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts[0] === '__test') {
    if (parts[1] === 'fail-ai') aiState.failNext = Number(url.searchParams.get('n') || 1);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ calls: aiState.calls.length, lastCall: aiState.calls[aiState.calls.length - 1] || null }));
  }

  if (parts[0] === 'api') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    req.query = Object.fromEntries(url.searchParams);
    try {
      req.body = raw ? JSON.parse(raw) : undefined;
    } catch {
      req.body = undefined;
    }
    if (parts[1] === 'barcode') req.query.barcode = parts[2];
    if (parts[1] === 'payments') req.query.action = parts[2];
    const handler = handlers[parts[1]];
    if (!handler) return decorate(res).status(404).json({ error: 'Not found' });
    try {
      return await handler(req, decorate(res));
    } catch (error) {
      console.error('handler crashed', error);
      if (!res.writableEnded) decorate(res).status(500).json({ error: 'crash' });
      return undefined;
    }
  }

  // Static files with the same single-page fallback as vercel.json.
  let file = path.join(BUILD, path.normalize(url.pathname));
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(BUILD, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  return fs.createReadStream(file).pipe(res);
});

// Keep idle connections open longer than the browser does, so a reused
// connection is never closed underneath a request.
server.keepAliveTimeout = 120000;
const port = Number(process.env.PORT) || 4173;
server.listen(port, () => console.log(`e2e server on http://localhost:${port}`));
