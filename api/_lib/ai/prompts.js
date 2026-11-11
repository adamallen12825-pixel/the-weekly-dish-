// Prompts for every AI task. They live on the server: the browser sends the
// household's data and never chooses the instructions.
//
// Format rules are not repeated here. The JSON shape is enforced by the
// structured-output schema, and hard requirements (budget, avoided foods,
// seven days) are checked in code after the model answers.

const { householdSize } = require('./profile');

const money = (n) => `$${Number(n).toFixed(2)}`;

const DIET_RULES = {
  Keto: 'Ketogenic: very low carb (about 20-30 g net carbs per person per day), high fat, moderate protein. No bread, pasta, rice, potatoes, sugar or most fruit.',
  Paleo: 'Paleo: meat, fish, eggs, vegetables, fruit, nuts and seeds. No grains, legumes, dairy, refined sugar or processed foods.',
  Carnivore: 'Carnivore: animal products only (meat, fish, eggs, and dairy such as butter and cheese). No plant foods at all: no vegetables, fruit, grains, legumes, nuts, seeds or plant oils.',
  Mediterranean: 'Mediterranean: vegetables, fruit, whole grains, legumes, olive oil, fish and poultry; little red meat and few sweets.',
  Vegan: 'Vegan: no animal products of any kind (no meat, fish, eggs, dairy, honey or gelatin).',
  Vegetarian: 'Vegetarian: no meat, poultry or fish. Eggs and dairy are fine.',
  Whole30: 'Whole30: no added sugar, alcohol, grains, legumes or dairy; whole unprocessed foods only.',
  'Low FODMAP': 'Low FODMAP: avoid high-FODMAP foods such as onion, garlic, wheat, most legumes, apples, pears, honey and regular milk.',
  'Gluten-Free': 'Gluten-free: no wheat, barley, rye or anything made from them; choose certified gluten-free versions of oats, pasta, bread and sauces.',
  'Dairy-Free': 'Dairy-free: no milk, cheese, butter, cream, yogurt or whey; use non-dairy substitutes.',
};

function dietLine(profile) {
  const { dietType, customDiet } = profile;
  if (dietType === 'None' || dietType === 'Standard' || !dietType) {
    return customDiet ? `Diet: ${customDiet}` : 'Diet: no special diet.';
  }
  if (dietType === 'Other') return `Diet: ${customDiet || 'not specified'}`;
  const rule = DIET_RULES[dietType] || dietType;
  return `Diet: ${rule}${customDiet ? ` Additional notes from the household: ${customDiet}` : ''}`;
}

function budgetLine(profile) {
  const people = householdSize(profile);
  const perPersonDay = profile.weeklyBudget / (people * 7);
  const mealsPerWeek = profile.mealTypes.length * 7;
  let level;
  if (perPersonDay < 4) {
    level =
      'This is a very tight budget. It only works with inexpensive staples (rice, dried beans and lentils, eggs, oats, potatoes, cabbage, carrots, onions, frozen vegetables, bananas, peanut butter, chicken leg quarters or thighs, bulk ground meat, canned tuna) and by repeating meals and reusing the same ingredients all week. A plain, repetitive plan that fits the budget is the right answer here; a varied plan that goes over is not.';
  } else if (perPersonDay < 7) {
    level =
      'This is a tight budget. Lean on affordable staples and cheaper proteins, and reuse ingredients across meals so whole packages get used up. Some variety is welcome, but fitting the budget comes first.';
  } else {
    level = 'This budget leaves room for variety, fresh produce and a range of proteins.';
  }
  const target = profile.stickToBudget
    ? `The household wants to use most of it: aim for a weekly total between ${money(profile.weeklyBudget * 0.9)} and ${money(profile.weeklyBudget)}.`
    : `Stay at or under ${money(profile.weeklyBudget)}; spending less is fine.`;
  return `Weekly grocery budget: ${money(profile.weeklyBudget)} for ${mealsPerWeek} planned meals (about ${money(perPersonDay)} per person per day, ${money(profile.weeklyBudget / mealsPerWeek)} per meal on average). ${level} ${target}`;
}

