import { API_KEYS, API_ENDPOINTS } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DebugLogger } from './DebugScreen';

class APIService {
  // OpenAI GPT Vision for pantry scanning
  async analyzeImage(base64Image) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for complex images
      
      const response = await fetch(API_ENDPOINTS.OPENAI_VISION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `List all pantry items visible in this image as a JSON array. For each item include: name, brand, quantity, category, confidence (0-10), and expiry date if visible.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1500,
        }),
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
        return { items: [] };
      }
      
      const content = data.choices[0].message.content;
      console.log('GPT Raw Response:', content);
      
      // Try direct JSON parse first
      try {
        const items = JSON.parse(content);
        if (Array.isArray(items)) {
          console.log('Successfully parsed direct JSON array');
          return { items };
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
          return { items };
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
          return { items };
        } catch (e) {
          console.error('Failed to parse code block:', e);
        }
      }
      
      console.log('Could not parse response as JSON, returning empty array');
      return { items: [] };
    } catch (error) {
      console.error('OpenAI Vision API Error:', error);
      throw error;
    }
  }

  // Generate meal plans with GPT
  async generateMealPlan(userProfile, pantryItems, preferences) {
    DebugLogger.log('API: GPT-4 Turbo call starting');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('Meal plan request timed out!');
        controller.abort();
      }, 120000); // 2 minute timeout
      
      const pantryList = pantryItems.map(item => `${item.name} (${item.quantity})`).join(', ');
      
      // Build a detailed prompt based on user preferences
      let mealPrepInstructions = '';
      let expectedFormat = '';
      const includeSnacks = userProfile.snackTypes?.length > 0;
      const snackStructure = includeSnacks ? ', "snacks": ["snack1", "snack2"]' : '';
      
      if (userProfile.prepStyle === 'Weekly Meal Prep') {
        mealPrepInstructions = `WEEKLY MEAL PREP REQUIRED:
- User will cook ONCE per week in bulk
- Create ONLY 3 recipes total for the entire week${includeSnacks ? ' plus snacks' : ''}
- The SAME breakfast must appear all 7 days
- The SAME lunch must appear all 7 days  
- The SAME dinner must appear all 7 days
${includeSnacks ? '- The SAME snacks must appear all 7 days' : ''}
- Choose meals that store and reheat well`;
        
        expectedFormat = `You MUST return this exact structure with the SAME meals repeated:
{
  "days": [
    {"day": "Monday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}},
    {"day": "Tuesday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}},
    {"day": "Wednesday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}},
    {"day": "Thursday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}},
    {"day": "Friday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}},
    {"day": "Saturday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}},
    {"day": "Sunday", "meals": {"breakfast": "[same breakfast]", "lunch": "[same lunch]", "dinner": "[same dinner]"${includeSnacks ? ', "snacks": ["[same snacks]"]' : ''}}}
  ]
}
Replace [same breakfast], [same lunch], [same dinner]${includeSnacks ? ', and [same snacks]' : ''} with actual meal names that are identical across all days.`;
      } else if (userProfile.prepStyle === 'Cook Once Daily') {
        mealPrepInstructions = 'User cooks ONCE DAILY. Plan meals where lunch uses dinner leftovers from the previous day.';
        expectedFormat = `Return JSON with different meals each day, but lunch should use previous dinner leftovers.${includeSnacks ? ' Include snacks array for each day.' : ''}`;
      } else {
        mealPrepInstructions = 'User cooks every meal fresh.';
        expectedFormat = `Return JSON with variety - different meals each day.${includeSnacks ? ' Include snacks array for each day.' : ''}`;
      }
      
      const dietInfo = userProfile.dietType === 'Other' ? userProfile.customDiet : userProfile.dietType;
      let dietDescription = dietInfo && dietInfo !== 'None' ? `STRICT DIET: ${dietInfo} - All meals MUST comply with ${dietInfo} diet rules.` : '';
      
      // Add budget-specific diet guidance
      if (dietInfo === 'Carnivore' && parseFloat(userProfile.weeklyBudget) <= 150) {
        dietDescription += `
BUDGET CARNIVORE GUIDELINES for $${userProfile.weeklyBudget}/week:
- Mix affordable and moderate proteins:
  * Eggs (daily staple) - $3-4/dozen
  * Ground beef - $4-5/lb
  * Chicken thighs - $2-3/lb
  * Pork chops - $3-4/lb
  * Chuck roast or stew meat - $4-5/lb (cheaper beef cuts)
- Can include 1-2 moderate treats per week:
  * Bacon - $5-6/lb
  * Cheaper steaks (sirloin, flat iron) - $8-10/lb
- Optional: organ meats for nutrition (liver, heart) - $2-3/lb
- Target: Use THE FULL $${userProfile.weeklyBudget} budget for maximum variety
- With $${userProfile.weeklyBudget}/week you CAN afford some nicer cuts mixed in`;
      }
      
      const availableTools = userProfile.cookingTools?.join(', ') || 'Basic stove and oven';
      
      const prompt = `Create a detailed 7-day meal plan for ${userProfile.adults} adults and ${userProfile.kids} kids with STRICT BUDGET of $${userProfile.weeklyBudget} weekly.

CRITICAL BUDGET REQUIREMENT:
You MUST use the FULL $${userProfile.weeklyBudget} budget - not significantly under or over.
TARGET: $${(parseFloat(userProfile.weeklyBudget) * 0.95).toFixed(0)}-$${userProfile.weeklyBudget} total cost
Being $20+ under budget is JUST AS BAD as being over budget.
Use the budget to provide maximum variety and quality within constraints.

For a $${userProfile.weeklyBudget} weekly budget for ${userProfile.adults} adults and ${userProfile.kids} kids:
${parseFloat(userProfile.weeklyBudget) <= 100 ? `
ULTRA BUDGET MEALS ONLY:
- Breakfast: Eggs, oatmeal, toast - max $2/day total
- Lunch: PB&J, grilled cheese, leftovers - max $3/day total  
- Dinner: Pasta, rice & beans, ground beef - max $5/day total
- NO steaks, NO seafood, NO expensive meats` : 
parseFloat(userProfile.weeklyBudget) <= 150 ? `
USE YOUR FULL $${userProfile.weeklyBudget} BUDGET:
- Breakfast: Eggs, bacon, sausage - $4-5/day total
- Lunch: Good quality meats, variety - $6-7/day total
- Dinner: Mix of ground beef, chicken, pork, AND occasional steak - $10-12/day total
- Include 2-3 nicer meals per week (sirloin steak, thick pork chops)
- Add variety: different cuts of beef, pork shoulder, whole chicken
- Use the budget for quality, not just quantity` :
`MODERATE BUDGET:
- Can include occasional steak or seafood
- Balance with affordable meals`}

IMPORTANT: You MUST use 95-100% of the $${userProfile.weeklyBudget} budget
Target: $${(parseFloat(userProfile.weeklyBudget) * 0.95).toFixed(0)}-$${userProfile.weeklyBudget} TOTAL
Daily target: $${(parseFloat(userProfile.weeklyBudget)/7).toFixed(2)}/day - USE IT ALL
Don't leave money on the table - maximize meal quality and variety

${mealPrepInstructions}

${dietDescription}
IMPORTANT REQUIREMENTS:
- STAY WITHIN $${userProfile.weeklyBudget} BUDGET - this is your #1 priority
- Only suggest meals that can be made with these cooking tools: ${availableTools}
- DO NOT suggest any meals requiring: ${['Slow Cooker', 'Instant Pot', 'Air Fryer', 'Grill', 'Smoker'].filter(tool => !userProfile.cookingTools?.includes(tool)).join(', ')}
- All meals must be achievable with ${userProfile.skillLevel} cooking skills
- Meal difficulty should match: ${userProfile.mealDifficulty}

Current pantry items available: ${pantryList || 'None specified'}
Cuisine preferences: ${userProfile.cuisineTypes?.join(', ') || 'Any'}
Dietary restrictions that MUST be followed: ${userProfile.dietaryRestrictions || 'None'}
Nutritional goals: ${userProfile.foodGoals?.join(', ') || 'Balanced nutrition'}
Meals to plan: ${userProfile.mealTypes?.join(', ') || 'Breakfast, Lunch, and Dinner'}
Snacks to include: ${userProfile.snackTypes?.length > 0 ? userProfile.snackTypes.join(', ') : 'NO SNACKS'}

${userProfile.snackTypes?.length > 0 ? `IMPORTANT: Include ${userProfile.snackTypes.join(', ')} as STORE-BOUGHT snacks for each day!
Suggest specific store-bought snack products like:
- Morning Snack: granola bars, protein bars, breakfast cookies
- Afternoon Snack: crackers, nuts, trail mix, fruit cups
- Evening Snack: popcorn, pretzels, cheese sticks
- Healthy Snacks: yogurt cups, fresh fruit, veggie sticks with hummus
- Treats: cookies, chips, candy, ice cream bars
These snacks should be ready-to-eat items that go on the shopping list, NOT recipes to make!` : 'Do not include any snacks.'}

Remember: Total weekly grocery cost MUST be under $${userProfile.weeklyBudget}!

${expectedFormat}`;

      DebugLogger.log('Sending request to GPT-4 Turbo', {
          adults: userProfile.adults,
          kids: userProfile.kids,
          budget: userProfile.weeklyBudget
        });
      DebugLogger.log('API Endpoint', API_ENDPOINTS.OPENAI_CHAT);

      const response = await fetch(API_ENDPOINTS.OPENAI_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `You are a helpful meal planning assistant that creates budget-optimized meal plans. 
CRITICAL RULES:
1. You MUST use 95-100% of the budget - being significantly under is WRONG
2. Return ONLY valid JSON in the exact format specified
3. For $150 budget: Include variety - mix of ground beef, chicken, pork, AND 2-3 steak meals
4. For $100 budget: Focus on affordable proteins but still use the full budget
5. Maximize quality and variety within budget constraints
6. Always use the "days" array format with "day" and "meals" properties
7. IMPORTANT: If user selected snacks, you MUST include a "snacks" array in each day's meals
8. Snacks should be STORE-BOUGHT items (not recipes) matching the types requested
9. Include specific product names like "Nature Valley Granola Bars" or "Oreo Cookies"
10. These snacks will be added to the shopping list automatically
For Weekly Meal Prep: Return the SAME breakfast, lunch, dinner, and snacks for all 7 days.
For Cook Once Daily: Each day should have different meals, with lunch potentially using leftovers.
For Cook Every Meal: Each meal should be unique and varied.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4096,
        }),
      });

      clearTimeout(timeoutId);
      
      DebugLogger.log('Got response, status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        DebugLogger.log('API ERROR', errorText.substring(0, 200));
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      DebugLogger.log('Response received', {
        hasChoices: !!data.choices,
        choicesLength: data.choices ? data.choices.length : 0
      });
      
      if (data.error) {
        DebugLogger.log('API returned error', data.error);
        throw new Error(data.error.message);
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        DebugLogger.log('Invalid response structure');
        throw new Error('Invalid API response structure');
      }

      const content = data.choices[0].message.content;
      DebugLogger.log('GPT content length:', content ? content.length : 0);
      if (content) DebugLogger.log('GPT content preview', content.substring(0, 200));
      
      // Parse the meal plan response - it should be a simple structure now
      let mealPlan;
      
      // Try direct JSON parse first
      try {
        mealPlan = JSON.parse(content);
        console.log('Successfully parsed meal plan as direct JSON:', mealPlan);
      } catch (e) {
        console.log('Not direct JSON, trying to extract...', e);
        
        // Try to find JSON array or object in the response
        const jsonArrayMatch = content.match(/\[[\s\S]*\]/);
        const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonArrayMatch) {
          try {
            const days = JSON.parse(jsonArrayMatch[0]);
            mealPlan = { days };
            console.log('Successfully extracted array and created meal plan:', mealPlan);
          } catch (parseError) {
            console.error('Failed to parse extracted array:', parseError);
          }
        } else if (jsonObjectMatch) {
          try {
            mealPlan = JSON.parse(jsonObjectMatch[0]);
            console.log('Successfully extracted and parsed meal plan object:', mealPlan);
          } catch (parseError) {
            console.error('Failed to parse extracted object:', parseError);
          }
        }
        
        // Try code block extraction
        if (!mealPlan) {
          const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            try {
              mealPlan = JSON.parse(codeBlockMatch[1]);
              console.log('Successfully parsed meal plan from code block:', mealPlan);
            } catch (e) {
              console.error('Failed to parse code block:', e);
            }
          }
        }
      }
      
      if (!mealPlan) {
        console.error('Could not parse meal plan. Full response:', content);
        throw new Error('Could not parse meal plan');
      }
      
      // Ensure proper structure - if it's just an array, wrap it
      if (Array.isArray(mealPlan)) {
        mealPlan = { days: mealPlan };
      }
      
      // Ensure each day has the expected structure
      if (mealPlan.days) {
        mealPlan.days = mealPlan.days.map((day, index) => {
          if (typeof day === 'object' && day.meals) {
            return day; // Already properly structured
          }
          // If day is a simple object with breakfast/lunch/dinner properties
          return {
            day: day.day || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index],
            meals: {
              breakfast: day.breakfast || '',
              lunch: day.lunch || '',
              dinner: day.dinner || ''
            }
          };
        });
      }
      
      // Ensure we have the correct format (days array)
      if (!mealPlan.days) {
        // Convert from meal_plan format if needed
        if (mealPlan.meal_plan) {
          const daysArray = [];
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          
          for (let i = 1; i <= 7; i++) {
            const dayKey = `day_${i}`;
            if (mealPlan.meal_plan[dayKey]) {
              daysArray.push({
                day: dayNames[i - 1],
                meals: mealPlan.meal_plan[dayKey]
              });
            }
          }
          
          mealPlan.days = daysArray;
          delete mealPlan.meal_plan; // Remove the old format
        }
      }
      
      // Validate meal prep style compliance
      if (userProfile.prepStyle === 'Weekly Meal Prep' && mealPlan.days && mealPlan.days.length > 0) {
        // For meal prep, ensure all days have the same meals
        const firstDay = mealPlan.days[0];
        const sameMeals = {
          breakfast: firstDay.meals.breakfast,
          lunch: firstDay.meals.lunch,
          dinner: firstDay.meals.dinner
        };
        
        // Apply the same meals to all days
        mealPlan.days = mealPlan.days.map(day => ({
          day: day.day,
          meals: { ...sameMeals }
        }));
        
        console.log('Enforced meal prep consistency - same meals all week');
      }
      
      console.log('Final parsed meal plan structure:', JSON.stringify(mealPlan).substring(0, 500));
      return mealPlan;
    } catch (error) {
      console.error('Meal Plan Generation Error:', error);
      throw error;
    }
  }

  // UPC Barcode lookup
  async lookupBarcode(barcode) {
    try {
      const response = await fetch(`${API_ENDPOINTS.UPC_LOOKUP}?upc=${barcode}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const product = data.items[0];
        return {
          name: product.title || 'Unknown Product',
          brand: product.brand || 'Generic',
          quantity: '1 item',
          category: product.category || 'General',
          upc: barcode,
          confidence: 10, // Barcode scans are always accurate
        };
      } else {
        // Fallback to basic info if UPC not found
        return {
          name: 'Scanned Product',
          brand: 'Unknown',
          quantity: '1 item',
          category: 'General',
          upc: barcode,
          confidence: 10,
        };
      }
    } catch (error) {
      console.error('UPC Lookup Error:', error);
      // Return basic info even if API fails
      return {
        name: 'Scanned Product',
        brand: 'Unknown',
        quantity: '1 item',
        category: 'General',
        upc: barcode,
        confidence: 10,
      };
    }
  }

  // Generate a replacement meal
  async generateReplacementMeal(userProfile, mealType, dayName, existingMeal) {
    console.log('generateReplacementMeal called with:', { mealType, dayName, existingMeal });
    
    DebugLogger.log('API: Starting replacement', { mealType, day: dayName });
    
    try {
      // Check required parameters
      if (!userProfile) {
        throw new Error('No user profile provided');
      }
      
      // Check if API key exists
      if (!API_KEYS.OPENAI_API_KEY || API_KEYS.OPENAI_API_KEY.length < 10) {
        throw new Error('Invalid or missing OpenAI API key');
      }
      
      DebugLogger.log('API: Building prompt');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let mealPrepContext = '';
      if (userProfile.prepStyle === 'Weekly Meal Prep') {
        mealPrepContext = 'This is for weekly meal prep, so suggest something that can be made in bulk.';
      }
      
      const dietInfo = userProfile.dietType === 'Other' ? userProfile.customDiet : userProfile.dietType;
      const dietRequirement = dietInfo && dietInfo !== 'None' ? `Must be ${dietInfo} diet compliant. ` : '';
      
      const availableTools = userProfile.cookingTools?.join(', ') || 'Basic stove and oven';
      const prohibitedTools = ['Slow Cooker', 'Instant Pot', 'Air Fryer', 'Grill', 'Smoker']
        .filter(tool => !userProfile.cookingTools?.includes(tool));
      
      const prompt = `Generate a replacement ${mealType} meal for ${userProfile.adults} adults and ${userProfile.kids} kids.

Current meal: ${existingMeal}
Budget: $${userProfile.weeklyBudget}/week
Available cooking tools: ${availableTools}
DO NOT suggest meals requiring: ${prohibitedTools.join(', ')}
${dietRequirement}${mealPrepContext}

Give me just the meal name, nothing else.`;

      DebugLogger.log('API: Sending request');
      console.log('Prompt being sent:', prompt);
      
      const requestBody = {
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a meal planning assistant. Respond with only meal names, no explanations.'
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ]
      };
      
      DebugLogger.log('API Request body:', JSON.stringify(requestBody));
      
      const response = await fetch(API_ENDPOINTS.OPENAI_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      clearTimeout(timeoutId);
      
      DebugLogger.log('API: Got response', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        DebugLogger.log('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500)
        });
        console.error('Replacement meal API error:', errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      console.log('Full API response:', JSON.stringify(data));
      DebugLogger.log('API: Full response', JSON.stringify(data));
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid response structure. Data:', data);
        throw new Error('Invalid API response structure');
      }

      const content = data.choices[0].message.content;
      console.log('Message content:', content);
      console.log('Content type:', typeof content);
      
      if (!content) {
        console.error('No content in message. Full message:', data.choices[0].message);
        throw new Error('No content in API response');
      }
      
      const mealName = content.trim();
      
      if (!mealName || mealName === '') {
        console.error('Empty meal name after trim. Original content:', content);
        throw new Error('Empty meal name received from API');
      }
      
      DebugLogger.log('API: New meal generated', mealName);
      console.log('Returning meal name:', mealName);
      
      return mealName;
    } catch (error) {
      console.error('Error in generateReplacementMeal:', error);
      console.error('Error stack:', error.stack);
      DebugLogger.log('API ERROR:', error.toString());
      throw error;
    }
  }

  // Load all recipes for a meal plan in background
  async loadAllRecipes(mealPlan, servings, budget) {
    try {
      // Get unique meals from the plan
      const uniqueMeals = new Set();
      
      // Handle both formats - days array or meal_plan object
      if (mealPlan.days) {
        mealPlan.days.forEach(day => {
          if (day.meals) {
            if (day.meals.breakfast) uniqueMeals.add(day.meals.breakfast);
            if (day.meals.lunch) uniqueMeals.add(day.meals.lunch);
            if (day.meals.dinner) uniqueMeals.add(day.meals.dinner);
          }
        });
      } else if (mealPlan.meal_plan) {
        // Handle day_1, day_2, etc. format
        for (let i = 1; i <= 7; i++) {
          const dayKey = `day_${i}`;
          const dayMeals = mealPlan.meal_plan[dayKey];
          if (dayMeals) {
            if (dayMeals.breakfast) uniqueMeals.add(dayMeals.breakfast);
            if (dayMeals.lunch) uniqueMeals.add(dayMeals.lunch);
            if (dayMeals.dinner) uniqueMeals.add(dayMeals.dinner);
          }
        }
      } else {
        console.log('Unable to find meals in plan structure');
        return {};
      }
      
      console.log('Loading recipes for', uniqueMeals.size, 'unique meals');
      
      // Load existing recipes from storage to avoid re-fetching
      const existingRecipesData = await AsyncStorage.getItem('@weekly_dish_recipes');
      const existingRecipes = existingRecipesData ? JSON.parse(existingRecipesData) : {};
      
      const recipesToLoad = Array.from(uniqueMeals).filter(meal => !existingRecipes[meal]);
      
      if (recipesToLoad.length === 0) {
        console.log('All recipes already cached');
        return existingRecipes;
      }
      
      console.log('Need to load', recipesToLoad.length, 'new recipes');
      
      // Load recipes in batches of 3 to avoid overwhelming the API
      const batchSize = 3;
      const allRecipes = { ...existingRecipes };
      
      for (let i = 0; i < recipesToLoad.length; i += batchSize) {
        const batch = recipesToLoad.slice(i, i + batchSize);
        const batchPromises = batch.map(meal => 
          this.getRecipeDetails(meal, servings, budget)
            .then(recipe => ({ meal, recipe }))
            .catch(error => {
              console.error(`Failed to load recipe for ${meal}:`, error);
              return null;
            })
        );
        
        const results = await Promise.all(batchPromises);
        
        results.forEach(result => {
          if (result && result.recipe) {
            allRecipes[result.meal] = result.recipe;
          }
        });
        
        // Save progress after each batch
        await AsyncStorage.setItem('@weekly_dish_recipes', JSON.stringify(allRecipes));
        console.log(`Loaded batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(recipesToLoad.length/batchSize)}`);
      }
      
      console.log('All recipes loaded and cached');
      return allRecipes;
    } catch (error) {
      console.error('Error loading all recipes:', error);
      return {};
    }
  }

  // Get detailed recipe with instructions and video suggestions
  async getRecipeDetails(recipeName, servings, budget, isMealPrep = false) {
    const mealName = recipeName; // Store for use in fallback instructions
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      // Check if we have profile data to determine meal prep
      const profileData = await AsyncStorage.getItem('@weekly_dish_user_profile');
      const profile = profileData ? JSON.parse(profileData) : null;
      const isWeeklyMealPrep = isMealPrep || (profile && profile.prepStyle === 'Weekly Meal Prep');
      
      const mealPrepInstructions = isWeeklyMealPrep ? `
CRITICAL: This is for WEEKLY MEAL PREP - the recipe MUST:
1. Make exactly ${servings} servings (for 7 days worth)
2. Include BATCH COOKING instructions for preparing all 7 days at once
3. Provide detailed STORAGE instructions for keeping in fridge for 7 days
4. Include REHEATING instructions for each day
5. Use ingredients that stay fresh for a full week when refrigerated
6. Scale all ingredient quantities appropriately (${servings} total servings)
7. Include tips for maintaining food quality over the week
8. Specify to use glass containers (recommended for meal prep)
9. Note any ingredients to add fresh daily (like dressings or herbs)
10. Provide day-by-day freshness guidance
` : '';
      
      const prompt = `Provide a complete, detailed recipe for "${recipeName}" for ${servings} servings.

${mealPrepInstructions}

Include EVERYTHING needed:
1. Complete ingredient list with exact measurements and preparation notes
2. Detailed step-by-step instructions with techniques and tips
3. Prep time, cook time, and total time
4. Cost breakdown per ingredient and total cost
5. Full nutritional information per serving
6. Pro tips for best results
7. Storage and reheating instructions ${isWeeklyMealPrep ? '(MUST include 7-day meal prep storage)' : ''}
8. Possible substitutions for expensive or hard-to-find ingredients
9. Equipment needed
10. Difficulty level and skill requirements
11. YouTube video suggestions: Provide 3-5 YouTube search terms that would find helpful video tutorials for this recipe (e.g. "how to make scrambled eggs Gordon Ramsay", "perfect ribeye steak cast iron", etc.)

Return as comprehensive JSON with all cooking details, techniques, and information needed to successfully make this dish.`;

      console.log('Getting recipe details for:', recipeName, 'Meal Prep Mode:', isWeeklyMealPrep);

      const response = await fetch(API_ENDPOINTS.OPENAI_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: isWeeklyMealPrep ? 
                'You are a professional chef specializing in meal prep. You create recipes that can be batch cooked and stored for an entire week while maintaining quality and freshness. Always scale ALL ingredients properly for the total servings needed. Return only valid JSON with no explanations.' :
                'You are a recipe assistant. Return only valid JSON with no explanations.'
            },
            { role: 'user', content: prompt }
          ]
        }),
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API response');
      }

      let content = data.choices[0].message.content;
      console.log('Recipe response:', content);
      
      // Strip markdown code blocks if present
      if (content.includes('```')) {
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          content = codeBlockMatch[1];
          console.log('Extracted from markdown block');
        }
      }
      
      try {
        let parsedData = JSON.parse(content);
        
        console.log('Raw parsed recipe data keys:', Object.keys(parsedData));
        
        // Handle nested recipe structure
        let recipe = parsedData.recipe || parsedData;
        
        console.log('Recipe object keys:', Object.keys(recipe));
        
        // Try to find instructions in various places
        let instructions = null;
        
        // Check common instruction field names
        const instructionFields = [
          'instructions', 'steps', 'directions', 'method', 'procedure',
          'cooking_instructions', 'preparation', 'how_to_make', 'recipe_steps'
        ];
        
        for (const field of instructionFields) {
          if (recipe[field]) {
            console.log(`Found instructions in field: ${field}`);
            instructions = recipe[field];
            break;
          }
        }
        
        // Check if instructions are nested deeper
        if (!instructions) {
          for (const key of Object.keys(recipe)) {
            if (typeof recipe[key] === 'object' && recipe[key]) {
              for (const field of instructionFields) {
                if (recipe[key][field]) {
                  console.log(`Found instructions nested in ${key}.${field}`);
                  instructions = recipe[key][field];
                  break;
                }
              }
              if (instructions) break;
            }
          }
        }
        
        // Process instructions into consistent format
        if (instructions) {
          if (Array.isArray(instructions)) {
            recipe.instructions = instructions.map((item, index) => {
              if (typeof item === 'string') return item;
              // Try various object properties
              const text = item.details || item.instruction || item.text || 
                          item.step || item.description || item.content ||
                          item.action || item.procedure || '';
              return text || `Step ${index + 1}`;
            });
          } else if (typeof instructions === 'string') {
            // Split by common delimiters if it's a single string
            recipe.instructions = instructions.split(/\n|\.(?=[A-Z])/).filter(s => s.trim());
          } else if (typeof instructions === 'object') {
            // Handle object with numbered keys like {1: "step1", 2: "step2"}
            recipe.instructions = Object.values(instructions);
          }
        }
        
        // Convert ingredients format if needed
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
          // Check if ingredients are objects with ingredient/quantity/unit
          if (recipe.ingredients.length > 0 && typeof recipe.ingredients[0] === 'object' && recipe.ingredients[0].ingredient) {
            recipe.ingredients = recipe.ingredients.map(item => 
              `${item.quantity || ''} ${item.unit || ''} ${item.ingredient} ${item.preparation ? `(${item.preparation})` : ''}`.trim()
            );
          }
        }
        
        // Extract cost from cost_breakdown if present
        if (recipe.cost_breakdown && recipe.cost_breakdown.total_cost) {
          recipe.cost = recipe.cost_breakdown.total_cost;
        }
        
        // Extract nutrition from nutritional_information if present
        if (recipe.nutritional_information) {
          recipe.nutrition = recipe.nutritional_information;
        }
        
        // Extract tips from pro_tips if present
        if (recipe.pro_tips && Array.isArray(recipe.pro_tips)) {
          recipe.tips = recipe.pro_tips.join('\n');
        }
        
        // Extract storage info
        if (recipe.storage_reheating) {
          recipe.storage = recipe.storage_reheating.storage;
          recipe.reheating = recipe.storage_reheating.reheating;
        }
        
        // Extract YouTube videos
        if (recipe.youtube_video_suggestions) {
          recipe.youtubeLinks = recipe.youtube_video_suggestions;
        }
        
        // Ensure required fields exist
        if (!recipe.ingredients) recipe.ingredients = [];
        if (!recipe.instructions || recipe.instructions.length === 0) {
          // If still no instructions, create basic ones based on the meal
          console.log('Warning: No instructions found for recipe, creating basic instructions');
          const mealNameLower = mealName.toLowerCase();
          
          // Generate basic instructions based on common cooking methods
          if (mealNameLower.includes('scrambled') || mealNameLower.includes('eggs')) {
            recipe.instructions = [
              'Heat a pan over medium heat with butter or oil',
              'Crack eggs into a bowl and whisk well',
              'Pour eggs into the heated pan',
              'Stir gently until eggs are cooked to desired consistency',
              'Season with salt and pepper to taste'
            ];
          } else if (mealNameLower.includes('grilled') || mealNameLower.includes('grill')) {
            recipe.instructions = [
              'Preheat grill to medium-high heat',
              'Season the meat with salt, pepper, and desired spices',
              'Place on grill and cook for appropriate time',
              'Flip halfway through cooking',
              'Check internal temperature for doneness'
            ];
          } else if (mealNameLower.includes('baked') || mealNameLower.includes('roast')) {
            recipe.instructions = [
              'Preheat oven to 375°F (190°C)',
              'Season the ingredients as desired',
              'Place in a baking dish',
              'Bake for appropriate time based on ingredients',
              'Check for doneness before serving'
            ];
          } else if (mealNameLower.includes('stir-fry') || mealNameLower.includes('fried')) {
            recipe.instructions = [
              'Heat oil in a large pan or wok over high heat',
              'Add ingredients starting with those that take longest to cook',
              'Stir frequently to prevent burning',
              'Season as desired',
              'Cook until all ingredients are properly cooked'
            ];
          } else {
            recipe.instructions = [
              `Prepare all ingredients for ${mealName}`,
              'Cook according to your preferred method',
              'Season to taste',
              'Serve hot'
            ];
          }
          
          console.log('Generated fallback instructions for:', mealName);
        }
        
        console.log('Final recipe structure:', {
          hasIngredients: recipe.ingredients.length > 0,
          hasInstructions: recipe.instructions.length > 0,
          instructionsCount: recipe.instructions.length,
          firstInstruction: recipe.instructions[0]
        });
        
        return recipe;
      } catch (parseError) {
        console.error('Failed to parse recipe:', parseError);
        console.error('Content was:', content);
        
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse extracted JSON:', e);
          }
        }
        
        // Return a basic structure
        return {
          ingredients: [
            { name: 'Unable to load recipe', amount: 'Please try again' }
          ],
          instructions: ['Recipe failed to load. Please try again.'],
          prepTime: 'Unknown',
          cookTime: 'Unknown',
          totalTime: 'Unknown',
          cost: 0,
          nutrition: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
          },
          tips: 'Please try loading the recipe again'
        };
      }
    } catch (error) {
      console.error('Recipe Details Error:', error);
      throw error;
    }
  }

  // Generate shopping list from meal plan
  async generateShoppingList(mealPlan, pantryItems, budget) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes for detailed shopping list
      
      const pantryList = pantryItems.map(item => `${item.name} (${item.quantity})`).join(', ');
      
      // Extract meals
      const meals = mealPlan.days.flatMap(day => {
        const dayMeals = [];
        if (day.meals.breakfast) dayMeals.push(day.meals.breakfast);
        if (day.meals.lunch) dayMeals.push(day.meals.lunch);
        if (day.meals.dinner) dayMeals.push(day.meals.dinner);
        return dayMeals;
      }).join(', ');
      
      // Extract snacks
      const snacks = mealPlan.days.flatMap(day => 
        day.meals.snacks || []
      );
      const uniqueSnacks = [...new Set(snacks)];
      const snacksList = uniqueSnacks.length > 0 ? `\n\nStore-bought snacks to purchase: ${uniqueSnacks.join(', ')}` : '';
      
      const prompt = `Create a detailed shopping list for a week of meals for the following recipes: ${meals}${snacksList}

Current pantry items already available: ${pantryList}
STRICT Weekly budget: $${budget} - THE TOTAL MUST BE UNDER THIS AMOUNT

Generate a comprehensive shopping list with:
1. Items grouped by store section (Produce, Meat, Dairy, Frozen, Pantry/Dry Goods, Snacks, etc.)
2. Include all specified snacks in a "Snacks" category with quantities for the week
3. EXACT quantities with SPECIFIC UNITS - Examples:
   - "3 lbs ground beef" NOT "3 ground beef"
   - "2 heads broccoli" NOT "2 broccoli"
   - "1 dozen eggs" NOT "12 eggs"
   - "8 oz shredded cheese" NOT "1 cheese"
   - "1 lb bacon" NOT "1 bacon"
   - "4 chicken breasts (about 2 lbs)" NOT "4 chicken"
   - "1 box Nature Valley Granola Bars" NOT "granola bars"
   - "2 bags Doritos chips" NOT "chips"
4. REALISTIC ESTIMATED PRICES per item in USD (must be actual numbers, not 0):
   - Ground beef: ~$4-6 per lb
   - Chicken breast: ~$3-4 per lb
   - Eggs: ~$3-5 per dozen
   - Milk: ~$3-4 per gallon
   - Vegetables: ~$1-3 per lb
   - Snack items: ~$3-6 per box/bag
   Base prices on typical US grocery store prices
5. Total estimated cost (sum of all items)
6. Budget analysis (under/over budget)
7. Money-saving tips if needed

CRITICAL: Every item MUST have a proper unit of measurement (lbs, oz, heads, bunches, cans, boxes, packages, dozen, etc.)
The quantity field should INCLUDE the unit (e.g., "3 lbs" not just "3")

Return the list in this EXACT JSON format with NUMERIC prices (not strings):
{
  "sections": [
    {
      "category": "Produce",
      "items": [
        {"quantity": "3 lbs", "name": "tomatoes", "price": 5.97},
        {"quantity": "2 heads", "name": "lettuce", "price": 3.98}
      ]
    },
    {
      "category": "Meat",
      "items": [
        {"quantity": "2 lbs", "name": "ground beef", "price": 9.98},
        {"quantity": "3 lbs", "name": "chicken breast", "price": 11.97}
      ]
    }
  ],
  "totalCost": 89.50,
  "underBudget": true,
  "savingTips": "Buy store brand cheese to save $3"
}
IMPORTANT: The "price" field MUST be a number (like 5.97), not a string (not "5.97") and NOT zero`;

      const response = await fetch(API_ENDPOINTS.OPENAI_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `You are a shopping list assistant. Return only valid JSON with no explanations.
CRITICAL REQUIREMENTS:
1. Every quantity MUST include units (lbs, oz, heads, dozen, cans, etc.)
2. Every price MUST be a realistic number based on US grocery prices (not 0 or null)
3. Prices should be numeric values like 5.97, not strings like "5.97"
Example: {"quantity": "3 lbs", "name": "bacon", "price": 14.97}`
            },
            { role: 'user', content: prompt }
          ]
        }),
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API response');
      }

      let content = data.choices[0].message.content;
      console.log('Shopping list response:', content);
      
      // Strip markdown code blocks if present
      if (content.includes('```')) {
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          content = codeBlockMatch[1];
          console.log('Extracted shopping list from markdown block');
        }
      }
      
      // Check for empty content
      if (!content || content.trim() === '') {
        console.error('Empty response from shopping list API');
        return {
          sections: [
            {
              category: 'Error',
              items: [
                { name: 'Unable to generate shopping list', quantity: '1', price: 0 }
              ]
            }
          ],
          totalCost: 0,
          underBudget: true,
          savingTips: 'Please try generating the list again'
        };
      }
      
      try {
        const shoppingList = JSON.parse(content);
        
        console.log('Raw shopping list from GPT:', JSON.stringify(shoppingList).substring(0, 500));
        
        // Handle different response structures from GPT
        // GPT might return shopping_list, store_sections, shoppingList, or sections
        if (!shoppingList.sections) {
          if (shoppingList.shopping_list) {
            console.log('Converting shopping_list object to sections array');
            // Convert shopping_list object to sections array
            const sections = [];
            for (const [category, items] of Object.entries(shoppingList.shopping_list)) {
              if (Array.isArray(items) && items.length > 0) {
                sections.push({
                  category: category,
                  items: items
                });
              }
            }
            shoppingList.sections = sections;
            console.log('Created sections from shopping_list:', sections.length);
          } else if (shoppingList.store_sections) {
            console.log('Converting store_sections to sections array');
            shoppingList.sections = shoppingList.store_sections;
          } else if (shoppingList.shoppingList) {
            console.log('Converting shoppingList object to sections array');
            // Convert shoppingList object to sections array
            const sections = [];
            for (const [category, items] of Object.entries(shoppingList.shoppingList)) {
              if (Array.isArray(items) && items.length > 0) {
                sections.push({
                  category: category,
                  items: items
                });
              }
            }
            shoppingList.sections = sections;
            console.log('Created sections:', sections.length);
          }
        }
        
        // Check if sections is an object instead of array (another GPT variation)
        if (shoppingList.sections && !Array.isArray(shoppingList.sections)) {
          console.log('Converting sections object to array');
          const sectionsArray = [];
          for (const [category, items] of Object.entries(shoppingList.sections)) {
            if (items) {
              sectionsArray.push({
                category: category,
                items: Array.isArray(items) ? items : [items]
              });
            }
          }
          shoppingList.sections = sectionsArray;
        }
        
        // Ensure proper structure
        if (!shoppingList.sections || !Array.isArray(shoppingList.sections)) {
          console.log('No valid sections found, creating empty array');
          shoppingList.sections = [];
        }
        
        // Log final structure
        console.log('Final sections count:', shoppingList.sections.length);
        if (shoppingList.sections.length > 0) {
          console.log('First section:', shoppingList.sections[0].category, 'items:', shoppingList.sections[0].items?.length);
        }
        
        // Calculate total if not provided (handle various field names)
        if (shoppingList.totalCost === undefined) {
          if (shoppingList.estimated_total_cost) {
            shoppingList.totalCost = shoppingList.estimated_total_cost;
          } else if (shoppingList.totals && shoppingList.totals.estimatedTotal) {
            shoppingList.totalCost = shoppingList.totals.estimatedTotal;
          } else if (shoppingList.totals && shoppingList.totals.estimatedCost) {
            shoppingList.totalCost = shoppingList.totals.estimatedCost;
          } else {
            shoppingList.totalCost = 0;
          }
        }
        
        // Determine budget status
        if (shoppingList.underBudget === undefined) {
          shoppingList.underBudget = shoppingList.totalCost <= parseFloat(budget);
        }
        
        // Get money saving tips if available
        if (shoppingList.moneySavingTips && !shoppingList.savingTips) {
          shoppingList.savingTips = Array.isArray(shoppingList.moneySavingTips) 
            ? shoppingList.moneySavingTips.join('\n') 
            : shoppingList.moneySavingTips;
        }
        
        // Handle savingTips as object (tip1, tip2, etc.)
        if (shoppingList.savingTips && typeof shoppingList.savingTips === 'object' && !Array.isArray(shoppingList.savingTips)) {
          // Leave as object - the UI will handle it
          console.log('Saving tips is an object, keeping as-is for UI to handle');
        }
        
        return shoppingList;
      } catch (parseError) {
        console.error('Failed to parse shopping list:', parseError);
        
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse extracted JSON:', e);
          }
        }
        
        // Return a default structure
        return {
          sections: [
            {
              category: 'Groceries',
              items: [
                { name: 'Unable to parse shopping list', quantity: '1', price: 0 }
              ]
            }
          ],
          totalCost: 0,
          underBudget: true,
          savingTips: 'Please try generating the list again'
        };
      }
    } catch (error) {
      console.error('Shopping List Error:', error);
      throw error;
    }
  }

  // Generate quick meal from pantry items
  async generateQuickMeal(pantryItems, userProfile) {
    try {
      const pantryList = pantryItems.map(item => item.name).join(', ');
      const servings = parseInt(userProfile?.adults || 2) + parseInt(userProfile?.kids || 0);
      
      // Build constraints based on user profile
      let dietConstraints = '';
      if (userProfile?.dietType && userProfile.dietType !== 'None') {
        if (userProfile.dietType === 'Other' && userProfile.customDiet) {
          dietConstraints = `STRICT REQUIREMENT: Must be ${userProfile.customDiet} compliant.`;
        } else {
          dietConstraints = `STRICT REQUIREMENT: Must be ${userProfile.dietType} diet compliant.`;
        }
      }
      
      const prompt = `I have these ingredients in my pantry: ${pantryList}

Create ONE quick meal I can make right now using ONLY these ingredients (no shopping required).

Requirements:
- Servings needed: ${servings} people (${userProfile?.adults || 0} adults, ${userProfile?.kids || 0} kids)
- Available cooking tools: ${userProfile?.cookingTools?.join(', ') || 'Basic kitchen tools'}
- DO NOT suggest meals requiring: ${['Slow Cooker', 'Instant Pot', 'Air Fryer', 'Smoker'].filter(tool => !userProfile?.cookingTools?.includes(tool)).join(', ')}
- Skill level: ${userProfile?.skillLevel || 'Beginner'}
- Meal difficulty preference: ${userProfile?.mealDifficulty || 'Easy (under 15 min)'}
${dietConstraints}
${userProfile?.dietaryRestrictions ? `- Allergies/Restrictions: ${userProfile.dietaryRestrictions}` : ''}
${userProfile?.cuisineTypes?.length > 0 ? `- Preferred cuisines: ${userProfile.cuisineTypes.join(', ')}` : ''}
${userProfile?.foodGoals?.length > 0 ? `- Food goals: ${userProfile.foodGoals.join(', ')}` : ''}

Return as JSON with:
{
  "meal": "Name of the dish",
  "recipe": {
    "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
    "instructions": ["Step 1", "Step 2", "Step 3"],
    "cookTime": "X minutes",
    "prepTime": "X minutes", 
    "servings": ${servings},
    "difficulty": "Easy/Medium/Hard"
  }
}

IMPORTANT: 
- Recipe MUST match the difficulty level and time constraints of "${userProfile?.mealDifficulty || 'Easy'}"
- If kids are present, make it kid-friendly
- Must use ONLY the available cooking tools listed
${dietConstraints ? '- Must strictly follow the diet requirements' : ''}
`;

      const response = await fetch(API_ENDPOINTS.OPENAI_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful cooking assistant. Return only valid JSON.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      let content = data.choices[0].message.content;
      
      // Strip markdown if present
      if (content.includes('```')) {
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          content = codeBlockMatch[1];
        }
      }
      
      const result = JSON.parse(content);
      return result;
    } catch (error) {
      console.error('Quick Meal Generation Error:', error);
      throw error;
    }
  }

  // Walmart product search
  async searchWalmartProducts(query, zipCode = '72712') {
    try {
      const params = new URLSearchParams({
        query: query,
        format: 'json',
        apiKey: API_KEYS.WALMART_API_KEY,
      });

      const response = await fetch(`${API_ENDPOINTS.WALMART_SEARCH}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.items) {
        return data.items.map(item => ({
          name: item.name,
          price: item.salePrice || item.msrp,
          image: item.thumbnailImage,
          addToCartUrl: item.addToCartUrl,
          productId: item.itemId,
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Walmart Search Error:', error);
      return [];
    }
  }

  // Get Walmart prices for shopping list
  async getWalmartPrices(items) {
    try {
      const pricesPromises = items.map(item => this.searchWalmartProducts(item.name));
      const results = await Promise.all(pricesPromises);
      
      return items.map((item, index) => {
        const walmartProducts = results[index];
        if (walmartProducts && walmartProducts.length > 0) {
          return {
            ...item,
            walmartPrice: walmartProducts[0].price,
            walmartUrl: walmartProducts[0].addToCartUrl,
            available: true,
          };
        }
        return {
          ...item,
          walmartPrice: null,
          available: false,
        };
      });
    } catch (error) {
      console.error('Walmart Price Check Error:', error);
      return items;
    }
  }
}

export default new APIService();