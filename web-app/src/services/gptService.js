// GPT Service for AI functionality
// API calls are proxied through our backend to avoid CORS issues
const DEV_MODE = false; // Always use real API in production

// Get the API base URL - use relative path for production, localhost for dev
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const callGPT = async (messages, timeout = 120000, maxRetries = 2) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Call our backend proxy instead of OpenAI directly (avoids CORS)
      const response = await fetch(`${API_BASE_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Using full model for better reliability
          messages,
          temperature: 0.7,
          max_tokens: 4000 // Ensure we get complete responses
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', response.status, errorData);
        lastError = new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        
        // If it's a rate limit or server error, retry
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
          continue;
        }
        throw lastError;
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        lastError = new Error('Invalid response from OpenAI API');
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        throw lastError;
      }
      
      // Success! Return the content
      const content = data.choices[0].message.content;
      console.log('GPT Response content:', content ? `${content.substring(0, 100)}...` : 'null/empty');
      return content;
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (error.name === 'AbortError') {
        lastError = new Error('Request timeout - the server took too long to respond. Please try again.');
      } else {
        lastError = error;
      }
      
      // If we have retries left, wait and try again
      if (attempt < maxRetries) {
        console.log(`Waiting before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('Failed after all retry attempts');
};

// Mock data for development
const mockMealPlan = {
  days: [
    {
      day: "Monday",
      meals: {
        breakfast: { name: "Scrambled Eggs with Toast", estimatedCost: 3.50, cookingTime: 15, difficulty: "easy" },
        lunch: { name: "Chicken Caesar Salad", estimatedCost: 6.75, cookingTime: 20, difficulty: "easy" },
        dinner: { name: "Spaghetti Bolognese", estimatedCost: 8.25, cookingTime: 30, difficulty: "medium" }
      }
    },
    {
      day: "Tuesday",
      meals: {
        breakfast: { name: "Oatmeal with Berries", estimatedCost: 2.75, cookingTime: 10, difficulty: "easy" },
        lunch: { name: "Turkey Sandwich", estimatedCost: 5.50, cookingTime: 10, difficulty: "easy" },
        dinner: { name: "Grilled Chicken with Vegetables", estimatedCost: 9.00, cookingTime: 25, difficulty: "medium" }
      }
    },
    {
      day: "Wednesday",
      meals: {
        breakfast: { name: "Pancakes with Syrup", estimatedCost: 4.00, cookingTime: 20, difficulty: "easy" },
        lunch: { name: "Tomato Soup with Grilled Cheese", estimatedCost: 5.25, cookingTime: 15, difficulty: "easy" },
        dinner: { name: "Beef Tacos", estimatedCost: 7.50, cookingTime: 25, difficulty: "easy" }
      }
    },
    {
      day: "Thursday",
      meals: {
        breakfast: { name: "Greek Yogurt Parfait", estimatedCost: 3.25, cookingTime: 5, difficulty: "easy" },
        lunch: { name: "Chicken Wrap", estimatedCost: 6.00, cookingTime: 15, difficulty: "easy" },
        dinner: { name: "Baked Salmon with Rice", estimatedCost: 10.50, cookingTime: 30, difficulty: "medium" }
      }
    },
    {
      day: "Friday",
      meals: {
        breakfast: { name: "French Toast", estimatedCost: 3.75, cookingTime: 15, difficulty: "easy" },
        lunch: { name: "Cobb Salad", estimatedCost: 7.25, cookingTime: 15, difficulty: "easy" },
        dinner: { name: "Pizza Night", estimatedCost: 12.00, cookingTime: 20, difficulty: "easy" }
      }
    },
    {
      day: "Saturday",
      meals: {
        breakfast: { name: "Bacon and Eggs", estimatedCost: 4.50, cookingTime: 15, difficulty: "easy" },
        lunch: { name: "Leftover Pizza", estimatedCost: 0, cookingTime: 5, difficulty: "easy" },
        dinner: { name: "BBQ Ribs with Coleslaw", estimatedCost: 14.00, cookingTime: 45, difficulty: "medium" }
      }
    },
    {
      day: "Sunday",
      meals: {
        breakfast: { name: "Waffles with Fruit", estimatedCost: 4.25, cookingTime: 20, difficulty: "easy" },
        lunch: { name: "BLT Sandwich", estimatedCost: 5.75, cookingTime: 10, difficulty: "easy" },
        dinner: { name: "Roast Chicken Dinner", estimatedCost: 11.00, cookingTime: 60, difficulty: "hard" }
      }
    }
  ]
};

