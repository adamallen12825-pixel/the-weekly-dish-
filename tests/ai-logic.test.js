const test = require('node:test');
const assert = require('node:assert/strict');
const { meal, weekPlan, PROFILE } = require('./helpers');
const { TASKS } = require('../api/_lib/ai/tasks');
const validate = require('../api/_lib/ai/validate');
const { normalizeProfile } = require('../api/_lib/ai/profile');
const prompts = require('../api/_lib/ai/prompts');
const schemas = require('../api/_lib/ai/schemas');

// A stand-in for Claude: replies with the queued responses in order and
// records every request it was sent.
function fakeModel(replies) {
  const calls = [];
  const generate = async (request) => {
    calls.push(request);
    const data = replies[Math.min(calls.length - 1, replies.length - 1)];
    return { data, content: [{ type: 'text', text: JSON.stringify(data) }], usage: { input_tokens: 10, output_tokens: 20 } };
  };
  return { generate, calls };
}
const ctx = (model) => ({ generate: model.generate, usage: [] });

test('avoided-food matching catches other word forms but not lookalikes', () => {
  const hit = (term, textValue) => validate.termPattern(term).test(textValue);
  assert.ok(hit('Tomatoes', '1 can tomato sauce'));
  assert.ok(hit('Mushrooms', 'Chicken and mushroom risotto'));
  assert.ok(hit('Onions', 'green onions, sliced'));
  assert.ok(hit('Fish', '2 tbsp fish sauce'));
  assert.ok(hit('Blue Cheese', 'crumbled blue cheese'));
  assert.ok(!hit('Ginger', 'gingerbread cookies'));
  assert.ok(!hit('Beets', 'beef stew'));
  assert.ok(!hit('Liver', 'olive oil'));
});

test('structured-output schemas follow the API rules', () => {
  const walk = (schema, path = 'root') => {
    if (schema.type === 'object') {
      assert.equal(schema.additionalProperties, false, `${path} must set additionalProperties:false`);
      assert.deepEqual(schema.required, Object.keys(schema.properties), `${path} must require every property`);
      for (const [key, child] of Object.entries(schema.properties)) walk(child, `${path}.${key}`);
    }
    if (schema.type === 'array') walk(schema.items, `${path}[]`);
    for (const banned of ['minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength']) {
      assert.ok(!(banned in schema), `${path} uses unsupported keyword ${banned}`);
    }
  };
  walk(schemas.mealPlan(['breakfast', 'dinner'], true));
  walk(schemas.mealPrepDay(['dinner'], false));
  walk(schemas.shoppingList);
  walk(schemas.recipe);
  walk(schemas.quickMeal);
  walk(schemas.pantryScan);
  walk(schemas.meal);
  assert.deepEqual(Object.keys(schemas.mealPlan(['dinner'], false).properties.days.items.properties.meals.properties), ['dinner']);
});

test('meal plan: a good plan is returned after a single model call', async () => {
  const model = fakeModel([weekPlan(4)]);
  const plan = await TASKS.mealPlan.handler({ profile: PROFILE, pantryItems: [{ name: 'Rice', quantity: '2 lb' }] }, ctx(model));
  assert.equal(model.calls.length, 1);
  assert.equal(plan.days.length, 7);
  assert.equal(plan.days[0].day, 'Monday');
  assert.equal(plan.estimatedTotal, 84);
  assert.deepEqual(plan.warnings, []);
  assert.match(model.calls[0].messages[0].content, /Rice \(2 lb\)/);
  assert.match(model.calls[0].messages[0].content, /Mushrooms, Tomatoes/);
  assert.equal(model.calls[0].schema.properties.days.type, 'array');
});

test('meal plan: over budget triggers one correction pass with the exact overage', async () => {
  const model = fakeModel([weekPlan(8), weekPlan(5)]);
  const plan = await TASKS.mealPlan.handler({ profile: PROFILE, pantryItems: [] }, ctx(model));
  assert.equal(model.calls.length, 2);
  const repair = model.calls[1].messages;
  assert.equal(repair.length, 3);
  assert.equal(repair[1].role, 'assistant');
  assert.match(repair[2].content, /\$168\.00.*\$48\.00 over the \$120\.00 budget/);
  assert.equal(plan.estimatedTotal, 105);
  assert.deepEqual(plan.warnings, []);
});

