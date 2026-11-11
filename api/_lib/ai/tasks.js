// The AI features of the app. Each task takes the household's data from the
// browser, builds its prompt on the server, calls Claude with a schema, then
// checks the result in code before returning it.
//
// ctx = { generate, onProgress(stage, chars), signal, usage(list) }

const schemas = require('./schemas');
const prompts = require('./prompts');
const validate = require('./validate');
const { AiError } = require('./runner');
const { normalizeProfile, normalizePantry, normalizeMeal, householdSize, mealKeys, text, list } = require('./profile');

const userTurn = (content) => ({ role: 'user', content });

function badInput(message) {
  return new AiError('bad_request', message, 400);
}

async function run(ctx, stage, request) {
  const result = await ctx.generate({
    ...request,
    signal: ctx.signal,
    onProgress: ctx.onProgress ? (chars) => ctx.onProgress(stage, chars) : undefined,
  });
  if (ctx.usage) ctx.usage.push({ stage, ...result.usage });
  return result;
}

async function mealPlan(input, ctx) {
  const profile = normalizeProfile(input.profile);
  const pantry = normalizePantry(input.pantryItems);
  const keys = mealKeys(profile);
  const includeSnacks = profile.snackTypes.length > 0;
  const isMealPrep = profile.prepStyle === 'Weekly Meal Prep';

  const schema = isMealPrep ? schemas.mealPrepDay(keys, includeSnacks) : schemas.mealPlan(keys, includeSnacks);
  const build = (data) => (isMealPrep ? validate.buildMealPrepPlan(data, profile) : validate.buildPlan(data, profile));
  const check = (plan) => validate.checkPlan(plan, profile, { repeatedWeek: isMealPrep });
  const { system, user } = prompts.mealPlanPrompt(profile, pantry);
  const request = { system, schema, effort: 'medium', maxTokens: 32000 };

  const first = await run(ctx, 'Planning your week', { ...request, messages: [userTurn(user)] });
  let plan = build(first.data);
  let problems = check(plan);

  if (problems.structural.length || problems.soft.length) {
    // One correction pass, telling the model exactly what the checks found.
    const second = await run(ctx, 'Fine-tuning the plan', {
      ...request,
      messages: [
        userTurn(user),
        { role: 'assistant', content: first.content },
        userTurn(prompts.mealPlanRepairPrompt([...problems.structural, ...problems.soft])),
      ],
    });
    const revised = build(second.data);
    const revisedProblems = check(revised);
    const better =
      revisedProblems.structural.length < problems.structural.length ||
      (revisedProblems.structural.length === problems.structural.length &&
        revisedProblems.soft.length <= problems.soft.length);
    if (better) {
      plan = revised;
      problems = revisedProblems;
    }
  }

  if (problems.structural.length) {
    throw new AiError('incomplete_plan', 'The meal plan came back incomplete. Please try again.');
  }

  return {
    ...plan,
    estimatedTotal: problems.total,
    weeklyBudget: profile.weeklyBudget,
    warnings: problems.soft,
    generatedAt: new Date().toISOString(),
  };
}

function cleanPlanInput(raw) {
  const days = Array.isArray(raw && raw.days) ? raw.days.slice(0, 7) : [];
  return {
    days: days.map((day) => {
      const meals = (day && day.meals) || {};
      const out = {};
      for (const key of validate.MEAL_KEYS) {
        if (meals[key] && meals[key].name) out[key] = normalizeMeal(meals[key]);
      }
      out.snacks = list(
        (Array.isArray(meals.snacks) ? meals.snacks : []).map((s) => (typeof s === 'string' ? s : s && s.name)),
        8,
        120
      );
      return { day: text(day && day.day, 12), meals: out };
    }),
  };
}

async function shoppingList(input, ctx) {
  const profile = normalizeProfile(input.profile);
  const pantry = normalizePantry(input.pantryItems);
  const summary = prompts.summarizePlan(cleanPlanInput(input.mealPlan));
  if (!summary.meals.length) throw badInput('A meal plan is required to build a shopping list.');

  const { system, user } = prompts.shoppingListPrompt(profile, pantry, summary);
  const request = { system, schema: schemas.shoppingList, effort: 'medium', maxTokens: 32000 };

  const first = await run(ctx, 'Building your shopping list', { ...request, messages: [userTurn(user)] });
  let result = validate.buildShoppingList(first.data, profile);
  // An empty list is only plausible when the pantry covers everything.
  if (!result.shoppingList.sections.length && !pantry.length) {
    throw new AiError('empty_list', 'The shopping list came back empty. Please try again.');
  }

  if (result.totalCost > profile.weeklyBudget * 1.03) {
    const second = await run(ctx, 'Trimming the list to your budget', {
      ...request,
      messages: [
        userTurn(user),
        { role: 'assistant', content: first.content },
        userTurn(prompts.shoppingListRepairPrompt(result.totalCost, profile.weeklyBudget)),
      ],
    });
    const revised = validate.buildShoppingList(second.data, profile);
    if (revised.shoppingList.sections.length && revised.totalCost < result.totalCost) result = revised;
  }

  const over = validate.cents(result.totalCost - profile.weeklyBudget);
  return { ...result, overBudgetBy: over > 0 ? over : 0, generatedAt: new Date().toISOString() };
}

function mealTypeOf(input) {
  const type = text(input.mealType, 12).toLowerCase();
  if (!validate.MEAL_KEYS.includes(type)) throw badInput('mealType must be breakfast, lunch or dinner.');
  return type;
}