export const generateMealPlan = async (profile, pantryItems) => {
  // Return mock data in dev mode
  if (DEV_MODE) {
    return new Promise(resolve => {
      setTimeout(() => resolve(mockMealPlan), 1500);
    });
  }
  
  // Ensure all arrays have defaults
  const safeProfile = {
    adults: profile.adults || 1,
    kids: profile.kids || 0,
    weeklyBudget: profile.weeklyBudget || 100,
    stickToBudget: profile.stickToBudget || false,
    dietType: profile.dietType || 'None',
    customDiet: profile.customDiet || '',
    customCuisines: profile.customCuisines || '',
    cookingTools: profile.cookingTools || [],
    skillLevel: profile.skillLevel || 'Intermediate',
    mealDifficulty: profile.mealDifficulty || 'Medium (15-30 min)',
    cuisineTypes: profile.cuisineTypes || [],
    dietaryRestrictions: profile.dietaryRestrictions || '',
    dislikedFoods: profile.dislikedFoods || [],
    customDislikedFoods: profile.customDislikedFoods || '',
    foodGoals: profile.foodGoals || [],
    prepStyle: profile.prepStyle || 'Cook Every Meal',
    mealTypes: profile.mealTypes || [],
    snackTypes: profile.snackTypes || [],
    nutritionalTargets: profile.nutritionalTargets || {},
    dairyPreferences: profile.dairyPreferences || {}
  };
  
  const includeSnacks = safeProfile.snackTypes?.length > 0;
  const snackStructure = includeSnacks ? ',\n            "snacks": ["snack1", "snack2"]' : '';
  
  const nutritionalTargets = safeProfile.nutritionalTargets?.trackNutrition ? `
    NUTRITIONAL TARGETS PER PERSON PER DAY:
    - Calories: ${safeProfile.nutritionalTargets.dailyCalories}
    - Protein: ${safeProfile.nutritionalTargets.dailyProtein}g
    - Carbs: ${safeProfile.nutritionalTargets.dailyCarbs}g
    - Fat: ${safeProfile.nutritionalTargets.dailyFat}g
    - Fiber: ${safeProfile.nutritionalTargets.dailyFiber}g
    - Sugar: ${safeProfile.nutritionalTargets.dailySugar}g
    - Sodium: ${safeProfile.nutritionalTargets.dailySodium}mg
    - Cholesterol: ${safeProfile.nutritionalTargets.dailyCholesterol}mg
    IMPORTANT: Include nutrition info for EACH meal! Try to meet daily targets across all meals.` : '';
  
  const allDislikedFoods = [
    ...(safeProfile.dislikedFoods || []),
    ...(safeProfile.customDislikedFoods ? safeProfile.customDislikedFoods.split(',').map(f => f.trim()) : [])
  ].filter(f => f);
  

  const prompt = `Generate a COMPLETE 7-day meal plan for ${safeProfile.adults} adults and ${safeProfile.kids} kids.

    MANDATORY: You MUST include ALL 7 DAYS:
    - Monday (day 1)
    - Tuesday (day 2)
    - Wednesday (day 3)
    - Thursday (day 4)
    - Friday (day 5)
    - Saturday (day 6)
    - Sunday (day 7)

    
    WALMART LOCATION: ZIP ${safeProfile.zipCode || '72762'}
    
    CRITICAL: Be EXTREMELY SPECIFIC with product names for accurate Walmart searches!
    For EVERY ingredient, include:
    - BRAND NAME (e.g., "Great Value", "Tyson", "Hormel")
    - EXACT SIZE/WEIGHT (e.g., "1 gallon", "24 oz", "2 lb package")
    - SPECIFIC TYPE (e.g., "Whole Milk", "Boneless Skinless", "80/20 Ground")
    
    EXAMPLES OF GOOD SPECIFICITY:
    ❌ BAD: "Chicken Breast"
    ✅ GOOD: "Tyson Boneless Skinless Chicken Breasts 2.5 lb Fresh"
    
    ❌ BAD: "Milk" 
    ❌ BAD: "Whole Milk" (when user wants ${safeProfile.dairyPreferences?.milk || '1% Milk'})
    ✅ GOOD: "Great Value ${safeProfile.dairyPreferences?.milk || '1% Milk'} 1 Gallon"
    
    ❌ BAD: "Ground Beef"
    ✅ GOOD: "All Natural 80/20 Ground Beef Chuck 1 lb Roll"
    
    This specificity is REQUIRED for shopping list search accuracy!
    
    ${allDislikedFoods.length > 0 ? `🚫 ABSOLUTELY FORBIDDEN INGREDIENTS - DO NOT USE UNDER ANY CIRCUMSTANCES:
    ${allDislikedFoods.map(food => `• ${food}`).join('\n    ')}
    
    CRITICAL RULES:
    1. Do NOT include ANY of the above ingredients in ANY form
    2. Do NOT use these ingredients as garnish, seasoning, or side dishes
    3. Do NOT include dishes that traditionally contain these ingredients
    4. If a dish normally has these ingredients, choose a COMPLETELY DIFFERENT dish
    5. Check EVERY ingredient in EVERY recipe before including it
    
    Example: If "Broccoli" is disliked, do NOT include:
    - Broccoli as a side dish
    - Stir-fry with broccoli
    - Broccoli soup
    - Vegetable medley containing broccoli
    - ANY dish that has broccoli as an ingredient
    ` : ''}
    
    PROFILE REQUIREMENTS (FOLLOW AS GOSPEL - DO NOT DEVIATE):
    Budget: $${safeProfile.weeklyBudget} weekly ${safeProfile.stickToBudget 
      ? '(MANDATORY: USE EXACTLY 95-100% of budget - $' + (safeProfile.weeklyBudget * 0.95).toFixed(2) + ' to $' + safeProfile.weeklyBudget + ')' 
      : '(STAY UNDER BUDGET: Do not exceed $' + safeProfile.weeklyBudget + ', but you can use less)'}
    Diet: ${safeProfile.dietType} ${safeProfile.customDiet ? `(${safeProfile.customDiet})` : ''} - STRICTLY FOLLOW THIS DIET
    
    🥛 DAIRY PREFERENCES (VIOLATING THESE IS TOTAL FAILURE):
    ${safeProfile.dairyPreferences?.milk ? `MILK: You MUST use "${safeProfile.dairyPreferences.milk}" milk in ALL recipes! NEVER use whole milk unless that's the preference!` : ''}
    ${safeProfile.dairyPreferences?.eggs ? `EGGS: You MUST use "${safeProfile.dairyPreferences.eggs}" eggs in ALL recipes!` : ''}
    Cooking tools: ONLY use these tools: ${safeProfile.cookingTools.join(', ') || 'basic kitchen tools'} (NO OTHER TOOLS!)
    Skill level: ${safeProfile.skillLevel} (keep recipes appropriate for this level)
    Meal difficulty: ${safeProfile.mealDifficulty} (ALL meals must match this difficulty)
    Cuisines: ONLY use these cuisines: ${safeProfile.cuisineTypes.join(', ') || 'any'} ${safeProfile.customCuisines ? `+ ${safeProfile.customCuisines}` : ''}
    Dietary restrictions: ${safeProfile.dietaryRestrictions || 'none'} - MUST BE RESPECTED
    Goals: ${safeProfile.foodGoals.join(', ') || 'balanced meals'} - INCORPORATE ALL GOALS
    Meal prep style: ${safeProfile.prepStyle} - FOLLOW EXACTLY
    CRITICAL - Meals to plan: ONLY generate ${safeProfile.mealTypes.join(', ') || 'Breakfast, Lunch, and Dinner'}
    ${safeProfile.mealTypes.length < 3 ? `DO NOT include ${['Breakfast', 'Lunch', 'Dinner'].filter(m => !safeProfile.mealTypes.includes(m)).join(', ')}` : ''}
    Snacks: ${safeProfile.snackTypes.length > 0 ? 'INCLUDE: ' + safeProfile.snackTypes.join(', ') : 'NO SNACKS - DO NOT ADD ANY'}
    ${nutritionalTargets}
    
    IMPORTANT: ALWAYS include nutritional information for EVERY meal with calories, protein, carbs, fat, fiber, sugar, sodium, and cholesterol!
    
    ${safeProfile.prepStyle === 'Weekly Meal Prep' ? 
      `IMPORTANT: Since they do weekly meal prep, use the SAME breakfast, lunch, dinner${includeSnacks ? ', and snacks' : ''} for ALL 7 days!` : ''}
    
    ${includeSnacks ? `IMPORTANT: Include ${safeProfile.snackTypes.join(', ')} for each day!
    
    ${safeProfile.snackTypes.includes('Homemade Snacks') ? 
    `HOMEMADE SNACK REQUIREMENTS:
    1. Create RECIPES for snacks (not store-bought items)
    2. Include snack names that can be made at home
    3. Examples for ${safeProfile.dietType}:
    ${safeProfile.dietType === 'Carnivore' ? 
    `   - Deviled eggs, Bacon-wrapped cheese, Beef fat bombs, Bone broth` :
    safeProfile.dietType === 'Keto' ?
    `   - Keto fat bombs, Cheese crisps, Almond flour cookies, Avocado chips` :
    safeProfile.dietType === 'Vegan' ?
    `   - Energy balls, Roasted chickpeas, Veggie chips, Fruit leather` :
    `   - Homemade granola, Trail mix, Muffins, Energy bites`}
    4. These should have recipes you can generate later, not be shopping items!` :
    `STORE-BOUGHT SNACK REQUIREMENTS:
    1. Use commercial products from Walmart
    2. Quantity: ${safeProfile.adults + safeProfile.kids} people need snacks for 7 days
    3. Reasonable amounts: 1-2 snack items per person per day
    
    DIET-SPECIFIC STORE SNACKS:
    ${safeProfile.dietType === 'Carnivore' ? 
    `- ONLY: Beef jerky, pork rinds, cheese sticks, hard-boiled eggs, meat sticks` :
    safeProfile.dietType === 'Keto' ?
    `- ONLY: Nuts, cheese, pork rinds, low-carb protein bars, beef jerky` :
    safeProfile.dietType === 'Vegan' ?
    `- ONLY: Nuts, fruit, veggie sticks, hummus, plant-based bars` :
    `- Suggested: granola bars, nuts, fruit, cheese sticks, crackers`}`}
    
    Format: Simple array of STRING values ONLY
    CORRECT: "snacks": ["Deviled eggs", "Bacon-wrapped cheese"]
    WRONG: "snacks": [{"name": "Deviled eggs", "cost": 3.99}]` : 'Do not include any snacks.'}
    
    🏠 CURRENT PANTRY ITEMS (USE THESE FIRST!):\n    ${pantryItems.length > 0 ? pantryItems.map(item => `- ${item.name}${item.quantity ? ` (${item.quantity})` : ''}`).join('\\n    ') : 'No items in pantry'}\n    \n    PANTRY PRIORITY RULE: Create meals that USE pantry items when possible!\n    - If you have chicken in pantry, plan chicken meals\n    - If you have pasta in pantry, plan pasta dishes\n    - Minimize waste by using what's already available
    
    CRITICAL: Your response MUST include ALL 7 DAYS with complete meal data for EACH day.
    DO NOT stop after Monday/Tuesday - generate the ENTIRE WEEK.
    
    Return ONLY valid JSON with EXACTLY 7 days (Monday-Sunday):
    {
      "days": [
        {
          "day": "Monday", 
          "meals": {${
            safeProfile.mealTypes.includes('Breakfast') ? '\n            "breakfast": {"name": "...", "estimatedCost": 0.00, "cookingTime": 0, "difficulty": "easy", "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}},' : ''
          }${
            safeProfile.mealTypes.includes('Lunch') ? '\n            "lunch": {"name": "...", "estimatedCost": 0.00, "cookingTime": 0, "difficulty": "easy", "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}},' : ''
          }${
            safeProfile.mealTypes.includes('Dinner') ? '\n            "dinner": {"name": "...", "estimatedCost": 0.00, "cookingTime": 0, "difficulty": "easy", "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}}' : ''
          }${snackStructure}
          }
        },
        ... (Tuesday through Sunday with same structure)
      ]
    }
    
    IMPORTANT: The days array MUST have 7 elements, not 1, not 2, but EXACTLY 7 days!`;

  const response = await callGPT([
    { role: 'system', content: `You are a Walmart-savvy meal planning expert. You MUST strictly follow the user's profile requirements.

    CRITICAL REQUIREMENTS (MUST FOLLOW EXACTLY)
    1. Generate EXACTLY 7 DAYS - Monday through Sunday, NO EXCEPTIONS
    1a. CRITICAL: ONLY generate the meals they selected: ${safeProfile.mealTypes.join(', ')}
    1b. If they only want Dinner, ONLY generate dinner. NO breakfast or lunch!
    1c. If they only want Lunch and Dinner, ONLY those two. NO breakfast!
    2. COOKING TOOLS ARE LAW: ${safeProfile.cookingTools.length > 0 ? `ONLY use: ${safeProfile.cookingTools.join(', ')}` : 'NO cooking tools specified'}
       - If they don't have a slow cooker, ABSOLUTELY NO slow cooker recipes!
       - If they don't have an oven, ABSOLUTELY NO baking!
       - If they only have a microwave and stovetop, ONLY use those!
    3. DIET TYPE IS MANDATORY: ${safeProfile.dietType}${safeProfile.customDiet ? ` (${safeProfile.customDiet})` : ''}
       ${safeProfile.dietType === 'Carnivore' ? `
       CARNIVORE DIET ABSOLUTE RULES:
       - ONLY animal products: meat, fish, eggs, optional dairy
       - ZERO plants: NO fruits, NO vegetables, NO grains, NO nuts, NO seeds
       - NO bread, NO pasta, NO rice, NO potatoes
       - Breakfast/Lunch/Dinner: ONLY meat, fish, eggs
       - If you add ANY plant-based food, you have FAILED!` : 
       safeProfile.dietType === 'Keto' ? `
       KETO DIET ABSOLUTE RULES:
       - MAXIMUM 20g carbs per day TOTAL
       - NO bread, NO pasta, NO rice, NO sugar, NO potatoes
       - Focus on fats and proteins
       - Limited low-carb vegetables only` :
       safeProfile.dietType === 'Vegan' ? `
       VEGAN DIET ABSOLUTE RULES:
       - NO animal products whatsoever
       - NO meat, NO fish, NO eggs, NO dairy
       - Plant-based only` : ''}
       - Follow the diet like your salvation depends on it!
    4. DIFFICULTY LEVEL IS COMMANDMENT: ${safeProfile.mealDifficulty}
       - Easy = 5-15 minutes, SIMPLE ingredients, minimal steps
       - Medium = 15-30 minutes, some prep work
       - Hard = 30+ minutes, complex techniques
    5. BUDGET IS DIVINE LAW: $${safeProfile.weeklyBudget}
       ${safeProfile.stickToBudget 
         ? '⚠️ MANDATORY: Use $' + (safeProfile.weeklyBudget * 0.95).toFixed(2) + ' to $' + safeProfile.weeklyBudget + ' (95-100% of budget)'
         : '⚠️ NEVER exceed $' + safeProfile.weeklyBudget + ' - can use less but NEVER go over'}
    6. PREP STYLE IS DOCTRINE: ${safeProfile.prepStyle}
       - If "Weekly Meal Prep": Same 3 meals for ALL 7 days
       - If "Cook Once Daily": Different meals but batch cookable
       - If "Cook Every Meal": Variety with quick individual meals
    
    🚨 PORTION CONTROL - CRITICAL 🚨
    You are planning for ${safeProfile.adults} adult(s) for ONE WEEK (7 days) only!
    - Each meal should feed ${safeProfile.adults} adult(s) for ONE MEAL
    - Do NOT create portions for 4-5 people when cooking for 1 person
    - Weekly protein consumption: ${safeProfile.adults * 3}-${safeProfile.adults * 5} lbs TOTAL for the ENTIRE WEEK
    - Weekly egg consumption: ${safeProfile.adults * 1}-${safeProfile.adults * 2} dozen TOTAL for the ENTIRE WEEK
    - If a recipe says "serves 4" but you're cooking for 1, REDUCE the portions accordingly!
    
    ${allDislikedFoods.length > 0 ? `🚫 ABSOLUTELY FORBIDDEN INGREDIENTS (NEVER USE):
    ${allDislikedFoods.map(food => `- ${food}`).join('\n    ')}
    
    If a dish normally contains these, choose something COMPLETELY DIFFERENT.` : ''}
    
    ${includeSnacks ? 'CRITICAL: Snacks MUST be an array of STRINGS ONLY, not objects! Example: "snacks": ["Granola bars", "Apple slices", "Cheese sticks"] - DO NOT include objects with name/cost/nutrition!' : 'NO SNACKS - do not add any snacks array'}
    
    TREAT THE PROFILE AS GOSPEL TRUTH - NOT A SINGLE DEVIATION IS ACCEPTABLE!
    Return ONLY valid JSON with all 7 days, no additional text.` },
    { role: 'user', content: prompt }
  ]);

  let mealPlan;
  try {
    // Check if response is empty or null
    if (!response || response === 'null' || response === '{}') {
      console.error('Empty or null response from API:', response);
      throw new Error('The AI returned an empty response. Please try again.');
    }
    
    // Try to extract JSON from the response (in case there's extra text)
    let jsonStr = response;
    
    // If response contains ```json markers, extract the JSON
    if (response.includes('```json')) {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
    } else if (response.includes('```')) {
      const jsonMatch = response.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
    }
    
    // Try to find JSON object in the response
    const jsonStartIndex = jsonStr.indexOf('{');
    const jsonEndIndex = jsonStr.lastIndexOf('}');
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
    }
    
    console.log('Attempting to parse JSON:', jsonStr.substring(0, 200) + '...');
    mealPlan = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse meal plan response. Raw response:', response);
    console.error('Parse error:', parseError);
    throw new Error('Failed to generate meal plan. The AI returned an invalid response. Please check the console for details and try again.');
  }
  
  // Verify we got a valid meal plan object
  if (!mealPlan || Object.keys(mealPlan).length === 0) {
    console.error('Meal plan is null, undefined, or empty:', mealPlan);
    throw new Error('Failed to generate meal plan. The response was empty. Please try again.');
  }
  
  // Verify we got the days array
  if (!mealPlan.days || !Array.isArray(mealPlan.days)) {
    console.error('Invalid meal plan structure:', mealPlan);
    throw new Error('Failed to generate proper meal plan structure. Please try again.');
  }
  
  // Verify we got 7 days
  if (mealPlan.days.length !== 7) {
    console.error('ERROR: GPT only returned', mealPlan.days.length, 'days instead of 7!');
    throw new Error('Meal plan must include all 7 days of the week. Please try again.');
  }
  
  // Verify each day has required meals (only check for selected meal types)
  const requiredMeals = [];
  if (safeProfile.mealTypes.includes('Breakfast')) requiredMeals.push('breakfast');
  if (safeProfile.mealTypes.includes('Lunch')) requiredMeals.push('lunch');
  if (safeProfile.mealTypes.includes('Dinner')) requiredMeals.push('dinner');
  
  console.log('Required meals to validate:', requiredMeals);
  
  for (let i = 0; i < mealPlan.days.length; i++) {
    const day = mealPlan.days[i];
    if (!day.meals) {
      console.error(`Day ${i + 1} is missing meals object:`, day);
      throw new Error(`Incomplete meal plan: ${day.day || 'Day ' + (i + 1)} is missing meals. Please try again.`);
    }
    
    // Check only for required meal types
    const missingMeals = [];
    for (const mealType of requiredMeals) {
      if (!day.meals[mealType]) {
        missingMeals.push(mealType);
      }
    }
    
    if (missingMeals.length > 0) {
      console.error(`Day ${i + 1} is missing required meals:`, day);
      console.error('Required meals:', requiredMeals);
      console.error('Missing meals:', missingMeals);
      throw new Error(`Incomplete meal plan: ${day.day || 'Day ' + (i + 1)} is missing ${missingMeals.join(', ')}. Please try again.`);
    }
  }
  
  return mealPlan;
};

