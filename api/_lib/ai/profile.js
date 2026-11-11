// Turn whatever the browser sends into a clean, bounded profile and pantry.
// Everything the AI sees about a household goes through here, so prompts never
// contain oversized or malformed input.

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

function text(value, max = 200) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function list(value, maxItems = 40, maxLen = 80) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const item = text(raw, maxLen);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function number(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function splitCommas(value, maxItems = 30) {
  return list(text(value, 600).split(/[,;\n]/), maxItems);
}

function normalizeProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};

  const mealTypes = list(p.mealTypes).filter((m) => MEAL_TYPES.includes(m));
  const dislikedFoods = list([...list(p.dislikedFoods, 60), ...splitCommas(p.customDislikedFoods)], 60);
  const allergies = list([
    ...(Array.isArray(p.allergies) ? p.allergies : splitCommas(p.allergies)),
  ]);

  const targets = p.nutritionalTargets && typeof p.nutritionalTargets === 'object' ? p.nutritionalTargets : {};
  const dairy = p.dairyPreferences && typeof p.dairyPreferences === 'object' ? p.dairyPreferences : {};

  return {
    adults: Math.round(number(p.adults, 1, 1, 12)),
    kids: Math.round(number(p.kids, 0, 0, 12)),
    kidAges: list(p.kidAges, 12, 10),
    weeklyBudget: Math.round(number(p.weeklyBudget, 100, 10, 5000) * 100) / 100,
    stickToBudget: p.stickToBudget === true,
    zipCode: text(p.zipCode, 10).replace(/[^0-9-]/g, ''),
    cookingTools: list(p.cookingTools, 20),
    skillLevel: text(p.skillLevel, 40) || 'Intermediate',
    mealDifficulty: text(p.mealDifficulty, 40) || 'Medium (15-30 min)',
    dietType: text(p.dietType, 40) || 'None',
    customDiet: text(p.customDiet, 300),
    cuisineTypes: list(p.cuisineTypes, 20),
    customCuisines: text(p.customCuisines, 300),
    dietaryRestrictions: text(
      Array.isArray(p.restrictions) && p.restrictions.length
        ? [p.dietaryRestrictions, ...p.restrictions].filter(Boolean).join(', ')
        : p.dietaryRestrictions,
      500
    ),
    allergies,
    dislikedFoods,
    foodGoals: list(p.foodGoals, 12),
    mealTypes: mealTypes.length ? mealTypes : MEAL_TYPES.slice(),
    snackTypes: list(p.snackTypes, 6),
    prepStyle: text(p.prepStyle, 40) || 'Cook Every Meal',
    dairyPreferences: {
      milk: text(dairy.milk, 40),
      eggs: text(dairy.eggs, 40),
    },
    nutritionalTargets: targets.trackNutrition
      ? {
          calories: number(targets.dailyCalories, 2000, 800, 6000),
          protein: number(targets.dailyProtein, 50, 0, 500),
          carbs: number(targets.dailyCarbs, 300, 0, 1000),
          fat: number(targets.dailyFat, 65, 0, 400),
          fiber: number(targets.dailyFiber, 25, 0, 150),
          sugar: number(targets.dailySugar, 50, 0, 500),
          sodium: number(targets.dailySodium, 2300, 0, 10000),
          cholesterol: number(targets.dailyCholesterol, 300, 0, 2000),
        }
      : null,
    favoriteRecipes: list(p.favoriteRecipes, 30, 120),
    dislikedRecipes: list(p.dislikedRecipes, 60, 120),
  };
}

function normalizePantry(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item) continue;
    const name = text(typeof item === 'string' ? item : item.name, 100);
    if (!name) continue;
    const quantity = [text(item.quantity, 40), text(item.unit, 20)].filter(Boolean).join(' ');
    out.push({ name, quantity, category: text(item.category, 40) });
    if (out.length >= 300) break;
  }
  return out;
}

// A meal as stored in a meal plan, reduced to the fields prompts need.
function normalizeMeal(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  return {
    name: text(m.name, 160),
    estimatedCost: number(m.estimatedCost, 0, 0, 1000),
    cookingTime: number(m.cookingTime, 0, 0, 1440),
    ingredients: list(m.ingredients, 40, 160),
  };
}

function householdSize(profile) {
  return profile.adults + profile.kids;
}

function mealKeys(profile) {
  return profile.mealTypes.map((m) => m.toLowerCase());
}

module.exports = {
  MEAL_TYPES,
  text,
  list,
  number,
  normalizeProfile,
  normalizePantry,
  normalizeMeal,
  householdSize,
  mealKeys,
};
