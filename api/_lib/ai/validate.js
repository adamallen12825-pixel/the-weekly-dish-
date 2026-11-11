// Checks and clean-up applied to what the model returns. Hard requirements are
// verified here in code instead of being asked for repeatedly in the prompt.

const { text, mealKeys } = require('./profile');
const { SHOPPING_CATEGORIES } = require('./schemas');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const whole = (n) => Math.max(0, Math.round(Number(n) || 0));
const strings = (value, max = 60, len = 200) =>
  (Array.isArray(value) ? value : [])
    .map((v) => text(typeof v === 'string' ? v : v && v.name, len))
    .filter(Boolean)
    .slice(0, max);

function cleanMeal(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const n = m.nutrition && typeof m.nutrition === 'object' ? m.nutrition : {};
  return {
    name: text(m.name, 160),
    estimatedCost: Math.max(0, cents(m.estimatedCost)),
    cookingTime: whole(m.cookingTime),
    difficulty: ['easy', 'medium', 'hard'].includes(m.difficulty) ? m.difficulty : 'medium',
    nutrition: {
      calories: whole(n.calories),
      protein: whole(n.protein),
      carbs: whole(n.carbs),
      fat: whole(n.fat),
      fiber: whole(n.fiber),
      sugar: whole(n.sugar),
      sodium: whole(n.sodium),
      cholesterol: whole(n.cholesterol),
    },
    ingredients: strings(m.ingredients),
  };
}

function cleanDayMeals(raw, profile) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const meals = {};
  for (const key of mealKeys(profile)) {
    if (source[key] && source[key].name) meals[key] = cleanMeal(source[key]);
  }
  if (profile.snackTypes.length) meals.snacks = strings(source.snacks, 6, 120);
  return meals;
}

// Build the seven-day plan the app stores, in Monday-Sunday order.
function buildPlan(data, profile) {
  const byDay = new Map();
  for (const entry of Array.isArray(data && data.days) ? data.days : []) {
    if (entry && DAYS.includes(entry.day) && !byDay.has(entry.day)) {
      byDay.set(entry.day, cleanDayMeals(entry.meals, profile));
    }
  }
  return { days: DAYS.filter((d) => byDay.has(d)).map((day) => ({ day, meals: byDay.get(day) })) };
}

// Weekly meal prep: one day of meals repeated for the whole week.
function buildMealPrepPlan(data, profile) {
  const meals = cleanDayMeals(data && data.meals, profile);
  return { days: DAYS.map((day) => ({ day, meals: JSON.parse(JSON.stringify(meals)) })) };
}

function planTotal(plan) {
  let total = 0;
  for (const day of plan.days) {
    for (const key of MEAL_KEYS) total += (day.meals[key] && day.meals[key].estimatedCost) || 0;
  }
  return cents(total);
}