const mockShoppingList = {
  shoppingList: {
    sections: [
      {
        category: "Produce",
        items: [
          { name: "Tomatoes", quantity: 3, unit: "lbs", estimatedPrice: 5.97 },
          { name: "Lettuce", quantity: 2, unit: "heads", estimatedPrice: 3.98 },
          { name: "Onions", quantity: 2, unit: "lbs", estimatedPrice: 2.50 },
          { name: "Bell Peppers", quantity: 4, unit: "count", estimatedPrice: 4.00 }
        ]
      },
      {
        category: "Meat",
        items: [
          { name: "Ground Beef", quantity: 2, unit: "lbs", estimatedPrice: 11.98 },
          { name: "Chicken Breast", quantity: 3, unit: "lbs", estimatedPrice: 14.97 },
          { name: "Bacon", quantity: 1, unit: "package", estimatedPrice: 5.99 },
          { name: "Salmon", quantity: 1.5, unit: "lbs", estimatedPrice: 13.99 }
        ]
      },
      {
        category: "Dairy",
        items: [
          { name: "Milk", quantity: 1, unit: "gallon", estimatedPrice: 3.99 },
          { name: "Eggs", quantity: 2, unit: "dozen", estimatedPrice: 5.98 },
          { name: "Cheese", quantity: 2, unit: "lbs", estimatedPrice: 7.98 },
          { name: "Greek Yogurt", quantity: 4, unit: "cups", estimatedPrice: 4.99 }
        ]
      },
      {
        category: "Grains",
        items: [
          { name: "Bread", quantity: 2, unit: "loaves", estimatedPrice: 3.98 },
          { name: "Rice", quantity: 1, unit: "bag", estimatedPrice: 4.99 },
          { name: "Pasta", quantity: 2, unit: "boxes", estimatedPrice: 2.98 },
          { name: "Oatmeal", quantity: 1, unit: "container", estimatedPrice: 3.99 }
        ]
      }
    ]
  },
  totalCost: 97.25,
  weeklyBudget: 100,
  moneySavingTips: [
    "Buy generic brands to save 20-30%",
    "Check for weekly specials and coupons",
    "Consider buying meat in bulk and freezing",
    "Use seasonal produce for better prices"
  ]
};

