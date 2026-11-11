// JSON schemas for structured outputs. The API guarantees the model's reply
// matches the schema, so there is no text-scraping or "please return JSON".
// Structured-output rules: every object sets additionalProperties:false and
// lists every property as required.

const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const arr = (items, description) => ({ type: 'array', items, description });

const nutrition = obj({
  calories: num('kcal per serving'),
  protein: num('grams per serving'),
  carbs: num('grams per serving'),
  fat: num('grams per serving'),
  fiber: num('grams per serving'),
  sugar: num('grams per serving'),
  sodium: num('milligrams per serving'),
  cholesterol: num('milligrams per serving'),
});

const meal = obj({
  name: str('Specific dish name including its sides'),
  estimatedCost: num('Grocery cost in US dollars of this meal for the whole household'),
  cookingTime: num('Total hands-on plus cooking time in minutes'),
  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  nutrition,
  ingredients: arr(
    str('One ingredient with the quantity for the whole household, e.g. "1 lb 80/20 ground beef"'),
    'Every ingredient the meal needs, including staples such as oil and seasoning'
  ),
});

// Day object containing only the meals this household plans for.
function dayMeals(mealKeys, includeSnacks) {
  const properties = {};
  for (const key of mealKeys) properties[key] = meal;
  if (includeSnacks) properties.snacks = arr(str('Snack name'), 'Snacks for the day');
  return obj(properties);
}

function mealPlan(mealKeys, includeSnacks) {
  return obj({
    days: arr(
      obj({
        day: {
          type: 'string',
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
        meals: dayMeals(mealKeys, includeSnacks),
      }),
      'Exactly seven entries, Monday through Sunday, in order'
    ),
  });
}

// Weekly meal prep repeats one day of meals all week, so only one day is generated.
function mealPrepDay(mealKeys, includeSnacks) {
  return obj({ meals: dayMeals(mealKeys, includeSnacks) });
}

const SHOPPING_CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Frozen',
  'Snacks',
  'Beverages',
  'Other',
];

const shoppingList = obj({
  sections: arr(
    obj({
      category: { type: 'string', enum: SHOPPING_CATEGORIES },
      items: arr(
        obj({
          name: str('Product as it appears on the shelf: brand, type and package size'),
          quantity: num('How many packages to buy'),
          unit: str('Package description, e.g. "gallon", "2.5 lb package", "dozen"'),
          estimatedPrice: num('Total US dollars for this line (quantity times package price)'),
          searchTerm: str('Short phrase to type into a grocery store search box to find this product'),
        })
      ),
    })
  ),
  moneySavingTips: arr(str('One practical tip specific to this list')),
});

const recipe = obj({
  name: str('Dish name'),
  servings: num('Number of servings the recipe makes'),
  cookingTime: num('Total minutes'),
  cost: num('Estimated grocery cost in US dollars for the whole recipe'),
  ingredients: arr(str('Ingredient with exact quantity')),
  instructions: arr(str('One clear step')),
  nutrition: obj({
    calories: num('kcal per serving'),
    protein: num('grams per serving'),
    carbs: num('grams per serving'),
    fat: num('grams per serving'),
  }),
  tips: obj({
    storage: str('How to store leftovers or prepped portions'),
    reheating: str('How to reheat'),
    mealPrepTips: arr(str('Batch-cooking tip'), 'Empty unless this is a weekly meal-prep recipe'),
  }),
});

const quickMeal = obj({
  meal: str('Dish name'),
  recipe: obj({
    ingredients: arr(str('Ingredient with quantity')),
    instructions: arr(str('One clear step')),
    cookingTime: num('Total minutes'),
    servings: num('Number of servings'),
    estimatedCost: num('Approximate value in US dollars of the pantry items used'),
  }),
});

const pantryScan = obj({
  items: arr(
    obj({
      name: str('Product or ingredient name'),
      brand: str('Brand if readable, otherwise empty'),
      quantity: str('Amount visible, e.g. "1 gallon", "2 cans", "1 bag"'),
      category: {
        type: 'string',
        enum: ['Produce', 'Meat', 'Dairy', 'Grains', 'Canned', 'Frozen', 'Snacks', 'Beverages', 'Condiments', 'Spices', 'Other'],
      },
      confidence: num('0-100 confidence that the item is identified correctly'),
      expiryDate: str('Expiry date if printed and readable (YYYY-MM-DD), otherwise empty'),
    })
  ),
});

module.exports = {
  meal,
  mealPlan,
  mealPrepDay,
  shoppingList,
  recipe,
  quickMeal,
  pantryScan,
  SHOPPING_CATEGORIES,
};