async function replaceMeal(input, ctx) {
  const profile = normalizeProfile(input.profile);
  const pantry = normalizePantry(input.pantryItems);
  const mealType = mealTypeOf(input);
  const currentMeal = normalizeMeal(input.currentMeal);
  if (!currentMeal.name) throw badInput('The meal to replace is missing.');
  const otherMeals = list(input.otherMeals, 30, 160).filter((n) => n.toLowerCase() !== currentMeal.name.toLowerCase());
  const patterns = validate.avoidedPatterns(profile);

  const { system, user } = prompts.replaceMealPrompt(profile, pantry, { mealType, currentMeal, otherMeals });
  const request = { system, schema: schemas.meal, effort: 'low', maxTokens: 8000 };
  const first = await run(ctx, 'Finding a replacement', { ...request, messages: [userTurn(user)] });
  let meal = validate.cleanMeal(first.data);

  const issues = [];
  if (meal.name.toLowerCase() === currentMeal.name.toLowerCase()) issues.push('That is the same dish. Suggest a different one.');
  const hits = validate.findAvoided(meal, patterns);
  if (hits.length) issues.push(`That dish includes ${hits.join(', ')}, which this household does not eat. Suggest a dish with none of it.`);

  if (issues.length) {
    const second = await run(ctx, 'Finding a replacement', {
      ...request,
      messages: [userTurn(user), { role: 'assistant', content: first.content }, userTurn(issues.join(' '))],
    });
    const revised = validate.cleanMeal(second.data);
    if (revised.name && revised.name.toLowerCase() !== currentMeal.name.toLowerCase()) meal = revised;
  }
  if (!meal.name) throw new AiError('invalid_output', 'Could not find a replacement meal. Please try again.');
  return meal;
}

async function customMeal(input, ctx) {
  const profile = normalizeProfile(input.profile);
  const mealType = mealTypeOf(input);
  const mealName = text(input.mealName, 120);
  if (!mealName) throw badInput('Enter a meal name.');

  const { system, user } = prompts.customMealPrompt(profile, { mealType, mealName });
  const result = await run(ctx, 'Working out the details', {
    system,
    schema: schemas.meal,
    effort: 'low',
    maxTokens: 8000,
    messages: [userTurn(user)],
  });
  // The household named this dish; keep their wording.
  return { ...validate.cleanMeal(result.data), name: mealName };
}

async function recipe(input, ctx) {
  const profile = normalizeProfile(input.profile);
  const meal = normalizeMeal(input.meal);
  if (!meal.name) throw badInput('A meal name is required.');
  const isMealPrep = profile.prepStyle === 'Weekly Meal Prep';
  const baseServings = householdSize(profile);
  const servings = isMealPrep ? baseServings * 7 : baseServings;

  const { system, user } = prompts.recipePrompt(profile, { meal, servings, isMealPrep });
  const result = await run(ctx, 'Writing the recipe', {
    system,
    schema: schemas.recipe,
    effort: 'low',
    maxTokens: 12000,
    messages: [userTurn(user)],
  });
  const cleaned = validate.cleanRecipe(result.data, { name: meal.name, servings, isMealPrep, baseServings });
  if (!cleaned.ingredients.length || !cleaned.instructions.length) {
    throw new AiError('invalid_output', 'The recipe came back incomplete. Please try again.');
  }
  // Recipes are cached by the meal's name in the plan, so keep that exact name.
  return { ...cleaned, name: meal.name };
}

async function quickMeal(input, ctx) {
  const profile = normalizeProfile(input.profile);
  const pantry = normalizePantry(input.pantryItems);
  if (!pantry.length) throw badInput('Add items to your pantry first.');

  const { system, user } = prompts.quickMealPrompt(profile, pantry);
  const result = await run(ctx, 'Looking through your pantry', {
    system,
    schema: schemas.quickMeal,
    effort: 'low',
    maxTokens: 12000,
    messages: [userTurn(user)],
  });
  const cleaned = validate.cleanQuickMeal(result.data);
  if (!cleaned.meal || !cleaned.recipe.instructions.length) {
    throw new AiError('invalid_output', 'Could not come up with a meal. Please try again.');
  }
  return cleaned;
}

const IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+=*)$/;
const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 3_500_000; // ~2.6 MB of image data

async function pantryScan(input, ctx) {
  const images = Array.isArray(input.images) ? input.images : [];
  if (!images.length) throw badInput('No photos were provided.');
  if (images.length > MAX_IMAGES) throw badInput(`Send at most ${MAX_IMAGES} photos at a time.`);

  const blocks = images.map((dataUrl) => {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGE_CHARS) throw badInput('A photo is too large.');
    const match = IMAGE_PATTERN.exec(dataUrl);
    if (!match) throw badInput('Photos must be JPEG, PNG, WebP or GIF images.');
    return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
  });

  const { system, user } = prompts.pantryScanPrompt(blocks.length);
  const result = await run(ctx, 'Reading your photos', {
    system,
    schema: schemas.pantryScan,
    effort: 'low',
    maxTokens: 12000,
    messages: [{ role: 'user', content: [...blocks, { type: 'text', text: user }] }],
  });
  return { items: validate.cleanPantryScan(result.data) };
}

// Daily allowance per signed-in user for each task. Generous for real use
// (a full plan + list + 21 recipes fits several times over) while capping what
// any single account can cost.
const TASKS = {
  mealPlan: { handler: mealPlan, dailyLimit: 12 },
  shoppingList: { handler: shoppingList, dailyLimit: 15 },
  replaceMeal: { handler: replaceMeal, dailyLimit: 60 },
  customMeal: { handler: customMeal, dailyLimit: 60 },
  recipe: { handler: recipe, dailyLimit: 150 },
  quickMeal: { handler: quickMeal, dailyLimit: 30 },
  pantryScan: { handler: pantryScan, dailyLimit: 40 },
};

module.exports = { TASKS, cleanPlanInput };