export const generateShoppingList = async (mealPlan, pantryItems, profile) => {
  // Return mock data in dev mode
  if (DEV_MODE) {
    return new Promise(resolve => {
      setTimeout(() => resolve(mockShoppingList), 2000);
    });
  }

  try {
    // Debug logging
    console.log('Shopping List Generation - Profile received:', profile);
    console.log('Meal Plan:', mealPlan);
    console.log('Pantry Items:', pantryItems);
    console.log('Dairy Preferences:', profile?.dairyPreferences);
  
  const safeProfile = {
    weeklyBudget: profile.weeklyBudget || 100,
    stickToBudget: profile.stickToBudget || false,
    adults: profile.adults || 1,
    kids: profile.kids || 0,
    dairyPreferences: profile.dairyPreferences || {},
    dietType: profile.dietType || 'Standard',
    restrictions: profile.restrictions || [],
    allergies: profile.allergies || [],
    zipCode: profile.zipCode || '72762',
    snackTypes: profile.snackTypes || []
  };
  
  console.log('Safe Profile Dairy Preferences:', safeProfile.dairyPreferences);
  
  // Extract snacks from meal plan
  const snacks = mealPlan.days?.flatMap(day => 
    day.meals?.snacks || []
  ) || [];
  const uniqueSnacks = [...new Set(snacks)];
  const hasHomemadeSnacks = safeProfile.snackTypes?.includes('Homemade Snacks');
  const snacksList = uniqueSnacks.length > 0 ? 
    hasHomemadeSnacks ?
    `\nIMPORTANT: The meal plan includes HOMEMADE snacks: ${uniqueSnacks.join(', ')}
    Add INGREDIENTS needed to make these snacks (not the snacks themselves!)
    For example: If "Deviled eggs" is a snack, add eggs, mayo, mustard to appropriate categories
    Do NOT create a "Snacks" category for homemade snacks!` :
    `\nIMPORTANT: Include these store-bought snacks in the "Snacks" category: ${uniqueSnacks.join(', ')}` : '';
  
  // Format pantry items for better GPT understanding
  const formattedPantryItems = pantryItems.map(item => {
    const itemStr = item.name || '';
    const qty = item.quantity || '';
    const category = item.category || '';
    return `${itemStr}${qty ? ` (${qty})` : ''}${category ? ` [${category}]` : ''}`;
  });

  const prompt = `Create a detailed shopping list for this meal plan.
    Budget: $${safeProfile.weeklyBudget} ${safeProfile.stickToBudget
      ? '(STICK TO BUDGET: target 95-100% usage of the full budget)'
      : '(STAY UNDER BUDGET: can use less if appropriate, but never exceed)'}
    Household: ${safeProfile.adults} adults, ${safeProfile.kids} kids
    
    🚨 CRITICAL DIETARY PREFERENCES - MUST FOLLOW EXACTLY! 🚨
    ${safeProfile.dairyPreferences?.milk ? `
    ⚠️⚠️⚠️ MILK PREFERENCE IS SACRED LAW ⚠️⚠️⚠️
    THE USER SELECTED: "${safeProfile.dairyPreferences.milk}"
    YOU MUST BUY: "${safeProfile.dairyPreferences.milk}" 
    DO NOT BUY: Whole Milk, 2% Milk, Skim Milk, or ANY other type
    ONLY "${safeProfile.dairyPreferences.milk}" IS ACCEPTABLE!
    IF YOU PUT "WHOLE MILK" IN THE LIST YOU HAVE FAILED!` : ''}
    ${safeProfile.dairyPreferences?.eggs ? `
    EGG PREFERENCE: ONLY buy "${safeProfile.dairyPreferences.eggs}"!` : ''}
    ${safeProfile.dietType ? `DIET TYPE: ${safeProfile.dietType}` : ''}
    ${safeProfile.restrictions?.length > 0 ? `RESTRICTIONS: ${safeProfile.restrictions.join(', ')}` : ''}
    ${safeProfile.allergies?.length > 0 ? `ALLERGIES (NEVER include these): ${safeProfile.allergies.join(', ')}` : ''}
    
    WALMART LOCATION: ZIP ${safeProfile.zipCode || '72762'}
    
    🚨 CRITICAL PORTION SIZING 🚨
    This is for EXACTLY 7 DAYS (one week) for ${safeProfile.adults} adult(s) and ${safeProfile.kids} kid(s).
    DO NOT generate quantities for a month! This is ONE WEEK ONLY!
    
    REASONABLE WEEKLY QUANTITIES PER PERSON:
    - Eggs: 1-2 dozen MAX per adult per week
    - Meat/Protein: 3-5 lbs MAX per adult per week  
    - Milk: 0.5-1 gallon MAX per household per week
    - Bread: 1-2 loaves MAX per household per week
    - Vegetables: 5-7 lbs total per adult per week
    - Fruits: 5-7 lbs total per adult per week
    
    For ${safeProfile.adults} adult(s), that means:
    - Eggs: ${safeProfile.adults * 2} dozen MAXIMUM for the week (and ONLY if eggs are in the meals!)
    - Meat: ${safeProfile.adults * 5} lbs MAXIMUM for the week
    - Bacon: 1-2 packages MAXIMUM for the week
    
    🚫 DO NOT ADD EGGS UNLESS:
    - A meal specifically mentions eggs (scrambled eggs, fried eggs, egg salad, etc.)
    - A recipe requires eggs as an ingredient (baking, breading, etc.)
    
    If you add 4 dozen eggs for meals that don't use eggs, YOU HAVE FAILED!
    
    CRITICAL: Make EVERY item EXTREMELY SPECIFIC for accurate Walmart searches!
    Include for EACH item:
    1. BRAND NAME (Great Value, Tyson, Hormel, etc.)
    2. EXACT SIZE/QUANTITY (1 gallon, 24 oz package, 2 lb bag)
    3. PRODUCT DETAILS (Whole milk, 2%, Boneless Skinless, etc.)
    
    EXAMPLE FORMAT:
    ❌ WRONG: {"name": "Chicken", "quantity": 2, "unit": "lbs", "estimatedPrice": 10.00}
    ✅ RIGHT: {"name": "Tyson Boneless Skinless Chicken Breasts", "quantity": 1, "unit": "2.5 lb package", "estimatedPrice": 11.98}

    ❌ WRONG: {"name": "Milk", "quantity": 1, "unit": "gallon", "estimatedPrice": 5.00}
    ✅ RIGHT: {"name": "Great Value Whole Milk", "quantity": 1, "unit": "gallon", "estimatedPrice": 3.48}

    CRITICAL: If quantity > 1, estimatedPrice = TOTAL COST (quantity × unit price)
    Example: If buying 4 ribeye steaks at $19.98 each:
    ✅ RIGHT: {"name": "Beef Ribeye Steak", "quantity": 4, "unit": "steaks", "estimatedPrice": 79.92}
    ❌ WRONG: {"name": "Beef Ribeye Steak", "quantity": 4, "unit": "steaks", "estimatedPrice": 19.98}
    
    NOTICE: Real prices like $3.48, $11.98 - NOT fake round numbers like $5.00, $10.00!
    
    Be SPECIFIC - users need exact product matches!
    
    🍽️ ACTUAL MEAL PLAN TO SHOP FOR (ANALYZE EACH MEAL CAREFULLY):
    ${JSON.stringify(mealPlan, null, 2)}
    
    ⚠️ CRITICAL: You MUST analyze the EXACT meals above and ONLY buy ingredients for THOSE specific meals!
    - Count how many times each ingredient appears across all meals
    - Include ingredients for BOTH main dishes AND side dishes
    - If a meal doesn't use eggs, DON'T buy eggs
    - If no meals have milk, DON'T buy milk
    - ONLY purchase what's needed for the actual meals listed above

    🔴🔴🔴 CRITICAL PANTRY CHECK - DO NOT BUY THESE ITEMS! 🔴🔴🔴
    ⚠️ THE FOLLOWING ITEMS ARE ALREADY IN THE PANTRY - DO NOT ADD TO SHOPPING LIST! ⚠️

    ${pantryItems.length > 0 ? `PANTRY INVENTORY (${pantryItems.length} items):
    ${formattedPantryItems.map(item => `    ✓ ${item}`).join('\n')}

    MANDATORY RULES:
    1. Check EVERY ingredient against this pantry list BEFORE adding to shopping
    2. If an item EXISTS in pantry with sufficient quantity, SKIP IT completely
    3. If pantry has partial quantity, ONLY buy the difference needed
    4. For example: If recipe needs 2 lbs chicken and pantry has "Chicken (1 lb)", only buy 1 lb more

    VERIFICATION CHECKLIST:
    - [ ] Did you check if eggs are in pantry before adding eggs?
    - [ ] Did you check if milk is in pantry before adding milk?
    - [ ] Did you check if chicken is in pantry before adding chicken?
    - [ ] Did you subtract pantry quantities from needed amounts?

    ⚠️ If you add items that are already in the pantry, the user will have duplicates and waste money!` :
    '📦 PANTRY STATUS: Empty - need to buy all ingredients'}

    REMEMBER: Only buy what's MISSING from the pantry!
    ${snacksList}
    
    Return ONLY valid JSON with COMPLETE item details including prices:
    
    ⚠️ EVERY item MUST have ALL these fields:
    - name: specific product name
    - quantity: numeric amount
    - unit: measurement unit
    - estimatedPrice: REQUIRED - ACTUAL Walmart price (like $3.48, $7.92, $12.74 - NOT round numbers!)
    
    {
      "shoppingList": {
        "sections": [
          {
            "category": "Produce",
            "items": [
              {"name": "Bananas", "quantity": 3, "unit": "lbs", "estimatedPrice": 1.77, "walmartId": "44390948"}
            ]
          },
          {
            "category": "Snacks",
            "items": [
              {"name": "Nature Valley Crunchy Granola Bars", "quantity": 2, "unit": "boxes", "estimatedPrice": 5.98, "walmartId": "10309207"}
            ]
          }
        ]
      },
      "totalCost": 0.00,
      "weeklyBudget": ${safeProfile.weeklyBudget},
      "moneySavingTips": ["tip1", "tip2"]
    }

    CRITICAL: The totalCost field MUST be the sum of ALL items' estimatedPrice values!
    Example: If you have 3 items at $5.99, $3.49, and $12.98, totalCost = 22.46`;

  const response = await callGPT([
    { role: 'system', content: `You are a JSON API that creates shopping lists. Return ONLY valid JSON - no explanations or additional text.

    You are a Walmart shopping list expert for ZIP ${safeProfile.zipCode || '72762'}.

    🔴 CRITICAL RULES 🔴
    1. CHECK PANTRY FIRST - DO NOT buy items already in pantry
    2. Return ONLY valid JSON starting with { and ending with }
    3. NO text before or after the JSON object
    4. Follow user's dietary preferences EXACTLY

    PRICING RULES:
    1. Use ACTUAL Walmart prices (e.g., Great Value Milk 1 Gallon: ~$3.48, Eggs dozen: ~$2.98)
    2. DO NOT make up round numbers like $5.00, $10.00 - use real prices like $4.87, $3.24, $11.98
    3. If budget is tight, choose cheaper brands (Great Value) or smaller quantities
    4. The total should naturally vary (e.g., $67.43, $84.21, $92.15) based on actual item costs
    
    🚨 ABSOLUTE RULE: ONLY buy ingredients that are ACTUALLY NEEDED for the specific meals in the meal plan!
    - If the meals don't include eggs, DON'T add eggs to the list
    - If the meals don't need milk, DON'T add milk
    - Read EVERY meal name carefully and determine what ingredients it needs
    - DO NOT add generic staples unless they're specifically needed for the meals
    
    🔥 HOLY COMMANDMENTS FOR SHOPPING LIST 🔥

    1. PANTRY CHECK IS YOUR FIRST COMMANDMENT:
       - CHECK PANTRY BEFORE ADDING ANY ITEM!
       - If it's in the pantry with sufficient quantity = DO NOT BUY
       - If pantry has partial quantity = BUY ONLY THE DIFFERENCE
       - Example: Need 3 lbs chicken, pantry has 1 lb = Buy only 2 lbs
       - Ignoring pantry = COMPLETE FAILURE!

    2. DAIRY PREFERENCES ARE ABSOLUTE LAW:
       ${safeProfile.dairyPreferences?.milk ? `
       🥛 MILK COMMANDMENT 🥛
       - THE USER WANTS: "${safeProfile.dairyPreferences.milk}"
       - YOU MUST BUY: "Great Value ${safeProfile.dairyPreferences.milk} 1 Gallon"
       - NEVER BUY: "Great Value Whole Vitamin D Milk" or any whole milk
       - NEVER BUY: Any milk type other than "${safeProfile.dairyPreferences.milk}"
       - Example: If user wants "1% Milk", buy "Great Value 1% Milk 1 Gallon"
       - DO NOT DEFAULT TO WHOLE MILK EVER!` : ''}
       ${safeProfile.dairyPreferences?.eggs ? `
       🥚 EGG COMMANDMENT 🥚
       - ONLY buy: "${safeProfile.dairyPreferences.eggs}"` : ''}
       - Violating these preferences = COMPLETE FAILURE!
    
    3. PROFILE SETTINGS ARE GOSPEL:
       - Budget: $${safeProfile.weeklyBudget} ${safeProfile.stickToBudget ? '(USE 95-100% of budget)' : '(NEVER exceed)'}
       - Household: ${safeProfile.adults} adult(s), ${safeProfile.kids} kid(s)
       - Diet: ${safeProfile.dietType} - Follow it like scripture!
       ${safeProfile.dietType === 'Carnivore' ? `
       CARNIVORE SHOPPING LIST RULES:
       - ONLY buy: Meat, Fish, Eggs, optional Cheese/Butter
       - NEVER buy: Bread, Fruits, Vegetables, Grains, Nuts, Seeds, Plant oils
       - NO Bakery section items EVER
       - NO Produce section items EVER
       - If you add bread or plants to a carnivore shopping list, you FAILED!` : ''}
    
    4. CRITICAL PRICING ACCURACY (2025 Walmart prices):
       - Eggs: $3-5 per dozen (NOT $1-2)
       - Chicken breast: $3-4 per pound (NOT $1-2)
       - Ground beef: $4-6 per pound
       - Milk: $3-4 per gallon (MUST BE ${safeProfile.dairyPreferences?.milk || 'user preferred'} type!)
       - Bread: $2-3 per loaf
       - Bacon: $5-7 per package
       - Cheese: $3-5 per 8oz block
       - Fresh produce: $1-3 per pound average

    5. PORTION CONTROL for ${safeProfile.adults} adult(s) for 7 days:
       - Eggs: ${safeProfile.adults * 2} dozen MAXIMUM
       - Total meat: ${safeProfile.adults * 5} lbs MAXIMUM
       - Milk: 1 gallon MAXIMUM
       - Bread: 1-2 loaves MAXIMUM

    6. SNACK QUANTITIES for ${safeProfile.adults} adult(s) and ${safeProfile.kids} kid(s):
       - Total people: ${safeProfile.adults + safeProfile.kids}
       - Snacks needed: ${(safeProfile.adults + safeProfile.kids) * 1}-${(safeProfile.adults + safeProfile.kids) * 2} snack items for the week
       - NOT 7-8 different snack products for 1 person!
       - Snacks MUST match ${safeProfile.dietType} diet requirements
    
    PRICE CALCULATION RULE:
    The "estimatedPrice" field MUST be the TOTAL COST for that line item:
    - If quantity = 1: estimatedPrice = unit price
    - If quantity > 1: estimatedPrice = quantity × unit price
    Example: 4 ribeye steaks at $19.98 each = estimatedPrice: 79.92 (NOT 19.98!)

    🔴 MANDATORY: Calculate totalCost field! 🔴
    The totalCost field MUST be the sum of ALL estimatedPrice values from ALL sections.

    CRITICAL: Return ONLY valid JSON. No explanations, no text before or after.
    START your response with { and END with }` },
    { role: 'user', content: prompt }
  ], 300000); // 5 minute timeout

  let result;
  try {
    // Try to extract JSON if the response has extra text
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = JSON.parse(response);
    }
  } catch (parseError) {
    console.error('Failed to parse shopping list JSON response:', response);
    console.error('Parse error:', parseError);

    // Create a basic shopping list as fallback
    console.log('Creating fallback shopping list...');
    result = {
      shoppingList: {
        sections: [
          {
            category: "Produce",
            items: []
          },
          {
            category: "Meat & Seafood",
            items: []
          },
          {
            category: "Dairy",
            items: []
          },
          {
            category: "Pantry",
            items: []
          }
        ]
      },
      totalCost: 0,
      weeklyBudget: safeProfile.weeklyBudget,
      moneySavingTips: ["Shopping list generation had issues - please try again"]
    };

    // Try to extract items from the meal plan manually
    if (mealPlan && mealPlan.days) {
      const estimatedCostPerMeal = safeProfile.weeklyBudget / 21;
      result.totalCost = estimatedCostPerMeal * 21;
    }

    console.warn('Using fallback shopping list due to parse error');
  }

  // Post-process to ensure milk preference is respected
  if (safeProfile.dairyPreferences?.milk) {
    console.log('POST-PROCESSING: Enforcing milk preference:', safeProfile.dairyPreferences.milk);
    
    // Check both possible structures
    const sectionsToCheck = result.shoppingList?.sections || result.sections || [];
    
    sectionsToCheck.forEach(section => {
      if (section.items) {
        section.items.forEach(item => {
          // Check if this is a milk item
          if (item.name && item.name.toLowerCase().includes('milk') && 
              !item.name.toLowerCase().includes('almond') && 
              !item.name.toLowerCase().includes('soy') &&
              !item.name.toLowerCase().includes('coconut') &&
              !item.name.toLowerCase().includes('oat')) {
            
            // Force it to be the correct milk type
            const oldName = item.name;
            
            // Replace any type of milk with the user's preference
            if (item.name.toLowerCase().includes('whole') || 
                item.name.toLowerCase().includes('2%') || 
                item.name.toLowerCase().includes('skim') ||
                item.name.toLowerCase().includes('vitamin d')) {
              
              // Replace the milk type
              item.name = `Great Value ${safeProfile.dairyPreferences.milk} 1 Gallon`;
              console.log(`CORRECTED: Changed "${oldName}" to "${item.name}"`);
            }
          }
        });
      }
    });
  }
  
  // Log if any items are missing prices (but don't override)
  const checkPrices = (sections) => {
    sections.forEach(section => {
      if (section.items) {
        section.items.forEach(item => {
          if (!item.estimatedPrice || item.estimatedPrice === 0) {
            console.warn(`Missing price for ${item.name} - AI should provide realistic Walmart prices`);
          }
        });
      }
    });
  };
  
  // Check both possible structures
  if (result.shoppingList?.sections) {
    checkPrices(result.shoppingList.sections);
  }
  if (result.sections) {
    checkPrices(result.sections);
  }

  // Calculate totalCost if it's missing or zero
  let calculatedTotal = 0;
  const sectionsToProcess = result.shoppingList?.sections || result.sections || [];

  sectionsToProcess.forEach(section => {
    if (section.items) {
      section.items.forEach(item => {
        if (item.estimatedPrice && typeof item.estimatedPrice === 'number') {
          calculatedTotal += item.estimatedPrice;
        }
      });
    }
  });

  // If totalCost is missing or zero, use our calculated total
  if (!result.totalCost || result.totalCost === 0) {
    result.totalCost = calculatedTotal;
    console.log('Calculated total cost from items:', calculatedTotal.toFixed(2));
  }

  // Also update it in the nested structure if it exists
  if (result.shoppingList) {
    if (!result.shoppingList.totalCost || result.shoppingList.totalCost === 0) {
      result.shoppingList.totalCost = calculatedTotal;
    }
  }

  return result;
  } catch (error) {
    console.error('Error in generateShoppingList:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Shopping list generation failed: ${error.message || 'Unknown error occurred'}`);
  }
};