function householdLine(profile) {
  const kids = profile.kids
    ? `, ${profile.kids} ${profile.kids === 1 ? 'child' : 'children'}${profile.kidAges.length ? ` (ages ${profile.kidAges.join(', ')})` : ''}`
    : '';
  return `Household: ${profile.adults} ${profile.adults === 1 ? 'adult' : 'adults'}${kids}.`;
}

// The household facts shared by every task. Empty preferences are left out so
// the model is not told to honor "none".
function householdBrief(profile, { includeBudget = true } = {}) {
  const lines = [householdLine(profile)];
  if (includeBudget) lines.push(budgetLine(profile));
  lines.push(dietLine(profile));
  if (profile.allergies.length) lines.push(`Allergies (never include, in any form): ${profile.allergies.join(', ')}.`);
  if (profile.dietaryRestrictions) lines.push(`Dietary restrictions: ${profile.dietaryRestrictions}`);
  if (profile.dislikedFoods.length) {
    lines.push(
      `Foods this household will not eat: ${profile.dislikedFoods.join(', ')}. Leave them out entirely, including as sides, toppings or minor ingredients, and skip dishes built around them.`
    );
  }
  if (profile.dairyPreferences.milk) {
    lines.push(
      profile.dairyPreferences.milk === 'No Milk'
        ? 'Milk: the household does not use milk; avoid recipes that need it.'
        : `Milk: whenever milk is used, it is ${profile.dairyPreferences.milk}.`
    );
  }
  if (profile.dairyPreferences.eggs) {
    lines.push(
      profile.dairyPreferences.eggs === 'No Eggs'
        ? 'Eggs: the household does not use eggs; avoid recipes that need them.'
        : `Eggs: whenever eggs are used, they are ${profile.dairyPreferences.eggs}.`
    );
  }
  lines.push(
    `Cooking equipment available: ${profile.cookingTools.length ? profile.cookingTools.join(', ') : 'a basic kitchen (stovetop, oven, microwave)'}. Only plan dishes that can be made with this equipment.`
  );
  lines.push(`Cook's skill level: ${profile.skillLevel}. Preferred effort per meal: ${profile.mealDifficulty}.`);
  const cuisines = [...profile.cuisineTypes, profile.customCuisines].filter(Boolean).join(', ');
  if (cuisines) lines.push(`Cuisines they enjoy: ${cuisines}.`);
  if (profile.foodGoals.length) lines.push(`Goals: ${profile.foodGoals.join(', ')}.`);
  if (profile.nutritionalTargets) {
    const t = profile.nutritionalTargets;
    lines.push(
      `Daily nutrition targets per person: ${t.calories} kcal, ${t.protein} g protein, ${t.carbs} g carbs, ${t.fat} g fat, ${t.fiber} g fiber, at most ${t.sugar} g sugar, ${t.sodium} mg sodium and ${t.cholesterol} mg cholesterol. Get each day's meals as close to these as the budget allows.`
    );
  }
  return lines.join('\n');
}