// Word forms to look for when checking for an avoided food ("Tomatoes" also
// catches "tomato sauce").
function termPattern(term) {
  const base = term.toLowerCase().trim();
  if (!base) return null;
  const forms = new Set([base]);
  if (base.endsWith('ies')) forms.add(`${base.slice(0, -3)}y`);
  else if (base.endsWith('oes')) forms.add(base.slice(0, -2));
  else if (base.endsWith('s') && !base.endsWith('ss')) forms.add(base.slice(0, -1));
  else forms.add(`${base}s`);
  const escaped = Array.from(forms).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(^|[^a-z])(${escaped.join('|')})(?![a-z])`, 'i');
}

function findAvoided(meal, patterns) {
  const haystack = [meal.name, ...(meal.ingredients || [])].join(' | ');
  return patterns.filter((p) => p.regex.test(haystack)).map((p) => p.term);
}

function avoidedPatterns(profile) {
  return [...profile.allergies, ...profile.dislikedFoods]
    .map((term) => ({ term, regex: termPattern(term) }))
    .filter((p) => p.regex);
}

// Returns { structural, soft }: structural problems make the plan unusable,
// soft problems are worth one correction pass and are otherwise reported.
function checkPlan(plan, profile, { repeatedWeek = false } = {}) {
  const structural = [];
  const soft = [];
  const required = mealKeys(profile);
  const patterns = avoidedPatterns(profile);

  const present = new Set(plan.days.map((d) => d.day));
  const missingDays = DAYS.filter((d) => !present.has(d));
  if (missingDays.length) structural.push(`The plan is missing these days: ${missingDays.join(', ')}.`);

  const reported = new Set();
  for (const day of plan.days) {
    const missing = required.filter((key) => !day.meals[key]);
    if (missing.length) structural.push(`${day.day} is missing ${missing.join(' and ')}.`);
    for (const key of required) {
      const meal = day.meals[key];
      if (!meal) continue;
      const hits = findAvoided(meal, patterns);
      const id = `${meal.name}|${hits.join(',')}`;
      if (hits.length && !reported.has(id)) {
        reported.add(id);
        soft.push(
          `${repeatedWeek ? 'The' : `${day.day}'s`} ${key} "${meal.name}" includes ${hits.join(', ')}, which this household does not eat. Replace it with a dish that has none of it.`
        );
      }
    }
    if (repeatedWeek) break;
  }

  const total = planTotal(plan);
  const budget = profile.weeklyBudget;
  if (total > budget * 1.02) {
    soft.push(
      `The meals add up to $${total.toFixed(2)} for the week, which is $${(total - budget).toFixed(2)} over the $${budget.toFixed(
        2
      )} budget. Swap the most expensive meals for cheaper ones and keep the cost estimates honest.`
    );
  }
  return { structural, soft, total };
}

const SECTION_ORDER = new Map(SHOPPING_CATEGORIES.map((c, i) => [c, i]));

function buildShoppingList(data, profile) {
  const merged = new Map();
  for (const section of Array.isArray(data && data.sections) ? data.sections : []) {
    const category = SECTION_ORDER.has(section && section.category) ? section.category : 'Other';
    const items = merged.get(category) || [];
    for (const raw of Array.isArray(section && section.items) ? section.items : []) {
      const name = text(raw && raw.name, 160);
      if (!name) continue;
      const quantity = Number(raw.quantity) > 0 ? Math.round(Number(raw.quantity) * 100) / 100 : 1;
      items.push({
        name,
        quantity,
        unit: text(raw.unit, 60),
        estimatedPrice: Math.max(0, cents(raw.estimatedPrice)),
        searchTerm: text(raw.searchTerm, 80) || name,
      });
    }
    if (items.length) merged.set(category, items);
  }
  const sections = Array.from(merged.entries())
    .sort((a, b) => SECTION_ORDER.get(a[0]) - SECTION_ORDER.get(b[0]))
    .map(([category, items]) => ({ category, items }));
  const totalCost = cents(sections.reduce((sum, s) => sum + s.items.reduce((t, i) => t + i.estimatedPrice, 0), 0));
  return {
    shoppingList: { sections, totalCost },
    totalCost,
    weeklyBudget: profile.weeklyBudget,
    moneySavingTips: strings(data && data.moneySavingTips, 6, 300),
  };
}

function cleanRecipe(data, { name, servings, isMealPrep, baseServings }) {
  const r = data && typeof data === 'object' ? data : {};
  const n = r.nutrition || {};
  const tips = r.tips || {};
  const prepTips = strings(tips.mealPrepTips, 10, 300);
  const recipe = {
    name: text(r.name, 160) || name,
    servings: whole(r.servings) || servings,
    cookingTime: whole(r.cookingTime) || 30,
    cost: Math.max(0, cents(r.cost)),
    isMealPrep,
    ingredients: strings(r.ingredients, 60, 300),
    instructions: strings(r.instructions, 40, 1200),
    nutrition: {
      calories: whole(n.calories),
      protein: whole(n.protein),
      carbs: whole(n.carbs),
      fat: whole(n.fat),
    },
    tips: {
      storage: text(tips.storage, 800),
      reheating: text(tips.reheating, 800),
      mealPrepTips: isMealPrep && prepTips.length ? prepTips : null,
    },
  };
  if (isMealPrep) {
    recipe.servings = servings;
    recipe.baseDailyServings = baseServings;
  }
  return recipe;
}

function cleanQuickMeal(data) {
  const r = (data && data.recipe) || {};
  return {
    meal: text(data && data.meal, 160),
    recipe: {
      ingredients: strings(r.ingredients, 60, 300),
      instructions: strings(r.instructions, 40, 1200),
      cookingTime: whole(r.cookingTime) || 20,
      servings: whole(r.servings) || 1,
      estimatedCost: Math.max(0, cents(r.estimatedCost)),
    },
  };
}

function cleanPantryScan(data) {
  const seen = new Set();
  const items = [];
  for (const raw of Array.isArray(data && data.items) ? data.items : []) {
    const name = text(raw && raw.name, 100);
    const brand = text(raw.brand, 60);
    const key = `${brand}|${name}`.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    items.push({
      name,
      brand,
      quantity: text(raw.quantity, 40) || '1 item',
      category: text(raw.category, 40) || 'Other',
      confidence: Math.min(100, whole(raw.confidence)),
      expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.expiryDate || '') ? raw.expiryDate : '',
    });
    if (items.length >= 80) break;
  }
  return items;
}

module.exports = {
  DAYS,
  MEAL_KEYS,
  cents,
  cleanMeal,
  buildPlan,
  buildMealPrepPlan,
  planTotal,
  checkPlan,
  termPattern,
  findAvoided,
  avoidedPatterns,
  buildShoppingList,
  cleanRecipe,
  cleanQuickMeal,
  cleanPantryScan,
};