export const generateCustomMeal = async (mealName, profile, mealType) => {
  // Return mock custom meal in dev mode
  if (DEV_MODE) {
    return new Promise(resolve => {
      setTimeout(() => resolve({
        name: mealName,
        estimatedCost: 7.50,
        cookingTime: 25,
        difficulty: "easy",
        nutrition: {
          calories: 450,
          protein: 35,
          carbs: 45,
          fat: 15
        }
      }), 1000);
    });
  }

  // Ensure profile has all needed fields
  const safeProfile = {
    weeklyBudget: profile?.weeklyBudget || 100,
    dietType: profile?.dietType || 'Standard',
    customDiet: profile?.customDiet || '',
    cookingTools: profile?.cookingTools || ['Stovetop', 'Microwave', 'Oven'],
    mealDifficulty: profile?.mealDifficulty || 'Medium (15-30 min)',
    adults: profile?.adults || 1,
    kids: profile?.kids || 0,
    dietaryRestrictions: profile?.dietaryRestrictions || '',
    allergies: profile?.allergies || [],
    dislikedFoods: profile?.dislikedFoods || [],
    customDislikedFoods: profile?.customDislikedFoods || ''
  };

  const allDislikedFoods = [
    ...(safeProfile.dislikedFoods || []),
    ...(safeProfile.customDislikedFoods ? safeProfile.customDislikedFoods.split(',').map(f => f.trim()) : [])
  ].filter(f => f);

  const prompt = `Generate complete meal details for this ${mealType}: "${mealName}"

    Requirements:
    - Budget: approximately $${(safeProfile.weeklyBudget / 21).toFixed(2)} per meal
    - Servings: ${safeProfile.adults} adults, ${safeProfile.kids} kids
    - Diet: ${safeProfile.dietType}${safeProfile.customDiet ? ` (${safeProfile.customDiet})` : ''}
    - Must use ONLY these cooking tools: ${safeProfile.cookingTools.join(', ')}
    - Difficulty: ${safeProfile.mealDifficulty}
    - Cooking time should match difficulty (Easy: 5-15 min, Medium: 15-30 min, Hard: 30+ min)
    ${safeProfile.dietaryRestrictions ? `- Dietary restrictions: ${safeProfile.dietaryRestrictions}` : ''}
    ${safeProfile.allergies?.length > 0 ? `- ALLERGIES (NEVER include): ${safeProfile.allergies.join(', ')}` : ''}
    ${allDislikedFoods.length > 0 ? `- DISLIKED FOODS (avoid): ${allDislikedFoods.join(', ')}` : ''}

    CRITICAL:
    - The meal name MUST be "${mealName}" exactly as provided
    - Must be appropriate for ${mealType} time
    - Follow ALL dietary restrictions strictly

    Return ONLY valid JSON with realistic values:
    {
      "name": "${mealName}",
      "estimatedCost": 8.50,
      "cookingTime": 25,
      "difficulty": "medium",
      "nutrition": {
        "calories": 450,
        "protein": 30,
        "carbs": 45,
        "fat": 18
      }
    }`;

  try {
    const response = await callGPT([
      { role: 'system', content: `You are a meal planning expert specializing in ${mealType} meals.

      CRITICAL RULES:
      1. The meal name MUST be exactly "${mealName}" as the user requested
      2. Follow ${safeProfile.dietType} diet requirements STRICTLY
      3. Use realistic Walmart prices for budget calculations
      4. Ensure cooking time matches the difficulty level
      5. ${mealType === 'breakfast' ? 'Ensure it\'s appropriate for morning meals' : ''}
      6. ${mealType === 'lunch' ? 'Ensure it\'s appropriate for midday meals' : ''}
      7. ${mealType === 'dinner' ? 'Ensure it\'s appropriate for evening meals' : ''}

      Return ONLY valid JSON. No explanatory text.` },
      { role: 'user', content: prompt }
    ], 60000); // 60 second timeout

    let result;
    try {
      // Try to extract JSON if the response has extra text
      let jsonStr = response;

      // If response contains ```json markers, extract the JSON
      if (response.includes('```json')) {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
      } else if (response.includes('```')) {
        const jsonMatch = response.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
      }

      // Try to find JSON object in the response
      const jsonStartIndex = jsonStr.indexOf('{');
      const jsonEndIndex = jsonStr.lastIndexOf('}');
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
      }

      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse custom meal JSON:', response);
      console.error('Parse error:', parseError);
      // Create a fallback result
      result = {
        name: mealName,
        estimatedCost: (safeProfile.weeklyBudget / 21),
        cookingTime: 20,
        difficulty: "medium",
        nutrition: {
          calories: 400,
          protein: 25,
          carbs: 40,
          fat: 15
        }
      };
    }

    // Validate and fix the response
    if (!result.name || result.name.trim() === '') {
      result.name = mealName;
    }
    if (!result.estimatedCost || result.estimatedCost <= 0) {
      result.estimatedCost = (safeProfile.weeklyBudget / 21);
    }
    if (!result.cookingTime || result.cookingTime <= 0) {
      result.cookingTime = 20;
    }
    if (!result.difficulty) {
      result.difficulty = "medium";
    }
    if (!result.nutrition) {
      result.nutrition = {
        calories: 400,
        protein: 25,
        carbs: 40,
        fat: 15
      };
    }

    return result;
  } catch (error) {
    console.error('Error in generateCustomMeal:', error);

    // Return a basic meal with the user's custom name
    return {
      name: mealName,
      estimatedCost: (safeProfile.weeklyBudget / 21),
      cookingTime: 20,
      difficulty: "medium",
      nutrition: {
        calories: 400,
        protein: 25,
        carbs: 40,
        fat: 15
      }
    };
  }
};