function pantryBlock(pantry) {
  if (!pantry.length) return 'Pantry: empty.';
  const items = pantry.map((i) => `- ${i.name}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n');
  return `Pantry (already in the house):\n${items}`;
}

const PREP_STYLE = {
  'Cook Every Meal': 'They cook each meal fresh, so keep individual meals quick and vary them through the week.',
  'Cook Once Daily': 'They cook once a day. Plan dinners that deliberately make enough for the next day\'s lunch where it suits, and keep breakfasts simple.',
  'Weekly Meal Prep': 'They batch-cook once for the whole week, eating the same meals every day. Choose dishes that hold up well in the fridge for several days and reheat well.',
};

function snackLine(profile) {
  if (!profile.snackTypes.length) return '';
  const homemade = profile.snackTypes.includes('Homemade Snacks');
  return `Snacks: include one or two per day of these kinds: ${profile.snackTypes.join(', ')}. ${
    homemade ? 'Homemade snacks should be simple things they can make themselves.' : 'Store-bought snacks should be ordinary grocery products.'
  } Snacks follow the same diet and avoided-food rules as meals.`;
}

const PLANNER_SYSTEM = `You plan meals for The Weekly Dish, an app that builds a household's week of meals around their budget, diet, kitchen and tastes. A good plan is one the household can actually shop for, afford and cook, and would look forward to eating.

Priorities, in order:
1. Hard limits. Allergies, avoided foods, the diet and the available cooking equipment are never traded away for anything else.
2. Budget. Each meal's estimatedCost is what the household would really spend on its ingredients at a US discount grocer such as Walmart, at store-brand prices. The week's meals should add up to the budget described. Use realistic current prices rather than optimistic ones: the household shops from this plan, and a plan that turns out to cost more than promised lets them down.
3. Use what they have. Build meals around pantry items first so food is not wasted, and reuse purchased ingredients across the week so whole packages get used.
4. Fit and appeal. Match the cook's skill, time, cuisines, goals and nutrition targets, and give the week real variety unless the budget or prep style calls for repetition.

Size every meal for the whole household for one sitting, with child-sized portions for children. Name dishes specifically and include their sides ("Sheet-pan chicken thighs with roasted potatoes and green beans", not "Chicken dinner").

Each meal's ingredients list drives the shopping list and the recipe, so make it complete: every ingredient, with the quantity for the whole household, including oil, seasonings and other staples. Nutrition values are per serving.`;

function mealPlanPrompt(profile, pantry) {
  const isMealPrep = profile.prepStyle === 'Weekly Meal Prep';
  const parts = [
    isMealPrep
      ? `Plan one day of meals (${profile.mealTypes.join(', ')}) that this household will batch-cook and eat every day for a week. Give costs, portions and ingredient quantities for a single day; they will be multiplied by seven.`
      : `Plan a full week, Monday through Sunday, with these meals each day: ${profile.mealTypes.join(', ')}.`,
    householdBrief(profile),
    PREP_STYLE[profile.prepStyle] || '',
    snackLine(profile),
    profile.favoriteRecipes.length
      ? `Meals they have liked before (work a few in if they fit): ${profile.favoriteRecipes.join('; ')}.`
      : '',
    profile.dislikedRecipes.length
      ? `Meals they have rejected before (do not repeat these): ${profile.dislikedRecipes.join('; ')}.`
      : '',
    pantryBlock(pantry),
  ];
  return { system: PLANNER_SYSTEM, user: parts.filter(Boolean).join('\n\n') };
}

function mealPlanRepairPrompt(problems) {
  return `That plan has problems that need fixing:\n${problems.map((p) => `- ${p}`).join('\n')}\n\nSend the corrected plan in full. Keep the meals that were fine and change only what is needed to fix these problems.`;
}

const SINGLE_MEAL_SYSTEM = `You plan meals for The Weekly Dish, an app that builds a household's week of meals around their budget, diet, kitchen and tastes. You are filling one slot in an existing weekly plan.

Allergies, avoided foods, the diet and the available cooking equipment are hard limits. estimatedCost is what the household would really spend on the meal's ingredients at a US discount grocer at store-brand prices. Size the meal for the whole household for one sitting. Name the dish specifically, including its sides. The ingredients list must be complete, with quantities for the whole household, because the shopping list and recipe are built from it. Nutrition values are per serving.`;

function replaceMealPrompt(profile, pantry, { mealType, currentMeal, otherMeals }) {
  const parts = [
    `The household wants a different ${mealType} in place of "${currentMeal.name}"${
      currentMeal.estimatedCost ? ` (which cost about ${money(currentMeal.estimatedCost)})` : ''
    }. Suggest one replacement that is clearly a different dish and costs about the same or less.`,
    householdBrief(profile),
    otherMeals.length ? `Already in this week's plan (avoid repeating these): ${otherMeals.join('; ')}.` : '',
    profile.dislikedRecipes.length ? `Meals they have rejected before: ${profile.dislikedRecipes.join('; ')}.` : '',
    pantryBlock(pantry),
  ];
  return { system: SINGLE_MEAL_SYSTEM, user: parts.filter(Boolean).join('\n\n') };
}

function customMealPrompt(profile, { mealType, mealName }) {
  const parts = [
    `The household has chosen to have "${mealName}" for ${mealType}. Fill in the details for that exact dish: realistic cost, time, difficulty, nutrition and the full ingredients list. Keep the name as they wrote it. If the dish conflicts with their diet or avoided foods, adapt the ingredients to respect those limits while staying as close to the dish as you can.`,
    householdBrief(profile),
  ];
  return { system: SINGLE_MEAL_SYSTEM, user: parts.filter(Boolean).join('\n\n') };
}

const SHOPPING_SYSTEM = `You write shopping lists for The Weekly Dish. You are given a household's meal plan with each meal's ingredients, and what is already in their pantry. Produce the list of products to buy at a US Walmart so they can cook every meal in the plan.

How to build it:
- Add up each ingredient across all the meals, then subtract what the pantry already covers. Buy only the shortfall. If the pantry fully covers an ingredient, leave it off the list.
- Buy only what the meals need. Do not add staples "just in case".
- Turn each ingredient total into real packages: the smallest sensible number of the most economical package that covers the need. Prefer the store brand (Great Value) unless the household's preferences call for something specific.
- name is the product as it appears on the shelf, with brand, type and size ("Great Value 1% Lowfat Milk, 1 gallon"). unit describes the package. quantity is the number of packages.
- estimatedPrice is the total for that line (quantity times the package price), using realistic current Walmart prices to the cent. The household budgets from these numbers, so do not round them down.
- searchTerm is what a shopper would type into the Walmart search box to find the product: three to six plain words, brand and key attribute first, no punctuation ("great value 1% milk gallon").
- Respect the diet, allergies, avoided foods and milk and egg preferences in every product choice.
- Put each product in the category where it is shelved, and list categories in the order someone walks the store.
- Give two to four money-saving tips that are specific to this list.`;

// Collapse a plan into unique meals with how many times each is cooked.
function summarizePlan(plan) {
  const meals = new Map();
  const snacks = new Map();
  for (const day of plan.days || []) {
    const dayMeals = (day && day.meals) || {};
    for (const key of ['breakfast', 'lunch', 'dinner']) {
      const m = dayMeals[key];
      if (!m || !m.name) continue;
      const id = `${key}|${m.name}`;
      const entry = meals.get(id) || { type: key, name: m.name, count: 0, ingredients: m.ingredients || [] };
      entry.count += 1;
      if (!entry.ingredients.length && m.ingredients?.length) entry.ingredients = m.ingredients;
      meals.set(id, entry);
    }
    for (const s of Array.isArray(dayMeals.snacks) ? dayMeals.snacks : []) {
      const name = typeof s === 'string' ? s : s && s.name;
      if (name) snacks.set(name, (snacks.get(name) || 0) + 1);
    }
  }
  return { meals: Array.from(meals.values()), snacks: Array.from(snacks.entries()) };
}

function shoppingListPrompt(profile, pantry, summary) {
  const mealLines = summary.meals.map((m) => {
    const ingredients = m.ingredients.length
      ? m.ingredients.join('; ')
      : 'ingredients not listed, so work out what a standard version of this dish needs for this household';
    return `- ${m.type}, cooked ${m.count} time${m.count === 1 ? '' : 's'}: ${m.name}. Ingredients for one cooking: ${ingredients}`;
  });
  const homemade = profile.snackTypes.includes('Homemade Snacks');
  const snackLines = summary.snacks.length
    ? `Snacks in the plan (${homemade ? 'homemade, so buy the ingredients to make them' : 'buy these as products'}):\n${summary.snacks
        .map(([name, count]) => `- ${name} (${count} day${count === 1 ? '' : 's'})`)
        .join('\n')}`
    : '';
  const parts = [
    `Write the shopping list for this week's plan.`,
    householdBrief(profile),
    `Meals to shop for:\n${mealLines.join('\n')}`,
    snackLines,
    pantryBlock(pantry),
  ];
  return { system: SHOPPING_SYSTEM, user: parts.filter(Boolean).join('\n\n') };
}

function shoppingListRepairPrompt(total, budget) {
  return `That list totals ${money(total)}, which is ${money(total - budget)} over the ${money(budget)} budget. Bring it to budget or as close as honestly possible: choose cheaper brands and package sizes, drop anything the meals do not strictly need, and substitute a cheaper equivalent ingredient where a meal allows it. Keep the prices realistic; do not lower a price without changing the product. Send the full corrected list.`;
}

const RECIPE_SYSTEM = `You write recipes for The Weekly Dish, a meal-planning app for home cooks. Write the recipe a capable friend would hand over: exact quantities, steps in the order you would actually do them, with temperatures, times and the cues that tell you a step is done. Match the cook's skill level and use only the equipment they have. Respect the household's diet, allergies and avoided foods. Nutrition values are per serving.`;

function recipePrompt(profile, { meal, servings, isMealPrep }) {
  const people = householdSize(profile);
  const parts = [
    isMealPrep
      ? `Write a batch-cooking recipe for "${meal.name}" that makes ${servings} servings: ${people} ${people === 1 ? 'person' : 'people'} for 7 days, cooked in one session. Include how to portion it, how to store it so it keeps for the week, which components to add fresh on the day, and how to reheat it. Put batch-cooking advice in mealPrepTips.`
      : `Write the recipe for "${meal.name}" for ${servings} serving${servings === 1 ? '' : 's'}. Leave mealPrepTips empty.`,
    meal.ingredients.length
      ? `The meal plan and shopping list were built from these ingredients${
          isMealPrep ? ' (quantities are for one day; scale them to the full batch)' : ''
        }, so base the recipe on them and do not add anything that would need another purchase beyond basic seasoning:\n${meal.ingredients
          .map((i) => `- ${i}`)
          .join('\n')}`
      : '',
    meal.estimatedCost ? `Planned cost: about ${money(meal.estimatedCost * (isMealPrep ? 7 : 1))}.` : '',
    householdBrief(profile, { includeBudget: false }),
  ];
  return { system: RECIPE_SYSTEM, user: parts.filter(Boolean).join('\n\n') };
}

function quickMealPrompt(profile, pantry) {
  const parts = [
    `Suggest one meal this household can cook right now using only what is in their pantry, plus water, salt, pepper and cooking oil. Choose something genuinely good to eat rather than something that merely uses the most items, and use up perishable items first. Give the full recipe with quantities.`,
    householdBrief(profile, { includeBudget: false }),
    pantryBlock(pantry),
  ];
  return { system: RECIPE_SYSTEM, user: parts.filter(Boolean).join('\n\n') };
}

const PANTRY_SCAN_SYSTEM = `You identify groceries in photos for The Weekly Dish so a household can stock their digital pantry without typing. List every food item, ingredient and drink you can see: packaged products, produce, and items in the fridge or on shelves. Read labels for the product name and brand where they are legible. List each distinct product once, with the amount visible. Skip non-food objects, and skip anything you cannot identify with reasonable confidence rather than guessing. If the photos show no food, return an empty list.`;

function pantryScanPrompt(imageCount) {
  return {
    system: PANTRY_SCAN_SYSTEM,
    user: `Identify the food items in ${imageCount === 1 ? 'this photo' : `these ${imageCount} photos`}. If the same product appears in more than one photo, list it once.`,
  };
}

module.exports = {
  mealPlanPrompt,
  mealPlanRepairPrompt,
  replaceMealPrompt,
  customMealPrompt,
  shoppingListPrompt,
  shoppingListRepairPrompt,
  summarizePlan,
  recipePrompt,
  quickMealPrompt,
  pantryScanPrompt,
};