test('meal plan: an avoided food is caught and corrected', async () => {
  const bad = weekPlan(4, { Wednesday: { dinner: meal('Pasta with mushroom cream sauce', 4, ['8 oz pasta', '8 oz mushrooms']) } });
  const model = fakeModel([bad, weekPlan(4)]);
  const plan = await TASKS.mealPlan.handler({ profile: PROFILE }, ctx(model));
  assert.equal(model.calls.length, 2);
  assert.match(model.calls[1].messages[2].content, /Wednesday's dinner "Pasta with mushroom cream sauce" includes Mushrooms/);
  assert.ok(!JSON.stringify(plan.days).toLowerCase().includes('mushroom'));
});

test('meal plan: remaining issues are reported honestly, missing days are an error', async () => {
  const overBudget = fakeModel([weekPlan(9), weekPlan(8)]);
  const plan = await TASKS.mealPlan.handler({ profile: PROFILE }, ctx(overBudget));
  assert.equal(plan.estimatedTotal, 168);
  assert.equal(plan.warnings.length, 1);

  const short = { days: weekPlan(4).days.slice(0, 5) };
  await assert.rejects(TASKS.mealPlan.handler({ profile: PROFILE }, ctx(fakeModel([short, short]))), { code: 'incomplete_plan' });
});

test('meal plan: only the chosen meal types are requested and kept', async () => {
  const model = fakeModel([weekPlan(6)]);
  const plan = await TASKS.mealPlan.handler({ profile: { ...PROFILE, mealTypes: ['Dinner'] } }, ctx(model));
  assert.deepEqual(Object.keys(plan.days[0].meals), ['dinner']);
  assert.equal(plan.estimatedTotal, 42);
  assert.deepEqual(Object.keys(model.calls[0].schema.properties.days.items.properties.meals.properties), ['dinner']);
});

test('meal plan: weekly meal prep generates one day and repeats it', async () => {
  const oneDay = { meals: { breakfast: meal('Egg muffins', 3), lunch: meal('Chicken rice bowls', 5), dinner: meal('Turkey chili', 6), snacks: ['Apple slices'] } };
  const model = fakeModel([oneDay]);
  const plan = await TASKS.mealPlan.handler(
    { profile: { ...PROFILE, prepStyle: 'Weekly Meal Prep', snackTypes: ['Healthy Snacks'] } },
    ctx(model)
  );
  assert.equal(model.calls.length, 1);
  assert.ok(model.calls[0].schema.properties.meals, 'uses the single-day schema');
  assert.equal(plan.days.length, 7);
  assert.ok(plan.days.every((d) => d.meals.dinner.name === 'Turkey chili' && d.meals.snacks[0] === 'Apple slices'));
  assert.equal(plan.estimatedTotal, 98);
});

const list = (price) => ({
  sections: [
    { category: 'Dairy & Eggs', items: [{ name: 'Great Value Large White Eggs, 12 ct', quantity: 1, unit: 'dozen', estimatedPrice: 3.12, searchTerm: 'great value large eggs dozen' }] },
    { category: 'Produce', items: [{ name: 'Bananas', quantity: 3, unit: 'lb', estimatedPrice: 1.74, searchTerm: 'bananas' }] },
    { category: 'Meat & Seafood', items: [{ name: 'Chicken thighs, family pack', quantity: 2, unit: '5 lb pack', estimatedPrice: price, searchTerm: 'chicken thighs family pack' }] },
  ],
  moneySavingTips: ['Buy the family pack of chicken and freeze half.'],
});

test('shopping list: totals are computed in code and sections follow store order', async () => {
  const model = fakeModel([list(20)]);
  const result = await TASKS.shoppingList.handler({ profile: PROFILE, mealPlan: weekPlan(4), pantryItems: [] }, ctx(model));
  assert.equal(model.calls.length, 1);
  assert.equal(result.totalCost, 24.86);
  assert.equal(result.shoppingList.totalCost, 24.86);
  assert.equal(result.overBudgetBy, 0);
  assert.deepEqual(result.shoppingList.sections.map((s) => s.category), ['Produce', 'Meat & Seafood', 'Dairy & Eggs']);
  const prompt = model.calls[0].messages[0].content;
  assert.match(prompt, /cooked 1 time: Monday chicken dinner\. Ingredients for one cooking: 1 lb chicken thighs; 2 cups rice/);
});

test('shopping list: over budget triggers a correction and keeps the cheaper list', async () => {
  const model = fakeModel([list(150), list(100)]);
  const result = await TASKS.shoppingList.handler({ profile: PROFILE, mealPlan: weekPlan(4) }, ctx(model));
  assert.equal(model.calls.length, 2);
  assert.match(model.calls[1].messages[2].content, /\$154\.86.*\$34\.86 over the \$120\.00 budget/);
  assert.equal(result.totalCost, 104.86);
});

test('shopping list: repeated meals are counted, and a plan is required', async () => {
  const prep = { days: weekPlan(4).days.map((d) => ({ day: d.day, meals: { dinner: meal('Turkey chili', 6, ['1 lb ground turkey']) } })) };
  const summary = prompts.summarizePlan(prep);
  assert.equal(summary.meals.length, 1);
  assert.equal(summary.meals[0].count, 7);
  await assert.rejects(TASKS.shoppingList.handler({ profile: PROFILE, mealPlan: { days: [] } }, ctx(fakeModel([list(1)]))), { code: 'bad_request' });
});

test('replace meal: same dish or an avoided food gets one more try', async () => {
  const model = fakeModel([meal('Beef tacos'), meal('Turkey burgers')]);
  const result = await TASKS.replaceMeal.handler(
    { profile: PROFILE, mealType: 'dinner', currentMeal: { name: 'Beef Tacos', estimatedCost: 9 }, otherMeals: ['Chili'] },
    ctx(model)
  );
  assert.equal(model.calls.length, 2);
  assert.equal(result.name, 'Turkey burgers');
  await assert.rejects(TASKS.replaceMeal.handler({ profile: PROFILE, mealType: 'brunch', currentMeal: { name: 'x' } }, ctx(model)), { code: 'bad_request' });
});

test('custom meal keeps the name the user typed', async () => {
  const result = await TASKS.customMeal.handler(
    { profile: PROFILE, mealType: 'dinner', mealName: "Grandma's lasagna" },
    ctx(fakeModel([meal('Classic Lasagna', 14)]))
  );
  assert.equal(result.name, "Grandma's lasagna");
  assert.equal(result.estimatedCost, 14);
});

test('recipe: meal-prep recipes are scaled to the week and keep the plan name', async () => {
  const reply = {
    name: 'Turkey Chili (Batch)', servings: 3, cookingTime: 60, cost: 40,
    ingredients: ['7 lb ground turkey'], instructions: ['Brown the turkey.'],
    nutrition: { calories: 400, protein: 30, carbs: 30, fat: 12 },
    tips: { storage: 'Fridge', reheating: 'Microwave', mealPrepTips: ['Cool before sealing.'] },
  };
  const model = fakeModel([reply]);
  const result = await TASKS.recipe.handler(
    { profile: { ...PROFILE, prepStyle: 'Weekly Meal Prep' }, meal: { name: 'Turkey chili', ingredients: ['1 lb ground turkey'], estimatedCost: 6 } },
    ctx(model)
  );
  assert.equal(result.name, 'Turkey chili');
  assert.equal(result.servings, 21);
  assert.equal(result.baseDailyServings, 3);
  assert.equal(result.isMealPrep, true);
  assert.match(model.calls[0].messages[0].content, /makes 21 servings/);
  assert.match(model.calls[0].messages[0].content, /- 1 lb ground turkey/);

  const everyday = await TASKS.recipe.handler({ profile: PROFILE, meal: { name: 'Turkey chili' } }, ctx(fakeModel([reply])));
  assert.equal(everyday.tips.mealPrepTips, null);
});

test('pantry scan: validates photos and de-duplicates items', async () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from('fake').toString('base64')}`;
  const reply = { items: [
    { name: 'Whole Milk', brand: 'Great Value', quantity: '1 gallon', category: 'Dairy', confidence: 95, expiryDate: '' },
    { name: 'Whole Milk', brand: 'Great Value', quantity: '1 gallon', category: 'Dairy', confidence: 90, expiryDate: '' },
  ] };
  const model = fakeModel([reply]);
  const result = await TASKS.pantryScan.handler({ images: [jpeg, jpeg] }, ctx(model));
  assert.equal(result.items.length, 1);
  const content = model.calls[0].messages[0].content;
  assert.equal(content.filter((b) => b.type === 'image').length, 2);
  assert.equal(content[0].source.media_type, 'image/jpeg');

  const bad = (images) => assert.rejects(TASKS.pantryScan.handler({ images }, ctx(model)), { code: 'bad_request' });
  await bad([]);
  await bad(['https://example.com/a.jpg']);
  await bad(['data:image/svg+xml;base64,AAAA']);
  await bad([jpeg, jpeg, jpeg, jpeg, jpeg]);
});

test('profile input is bounded before it reaches a prompt', () => {
  const p = normalizeProfile({
    adults: 9999, weeklyBudget: -5, mealTypes: ['Brunch'], customDislikedFoods: 'okra, liver',
    dislikedFoods: Array(500).fill('x').map((x, i) => `food${i}`), customDiet: 'a'.repeat(5000),
  });
  assert.equal(p.adults, 12);
  assert.equal(p.weeklyBudget, 10);
  assert.deepEqual(p.mealTypes, ['Breakfast', 'Lunch', 'Dinner']);
  assert.equal(p.dislikedFoods.length, 60);
  assert.equal(p.customDiet.length, 300);
});