export const replaceMeal = async (currentMeal, profile, pantryItems, mealType) => {
  // Return mock replacement meal in dev mode
  if (DEV_MODE) {
    const replacements = {
      breakfast: { name: "Avocado Toast with Eggs", estimatedCost: 4.50, cookingTime: 15, difficulty: "easy", nutrition: {calories: 350, protein: 15, carbs: 30, fat: 20} },
      lunch: { name: "Asian Chicken Salad", estimatedCost: 7.00, cookingTime: 20, difficulty: "easy", nutrition: {calories: 450, protein: 30, carbs: 25, fat: 15} },
      dinner: { name: "Stir Fry Vegetables with Rice", estimatedCost: 8.50, cookingTime: 25, difficulty: "medium", nutrition: {calories: 550, protein: 25, carbs: 60, fat: 18} }
    };
    return new Promise(resolve => {
      setTimeout(() => resolve(replacements[mealType] || replacements.dinner), 1000);
    });
  }

  // Ensure profile has all required fields
  const safeProfile = {
    dietType: profile?.dietType || 'Standard',
    customDiet: profile?.customDiet || '',
    cookingTools: profile?.cookingTools || ['Stovetop', 'Microwave', 'Oven'],
    mealDifficulty: profile?.mealDifficulty || 'Medium (15-30 min)',
    adults: profile?.adults || 1,
    kids: profile?.kids || 0,
    dietaryRestrictions: profile?.dietaryRestrictions || '',
    allergies: profile?.allergies || [],
    dislikedFoods: profile?.dislikedFoods || [],
    customDislikedFoods: profile?.customDislikedFoods || '',
    weeklyBudget: profile?.weeklyBudget || 100
  };

  const allDislikedFoods = [
    ...(safeProfile.dislikedFoods || []),
    ...(safeProfile.customDislikedFoods ? safeProfile.customDislikedFoods.split(',').map(f => f.trim()) : [])
  ].filter(f => f);

  const prompt = `Generate a REPLACEMENT ${mealType} meal.
    Current meal to replace: "${currentMeal.name}"

    REQUIREMENTS:
    - Budget: approximately $${currentMeal.estimatedCost || (safeProfile.weeklyBudget / 21).toFixed(2)} per meal
    - Servings: ${safeProfile.adults} adults, ${safeProfile.kids} kids
    - Diet: ${safeProfile.dietType}${safeProfile.customDiet ? ` (${safeProfile.customDiet})` : ''}
    - Must use ONLY these cooking tools: ${safeProfile.cookingTools.join(', ')}
    - Difficulty: ${safeProfile.mealDifficulty}
    - Cooking time should match difficulty (Easy: 5-15 min, Medium: 15-30 min, Hard: 30+ min)
    ${safeProfile.dietaryRestrictions ? `- Dietary restrictions: ${safeProfile.dietaryRestrictions}` : ''}
    ${safeProfile.allergies?.length > 0 ? `- ALLERGIES (NEVER include): ${safeProfile.allergies.join(', ')}` : ''}
    ${allDislikedFoods.length > 0 ? `- DISLIKED FOODS (avoid): ${allDislikedFoods.join(', ')}` : ''}

    CRITICAL:
    - Must be DIFFERENT from "${currentMeal.name}"
    - Must follow ALL dietary restrictions strictly
    - Must be appropriate for ${mealType} time

    Return ONLY valid JSON with realistic values:
    {
      "name": "Different meal name here",
      "estimatedCost": 8.50,
      "cookingTime": 25,
      "difficulty": "medium",
      "nutrition": {
        "calories": 450,
        "protein": 30,
        "carbs": 45,
        "fat": 18
      }
    }`;

  try {
    const response = await callGPT([
      { role: 'system', content: `You are a meal planning expert specializing in ${mealType} meals.

      CRITICAL RULES:
      1. Generate a DIFFERENT meal from "${currentMeal.name}"
      2. Follow ${safeProfile.dietType} diet requirements STRICTLY
      3. Use realistic Walmart prices for budget calculations
      4. Ensure cooking time matches the difficulty level
      5. ${mealType === 'breakfast' ? 'Create quick, morning-appropriate meals' : ''}
      6. ${mealType === 'lunch' ? 'Create portable or quick lunch options' : ''}
      7. ${mealType === 'dinner' ? 'Create satisfying dinner meals' : ''}

      Return ONLY valid JSON. No explanatory text.` },
      { role: 'user', content: prompt }
    ], 60000); // 60 second timeout

    let result;
    try {
      // Try to extract JSON if the response has extra text
      let jsonStr = response;

      // If response contains ```json markers, extract the JSON
      if (response.includes('```json')) {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
      } else if (response.includes('```')) {
        const jsonMatch = response.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
      }

      // Try to find JSON object in the response
      const jsonStartIndex = jsonStr.indexOf('{');
      const jsonEndIndex = jsonStr.lastIndexOf('}');
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        jsonStr = jsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
      }

      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse replacement meal JSON:', response);
      console.error('Parse error:', parseError);
      // Don't throw - fall through to use fallback meals below
      result = null;
    }

    // Validate the response has required fields or use fallback
    if (!result || !result.name || result.name === currentMeal.name) {
      console.log('Invalid result or same meal name, using fallback meals');
      // Use fallback meals directly instead of throwing
      const fallbackMeals = {
        breakfast: [
          { name: "Scrambled Eggs with Toast", estimatedCost: 4.50, cookingTime: 15, difficulty: "easy", nutrition: {calories: 350, protein: 20, carbs: 30, fat: 15} },
          { name: "Oatmeal with Fresh Fruit", estimatedCost: 3.50, cookingTime: 10, difficulty: "easy", nutrition: {calories: 300, protein: 8, carbs: 55, fat: 6} },
          { name: "Yogurt Parfait with Granola", estimatedCost: 4.00, cookingTime: 5, difficulty: "easy", nutrition: {calories: 280, protein: 12, carbs: 45, fat: 8} }
        ],
        lunch: [
          { name: "Grilled Chicken Salad", estimatedCost: 7.50, cookingTime: 20, difficulty: "easy", nutrition: {calories: 420, protein: 35, carbs: 20, fat: 18} },
          { name: "Turkey and Cheese Sandwich", estimatedCost: 6.00, cookingTime: 10, difficulty: "easy", nutrition: {calories: 450, protein: 25, carbs: 40, fat: 20} },
          { name: "Chicken Caesar Wrap", estimatedCost: 6.50, cookingTime: 15, difficulty: "easy", nutrition: {calories: 480, protein: 30, carbs: 35, fat: 22} }
        ],
        dinner: [
          { name: "Baked Chicken with Vegetables", estimatedCost: 9.00, cookingTime: 35, difficulty: "medium", nutrition: {calories: 520, protein: 40, carbs: 30, fat: 25} },
          { name: "Spaghetti with Meat Sauce", estimatedCost: 8.50, cookingTime: 30, difficulty: "medium", nutrition: {calories: 580, protein: 28, carbs: 65, fat: 20} },
          { name: "Grilled Salmon with Rice", estimatedCost: 11.00, cookingTime: 25, difficulty: "medium", nutrition: {calories: 490, protein: 35, carbs: 40, fat: 22} }
        ]
      };

      const meals = fallbackMeals[mealType] || fallbackMeals.dinner;
      const differentMeal = meals.find(m => m.name !== currentMeal.name) || meals[0];
      return differentMeal;
    }

    if (!result.estimatedCost || result.estimatedCost <= 0) {
      result.estimatedCost = currentMeal.estimatedCost || 7.00;
    }
    if (!result.cookingTime || result.cookingTime <= 0) {
      result.cookingTime = 20;
    }
    if (!result.difficulty) {
      result.difficulty = 'medium';
    }
    if (!result.nutrition) {
      result.nutrition = {
        calories: 400,
        protein: 20,
        carbs: 40,
        fat: 15
      };
    }

    return result;
  } catch (error) {
    console.error('Error in replaceMeal:', error);

    // Return a fallback meal if generation fails
    const fallbackMeals = {
      breakfast: [
        { name: "Scrambled Eggs with Toast", estimatedCost: 4.50, cookingTime: 15, difficulty: "easy", nutrition: {calories: 350, protein: 20, carbs: 30, fat: 15} },
        { name: "Oatmeal with Fresh Fruit", estimatedCost: 3.50, cookingTime: 10, difficulty: "easy", nutrition: {calories: 300, protein: 8, carbs: 55, fat: 6} },
        { name: "Yogurt Parfait with Granola", estimatedCost: 4.00, cookingTime: 5, difficulty: "easy", nutrition: {calories: 280, protein: 12, carbs: 45, fat: 8} }
      ],
      lunch: [
        { name: "Grilled Chicken Salad", estimatedCost: 7.50, cookingTime: 20, difficulty: "easy", nutrition: {calories: 420, protein: 35, carbs: 20, fat: 18} },
        { name: "Turkey and Cheese Sandwich", estimatedCost: 6.00, cookingTime: 10, difficulty: "easy", nutrition: {calories: 450, protein: 25, carbs: 40, fat: 20} },
        { name: "Chicken Caesar Wrap", estimatedCost: 6.50, cookingTime: 15, difficulty: "easy", nutrition: {calories: 480, protein: 30, carbs: 35, fat: 22} }
      ],
      dinner: [
        { name: "Baked Chicken with Vegetables", estimatedCost: 9.00, cookingTime: 35, difficulty: "medium", nutrition: {calories: 520, protein: 40, carbs: 30, fat: 25} },
        { name: "Spaghetti with Meat Sauce", estimatedCost: 8.50, cookingTime: 30, difficulty: "medium", nutrition: {calories: 580, protein: 28, carbs: 65, fat: 20} },
        { name: "Grilled Salmon with Rice", estimatedCost: 11.00, cookingTime: 25, difficulty: "medium", nutrition: {calories: 490, protein: 35, carbs: 40, fat: 22} }
      ]
    };

    const meals = fallbackMeals[mealType] || fallbackMeals.dinner;
    // Find a meal that's different from the current one
    const differentMeal = meals.find(m => m.name !== currentMeal.name) || meals[0];

    console.log('Using fallback meal due to error:', differentMeal.name);
    return differentMeal;
  }
};

export const getDetailedRecipe = async (meal, profile) => {
  // Determine if this is meal prep mode and calculate servings
  const isMealPrep = profile?.prepStyle === 'Weekly Meal Prep';
  const baseServings = (profile?.adults || 1) + (profile?.kids || 0);
  
  // For meal prep, we need 7 days worth of the meal
  const totalServings = isMealPrep ? baseServings * 7 : baseServings;
  
  // Return mock recipe details in dev mode
  if (DEV_MODE) {
    const mockRecipe = {
      name: meal.name,
      servings: totalServings,
      cookingTime: meal.cookingTime || 30,
      cost: meal.estimatedCost || 8.00,
      isMealPrep: isMealPrep,
      ingredients: isMealPrep ? [
        `${14} lbs main protein (for 7 days)`,
        `${7} cups vegetables (for 7 days)`,
        `${14} cups grains or pasta (for 7 days)`,
        "14 tbsp olive oil",
        "Salt and pepper to taste",
        "Fresh herbs for garnish"
      ] : [
        "2 lbs main protein",
        "1 cup vegetables",
        "2 cups grains or pasta",
        "2 tbsp olive oil",
        "Salt and pepper to taste",
        "Fresh herbs for garnish"
      ],
      instructions: isMealPrep ? [
        "MEAL PREP INSTRUCTIONS - Making 7 days worth:",
        "Prepare 7 meal prep containers",
        "Prep all ingredients by washing and chopping vegetables for the entire week",
        "Use multiple large pans or cook in batches",
        "Cook all protein at once until golden brown, about 15-20 minutes",
        "Cook all vegetables in batches until tender",
        "Cook all grains/pasta according to package directions",
        "Let everything cool completely before storing",
        "Divide evenly among 7 containers",
        "Label containers with dates",
        "Store in refrigerator for up to 7 days"
      ] : [
        "Prep all ingredients by washing and chopping vegetables",
        "Heat oil in a large pan over medium heat",
        "Cook protein until golden brown, about 5-7 minutes",
        "Add vegetables and sauté until tender",
        "Season with salt, pepper, and herbs",
        "Serve hot with grains or pasta on the side"
      ],
      nutrition: {
        calories: 450,
        protein: 35,
        carbs: 45,
        fat: 15
      },
      tips: {
        storage: isMealPrep ? 
          "MEAL PREP STORAGE: Store in 7 individual airtight containers. Refrigerate for up to 7 days. For best quality, store containers in the coldest part of your fridge. Consider freezing days 5-7 if preferred." :
          "Store leftovers in an airtight container for up to 3 days",
        reheating: isMealPrep ?
          "MEAL PREP REHEATING: Remove lid, add a splash of water if needed, microwave for 2-3 minutes stirring halfway. Can also reheat in oven at 350°F for 15 minutes covered with foil." :
          "Reheat in microwave for 2-3 minutes or in oven at 350°F for 10 minutes",
        mealPrepTips: isMealPrep ? [
          "Cook on Sunday for the entire week",
          "Use glass containers for better reheating",
          "Keep sauces separate until ready to eat",
          "Add fresh herbs/garnish after reheating",
          "Consider par-cooking vegetables to maintain texture"
        ] : null
      }
    };
    return new Promise(resolve => {
      setTimeout(() => resolve(mockRecipe), 1000);
    });
  }
  
  const mealPrepPrompt = isMealPrep ? `
    CRITICAL: This is for WEEKLY MEAL PREP - the recipe MUST:
    1. Make exactly ${totalServings} servings (${baseServings} people × 7 days)
    2. Include BATCH COOKING instructions for preparing all 7 days at once
    3. Provide detailed STORAGE instructions for keeping in fridge for 7 days
    4. Include REHEATING instructions for each day
    5. Use ingredients that stay fresh for a full week when refrigerated
    6. Scale all ingredient quantities by 7x (not just servings)
    7. Include tips for maintaining food quality over the week
    8. Specify which containers to use (glass recommended)
    9. Note any ingredients to add fresh daily (like dressings or herbs)
    10. Provide day-by-day freshness guidance` : '';

  const prompt = `Provide a detailed recipe for: "${meal.name}"
    ${isMealPrep ? mealPrepPrompt : `Servings needed: ${totalServings}`}
    
    Return ONLY valid JSON:
    {
      "name": "${meal.name}",
      "servings": ${totalServings},
      "cookingTime": ${isMealPrep ? meal.cookingTime * 2 || 60 : meal.cookingTime || 30},
      "cost": ${isMealPrep ? (meal.estimatedCost || 5) * 7 : meal.estimatedCost || 5},
      "isMealPrep": ${isMealPrep},
      "ingredients": ["ingredient 1 with exact quantity", "ingredient 2 with exact quantity"],
      "instructions": ["Step 1 detailed", "Step 2 detailed"],
      "nutrition": {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
      },
      "tips": {
        "storage": "${isMealPrep ? 'Store in 7 individual glass containers in the refrigerator for up to 7 days' : 'Store in airtight container for up to 3 days'}",
        "reheating": "${isMealPrep ? 'Remove from fridge, microwave for 2-3 minutes stirring halfway through' : 'Reheat in microwave or oven'}",
        "mealPrepTips": ${isMealPrep ? '["Cook on Sunday for the week", "Use glass containers", "Keep dressings separate"]' : 'null'}
      }
    }`;

  const systemPrompt = isMealPrep ?
    'You are a professional chef specializing in meal prep. You create recipes that can be batch cooked and stored for an entire week while maintaining quality and freshness. Always multiply ALL ingredients by 7 for weekly meal prep, not just adjust servings.' :
    'You are a professional chef and recipe developer.';

  try {
    const response = await callGPT([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]);

    const recipe = JSON.parse(response);
  
  // Ensure meal prep recipes have proper scaling
  if (isMealPrep && recipe) {
    recipe.isMealPrep = true;
    recipe.servings = totalServings;
    recipe.baseDailyServings = baseServings;
    
    // Ensure tips are properly formatted for meal prep
    if (!recipe.tips) {
      recipe.tips = {};
    }
    if (!recipe.tips.storage || recipe.tips.storage.length < 50) {
      recipe.tips.storage = 'MEAL PREP STORAGE: Divide into 7 individual airtight glass containers. Store in the coldest part of your refrigerator (usually the back). Will keep fresh for up to 7 days. For best quality, consider freezing portions for days 5-7.';
    }
    if (!recipe.tips.reheating || recipe.tips.reheating.length < 50) {
      recipe.tips.reheating = 'MEAL PREP REHEATING: Remove lid or transfer to microwave-safe dish. Add a splash of water if needed to prevent drying. Microwave for 2-3 minutes, stirring halfway through. Can also reheat in oven at 350°F for 15 minutes covered with foil.';
    }
    if (!recipe.tips.mealPrepTips || !Array.isArray(recipe.tips.mealPrepTips)) {
      recipe.tips.mealPrepTips = [
        'Cook all portions on Sunday for the entire week',
        'Use glass containers for better reheating and no plastic taste',
        'Keep sauces and dressings in separate small containers',
        'Add fresh herbs or garnishes after reheating for better flavor',
        'Label containers with the day to track freshness',
        'Consider par-cooking vegetables to maintain texture throughout the week'
      ];
    }
  }

    return recipe;
  } catch (error) {
    console.error('Error in getDetailedRecipe:', error);
    throw new Error(`Failed to load recipe: ${error.message}`);
  }
};

export const generateQuickMeal = async (pantryItems, profile) => {
  // Return mock quick meal in dev mode
  if (DEV_MODE) {
    const mockQuickMeal = {
      meal: "Spaghetti Aglio e Olio with Garlic Bread",
      recipe: {
        ingredients: [
          "Pasta from your pantry",
          "Olive oil",
          "Garlic",
          "Red pepper flakes",
          "Parsley",
          "Bread for garlic bread"
        ],
        instructions: [
          "Boil water and cook pasta according to package directions",
          "While pasta cooks, slice garlic thinly",
          "Heat olive oil in a large pan over medium heat",
          "Add garlic and red pepper flakes, cook until fragrant",
          "Drain pasta, reserve 1 cup pasta water",
          "Add pasta to the pan with garlic oil",
          "Toss with pasta water to create a silky sauce",
          "Garnish with parsley and serve with garlic bread"
        ],
        cookingTime: 20,
        servings: 4,
        estimatedCost: 6.50
      }
    };
    return new Promise(resolve => {
      setTimeout(() => resolve(mockQuickMeal), 1500);
    });
  }

  const prompt = `Using ONLY these pantry items: ${pantryItems.map(i => i.name).join(', ')}
    
    Create a meal for ${profile.adults} adults and ${profile.kids} kids.
    Diet: ${profile.dietType}
    Cooking tools: ${profile.cookingTools.join(', ')}
    
    Return ONLY valid JSON:
    {
      "meal": "Meal Name",
      "recipe": {
        "ingredients": ["ingredient 1", "ingredient 2"],
        "instructions": ["Step 1", "Step 2"],
        "cookingTime": 20,
        "servings": 4,
        "estimatedCost": 6.50
      }
    }`;

  const response = await callGPT([
    { role: 'system', content: 'You are a creative chef who makes delicious meals from available ingredients.' },
    { role: 'user', content: prompt }
  ]);

  return JSON.parse(response);
};

// Barcode lookup - try multiple databases
export const lookupBarcode = async (barcode) => {
  console.log('Looking up barcode:', barcode);
  
  try {
    // Try Open Food Facts first
    console.log('Trying Open Food Facts...');
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const product = data.product;
      console.log('Found in Open Food Facts:', product.product_name);
      return {
        name: product.product_name || product.product_name_en || 'Unknown Product',
        brand: product.brands || '',
        quantity: '1 item',
        category: product.categories?.split(',')[0] || 'General',
        upc: barcode,
        confidence: 10,
      };
    }
    
    // Try UPC Database (free tier, no key needed)
    console.log('Trying UPC ItemDB...');
    const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
    const upcData = await upcResponse.json();
    
    if (upcData.items && upcData.items.length > 0) {
      const item = upcData.items[0];
      console.log('Found in UPC ItemDB:', item.title);
      return {
        name: item.title || item.description || 'Unknown Product',
        brand: item.brand || '',
        quantity: '1 item',
        category: item.category || 'General',
        upc: barcode,
        confidence: 10,
      };
    }
    
    // If not found anywhere, return with barcode visible
    console.log('Product not found in any database');
    return {
      name: `Product (Barcode: ${barcode})`,
      brand: 'Not in database',
      quantity: '1 item',
      category: 'General',
      upc: barcode,
      confidence: 10,
    };
    
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return {
      name: `Product (Barcode: ${barcode})`,
      brand: 'Lookup failed',
      quantity: '1 item',
      category: 'General',
      upc: barcode,
      confidence: 10,
    };
  }
};

export const processImages = async (images) => {
  // Return mock pantry items in dev mode
  if (DEV_MODE) {
    const mockItems = [
      { id: "1", name: "Milk", category: "Dairy", quantity: "1 gallon" },
      { id: "2", name: "Eggs", category: "Dairy", quantity: "1 dozen" },
      { id: "3", name: "Bread", category: "Grains", quantity: "1 loaf" },
      { id: "4", name: "Chicken Breast", category: "Meat", quantity: "2 lbs" },
      { id: "5", name: "Apples", category: "Produce", quantity: "6 count" },
      { id: "6", name: "Pasta", category: "Grains", quantity: "2 boxes" },
      { id: "7", name: "Tomato Sauce", category: "Canned", quantity: "3 cans" }
    ];
    return new Promise(resolve => {
      setTimeout(() => resolve(mockItems), 3000);
    });
  }
  
  try {
    console.log('Processing', images.length, 'images with GPT Vision...');
    
    // Process each image (similar to mobile app but batched)
    const allItems = [];
    
    for (const img of images) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for complex images

      const imageUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;

      // Call our backend proxy instead of OpenAI directly (avoids CORS)
      const response = await fetch(`${API_BASE_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that identifies pantry items from images. Always respond with a valid JSON array only, no other text.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Identify ALL food items, ingredients, and pantry products visible in this image. Return ONLY a JSON array with each item as an object containing: name (string), brand (string or empty), quantity (string like "1 can" or "2 lbs"), and category (Produce/Meat/Dairy/Grains/Canned/Frozen/Condiments/Snacks/Other). Example: [{"name":"Tomato Sauce","brand":"Hunts","quantity":"1 can","category":"Canned"}]`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
        })
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();
      
      console.log('Full API Response:', JSON.stringify(data).substring(0, 500)); // Log first 500 chars
      
      if (data.error) {
        console.error('API Error:', data.error);
        throw new Error(data.error.message);
      }

      // Parse the GPT response
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected API response structure:', JSON.stringify(data));
        continue; // Skip this image
      }
      
      const content = data.choices[0].message.content;
      console.log('GPT Raw Response:', content);
      
      // Try direct JSON parse first
      try {
        const items = JSON.parse(content);
        if (Array.isArray(items)) {
          console.log('Successfully parsed direct JSON array');
          allItems.push(...items);
          continue;
        }
      } catch (e) {
        // Not direct JSON, continue with other methods
      }
      
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      
      if (jsonMatch) {
        try {
          const items = JSON.parse(jsonMatch[0]);
          console.log('Successfully parsed JSON from text, found items:', items.length);
          allItems.push(...items);
          continue;
        } catch (parseError) {
          console.error('JSON Parse Error:', parseError);
          console.log('Attempted to parse:', jsonMatch[0].substring(0, 200));
        }
      }
      
      // Try to extract items from markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          const items = JSON.parse(codeBlockMatch[1]);
          console.log('Successfully parsed JSON from code block');
          allItems.push(...items);
          continue;
        } catch (e) {
          console.error('Failed to parse code block:', e);
        }
      }
      
      console.log('Could not parse response as JSON for this image');
      // If we couldn't parse JSON but got a response, add a placeholder
      if (content && content.length > 0) {
        console.log('Adding placeholder item since we got a response but couldn\'t parse it');
        allItems.push({
          name: 'Items detected but parsing failed',
          category: 'Other',
          quantity: 'Check console for details',
          brand: '',
          confidence: 0,
          rawResponse: content.substring(0, 200) // Store first 200 chars for debugging
        });
      }
    }
    
    // If no items were found at all after processing all images
    if (allItems.length === 0) {
      console.log('No items found in any images.');
      return {
        success: false,
        items: []
      };
    }
    
    // Add unique IDs to all items
    const itemsWithIds = allItems.map((item, index) => ({
      id: `${Date.now()}-${index}`,
      name: item.name || 'Unknown Item',
      category: item.category || 'Other',
      quantity: item.quantity || '1 item',
      brand: item.brand || '',
      confidence: item.confidence || 0,
      expiryDate: item.expiryDate || item.expiry_date || '',
      addedDate: new Date().toISOString()
    }));
    
    console.log('Total items identified:', itemsWithIds.length);
    
    // Return in the format expected by Pantry component
    return {
      success: true,
      items: itemsWithIds
    };
    
  } catch (error) {
    console.error('Error processing images:', error);
    throw error;
  }
};