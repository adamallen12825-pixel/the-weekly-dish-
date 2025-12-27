import React, { useState, useEffect } from 'react';
import { generateMealPlan, replaceMeal, generateShoppingList, getDetailedRecipe, generateCustomMeal } from '../services/gptService';
import MealPlanWeek from './MealPlanWeek';
import kvService from '../services/kvService';
import './MealPlan.css';

function MealPlan({ user, profile: profileProp }) {
  const [mealPlan, setMealPlan] = useState(null);
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [replacing, setReplacing] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [mealPlanHistory, setMealPlanHistory] = useState([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [shareLink, setShareLink] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [profile, setProfile] = useState(profileProp);
  const [cookingHistory, setCookingHistory] = useState([]);

  // Helper function to save data to Blob storage
  const saveUserData = async (key, value) => {
    if (!user) return;
    try {
      if (value === null || value === undefined) {
        // Delete from storage when value is null
        await kvService.delete(user.id, key);
      } else {
        // Save to Blob storage (handles both local and cloud)
        await kvService.set(user.id, key, value);
      }
    } catch (error) {
    }
  };

  // Helper to load data from KV storage
  const loadUserData = async (key) => {
    if (!user) return null;
    try {
      return await kvService.get(user.id, key);
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
      if (!user) return;
      
      // Load profile if not provided as prop
      if (!profileProp) {
        const storedProfile = await kvService.get(user.id, 'profile');
        if (storedProfile) {
          setProfile(storedProfile);
        }
      }
      
      
      // Load all user data from KV storage
      const [
        savedFavorites,
        savedDislikes,
        history,
        savedMealPlan,
        savedShoppingList,
        savedCookingHistory
      ] = await Promise.all([
        loadUserData('recipeFavorites'),
        loadUserData('recipeDislikes'),
        loadUserData('mealPlanHistory'),
        loadUserData('currentMealPlan'),
        loadUserData('currentShoppingList'),
        loadUserData('cookingHistory')
      ]);

      setFavorites(savedFavorites || []);
      setDislikes(savedDislikes || []);
      setCookingHistory(savedCookingHistory || []);
      
      if (history) {
        setMealPlanHistory(history);
      } else {
        setMealPlanHistory([]);
      }
      
      if (savedMealPlan) {
        setMealPlan(savedMealPlan);
      }
      
      if (savedShoppingList) {
        setShoppingList(savedShoppingList);
      }
    };
    
    loadAllData();
  }, [user, profileProp]);

  const toggleFavorite = (mealName) => {
    let newFavorites = [...favorites];
    let newDislikes = [...dislikes];
    
    if (favorites.includes(mealName)) {
      // Remove from favorites
      newFavorites = newFavorites.filter(f => f !== mealName);
    } else {
      // Add to favorites and remove from dislikes if present
      newFavorites.push(mealName);
      newDislikes = newDislikes.filter(d => d !== mealName);
    }
    
    setFavorites(newFavorites);
    setDislikes(newDislikes);
    // Update preferences in localStorage
    saveUserData('recipeFavorites', newFavorites);
    saveUserData('recipeDislikes', newDislikes);
  };

  const toggleDislike = (mealName) => {
    let newDislikes = [...dislikes];
    let newFavorites = [...favorites];
    
    if (dislikes.includes(mealName)) {
      // Remove from dislikes
      newDislikes = newDislikes.filter(d => d !== mealName);
    } else {
      // Add to dislikes and remove from favorites if present
      newDislikes.push(mealName);
      newFavorites = newFavorites.filter(f => f !== mealName);
    }
    
    setDislikes(newDislikes);
    setFavorites(newFavorites);
    // Update preferences in localStorage
    saveUserData('recipeDislikes', newDislikes);
    saveUserData('recipeFavorites', newFavorites);
  };

  const handleCookedMeal = async (meal) => {
    if (!window.confirm(`Mark "${meal.name}" as cooked? This will remove ingredients from your pantry.`)) {
      return;
    }

    try {
      // Get current pantry items
      let pantryItems = await loadUserData('pantry') || [];
      let removedCount = 0;

      console.log('Starting pantry removal for meal:', meal.name);
      console.log('Current pantry items:', pantryItems.length);

      // Try to get the recipe details to know what ingredients to remove
      try {
        // First check if recipe is cached
        const recipesCache = await loadUserData('recipesCache') || {};
        let recipe = recipesCache[meal.name];

        // If not cached, fetch it
        if (!recipe) {
          console.log('Recipe not cached, fetching...');
          recipe = await getDetailedRecipe(meal, profile);
        }

        if (recipe && recipe.ingredients && Array.isArray(recipe.ingredients)) {
          console.log('Found recipe with', recipe.ingredients.length, 'ingredients');

          // Helper function to parse quantity and unit from a string
          const parseQuantity = (str) => {
            // Convert to string if needed (pantry quantity might be a number)
            const strValue = String(str);
            // Match patterns like "2 lbs", "1.5 lb", "3 pounds", etc.
            const match = strValue.match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|oz|ounces?|cups?|tbsp|tsp|g|grams?|kg|kilograms?|ml|liters?|l|gallons?|quarts?|pints?|packages?|cans?|boxes?|bunches?|heads?|cloves?|stalks?|pieces?|slices?|dozen|count)?/i);

            if (match) {
              const quantity = parseFloat(match[1]);
              const unit = match[2] ? match[2].toLowerCase() : 'count';
              return { quantity, unit, hasQuantity: true };
            }

            return { quantity: 1, unit: 'count', hasQuantity: false };
          };

          // Helper to normalize units (convert to standard form)
          const normalizeUnit = (unit) => {
            const normalized = {
              'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
              'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
              'cup': 'cup', 'cups': 'cup',
              'gallon': 'gallon', 'gallons': 'gallon',
              'dozen': 'dozen',
              'package': 'package', 'packages': 'package',
              'can': 'can', 'cans': 'can',
              'box': 'box', 'boxes': 'box',
              'head': 'head', 'heads': 'head',
              'bunch': 'bunch', 'bunches': 'bunch',
              'count': 'count', 'piece': 'count', 'pieces': 'count'
            };
            return normalized[unit.toLowerCase()] || unit.toLowerCase();
          };

          // Match and update quantities in pantry
          for (const ingredient of recipe.ingredients) {
            try {
              const ingredientStr = typeof ingredient === 'string' ? ingredient : (ingredient.name || String(ingredient) || '');

              if (!ingredientStr) continue;

              // Parse quantity from recipe ingredient
              const recipeQty = parseQuantity(ingredientStr);

              // Extract ingredient name (remove quantities, measurements, and brand names)
              let ingredientName = ingredientStr
                .replace(/^\d+(\.\d+)?\s*(lbs?|oz|cups?|tbsp|tsp|g|kg|ml|l|gallons?|quarts?|pints?|packages?|cans?|boxes?|bunches?|heads?|cloves?|stalks?|pieces?|slices?|dozen|count)?\s*/i, '')
                .replace(/^(Great Value|Tyson|Hormel|All Natural|Fresh|Organic|Generic)\s+/i, '')
                .replace(/\([^)]*\)/g, '')
                .trim();

              if (!ingredientName) continue;

              const ingredientWords = ingredientName.toLowerCase().split(/\s+/).filter(word => word.length > 2);

              console.log(`\n🔍 Recipe needs: ${recipeQty.quantity} ${recipeQty.unit} ${ingredientName}`);

              // Find matching pantry item
              const pantryIndex = pantryItems.findIndex(item => {
                if (!item || !item.name) return false;
                const pantryName = item.name.toLowerCase();
                const pantryWords = pantryName.split(/\s+/).filter(word => word.length > 2);

                // Check for exact substring match
                if (pantryName.includes(ingredientName.toLowerCase()) ||
                    ingredientName.toLowerCase().includes(pantryName)) {
                  return true;
                }

                // Check if any key words match
                for (const ingredientWord of ingredientWords) {
                  for (const pantryWord of pantryWords) {
                    if (ingredientWord === pantryWord ||
                        ingredientWord.includes(pantryWord) ||
                        pantryWord.includes(ingredientWord)) {
                      return true;
                    }
                  }
                }
                return false;
              });

              if (pantryIndex !== -1) {
                const pantryItem = pantryItems[pantryIndex];
                const pantryQtyStr = pantryItem.quantity != null ? String(pantryItem.quantity) : '1 count';
                console.log(`✅ Found in pantry: ${pantryItem.name} (${pantryQtyStr})`);

                // Parse pantry quantity
                const pantryQty = parseQuantity(pantryQtyStr);
                console.log(`   Pantry has: ${pantryQty.quantity} ${pantryQty.unit}`);
                console.log(`   Recipe uses: ${recipeQty.quantity} ${recipeQty.unit}`);

                // Normalize units for comparison
                const normalizedPantryUnit = normalizeUnit(pantryQty.unit || 'count');
                const normalizedRecipeUnit = normalizeUnit(recipeQty.unit || 'count');

                // Only subtract if units match or we can reasonably compare them
                if (normalizedPantryUnit === normalizedRecipeUnit) {
                  const newQuantity = pantryQty.quantity - recipeQty.quantity;

                  if (newQuantity <= 0) {
                    // Remove item completely if we used it all
                    console.log(`   ❌ Removing entire item (used ${recipeQty.quantity}, had ${pantryQty.quantity})`);
                    pantryItems.splice(pantryIndex, 1);
                    removedCount++;
                  } else {
                    // Update quantity
                    pantryItems[pantryIndex].quantity = `${newQuantity} ${pantryQty.unit}`;
                    console.log(`   ✏️ Updated quantity to: ${newQuantity} ${pantryQty.unit}`);
                    removedCount++;
                  }
                } else {
                  // Units don't match - just remove the item to be safe
                  console.log(`   ⚠️ Units don't match (${normalizedPantryUnit} vs ${normalizedRecipeUnit}), removing item`);
                  pantryItems.splice(pantryIndex, 1);
                  removedCount++;
                }
              } else {
                console.log(`❌ No match found in pantry for: ${ingredientName}`);
              }
            } catch (ingredientError) {
              console.error(`Error processing ingredient:`, ingredient, ingredientError);
              // Continue with next ingredient instead of failing entirely
            }
          }

          console.log('Removed', removedCount, 'items from pantry');
          console.log('Pantry items remaining:', pantryItems.length);

          // Save updated pantry and clear cache to ensure Pantry component sees fresh data
          await saveUserData('pantry', pantryItems);
          // Also clear the kvService cache for pantry to force reload
          kvService.cache.delete(`${user.id}:pantry`);
          console.log('Pantry saved successfully');

          // Show success message
          if (removedCount > 0) {
            alert(`Marked "${meal.name}" as cooked!\n\n${removedCount} ingredient(s) removed/updated from your pantry.`);
          } else {
            alert(`Marked "${meal.name}" as cooked!\n\nNo matching pantry items were found to remove.`);
          }

        } else {
          // If we can't get recipe details, just mark as cooked without pantry update
          alert(`✅ Marked "${meal.name}" as cooked! (Recipe details not available to update pantry)`);
        }
      } catch (recipeError) {
        console.error('Error getting recipe details:', recipeError);
        alert(`✅ Marked "${meal.name}" as cooked! (Could not update pantry - recipe details unavailable)`);
      }

      // Track cooking history
      const existingHistory = await loadUserData('cookingHistory') || [];
      const newHistoryEntry = {
        meal: meal.name,
        date: new Date().toISOString(),
        mealType: meal.mealType,
        day: meal.day,
        ingredientsRemoved: removedCount
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];
      await saveUserData('cookingHistory', updatedHistory);
      setCookingHistory(updatedHistory);

    } catch (error) {
      console.error('Error marking meal as cooked:', error);
      alert('Failed to mark meal as cooked. Please try again.');
    }
  };

  const handleGenerateMealPlan = async () => {
    if (!profile) {
      alert('Profile not loaded. Please refresh the page and try again.');
      return;
    }
    
    setLoading(true);
    try {
      const pantryItems = await loadUserData('pantry') || [];
      
      // Create enhanced profile with recipe preferences
      const enhancedProfile = {
        ...profile,
        favoriteRecipes: favorites,
        dislikedRecipes: dislikes
      };
      
      
      const plan = await generateMealPlan(enhancedProfile, pantryItems);
      // Log snacks format for debugging
      if (plan?.days?.[0]?.meals?.snacks) {
      }
      setMealPlan(plan);
      setShoppingList(null);
      
      // Save the new meal plan to cloud immediately
      await saveUserData('currentMealPlan', plan);
      // Also clear the shopping list in cloud since we have a new meal plan
      await saveUserData('currentShoppingList', null);
    } catch (error) {
      alert(`Failed to generate meal plan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptMealPlan = async () => {
    if (!mealPlan) return;

    setLoading(true);
    setLoadingMessage('Generating shopping list...');

    try {
      // Step 1: Generate shopping list
      console.log('📝 Generating shopping list...');
      const pantryItems = await loadUserData('pantry') || [];
      const list = await generateShoppingList(mealPlan, pantryItems, profile);
      setShoppingList(list);

      // Save to localStorage (Clerk has 8KB limit)
      await saveUserData('currentMealPlan', mealPlan);
      await saveUserData('currentShoppingList', list);

      // Add to history with timestamp
      const historyEntry = {
        ...mealPlan,
        dateAccepted: new Date().toISOString(),
        weekStartDate: getWeekStartDate(new Date())
      };

      const history = await loadUserData('mealPlanHistory') || [];
      // Add new plan to beginning of history
      const newHistory = [historyEntry, ...history].slice(0, 12); // Keep last 12 weeks
      await saveUserData('mealPlanHistory', newHistory);
      setMealPlanHistory(newHistory);

      // Step 2: Generate ALL recipes (wait for completion)
      setLoadingMessage('Generating recipes for all meals...');
      console.log('🍳 Generating all recipes...');
      await generateRecipesInBackground();
      console.log('✅ Everything ready!');

      alert('✅ Meal plan accepted! Shopping list and all recipes are ready.');
    } catch (error) {
      console.error('Shopping list generation error:', error);
      alert(`Failed to generate shopping list: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };
  
  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  };
  
  const formatWeekDate = (dateStr) => {
    if (!dateStr) return 'Current Week';
    const date = new Date(dateStr);
    const options = { month: 'short', day: 'numeric' };
    return `Week of ${date.toLocaleDateString('en-US', options)}`;
  };
  
  const navigateWeek = (direction) => {
    if (direction < 0 && currentWeekIndex > 0) {
      setCurrentWeekIndex(currentWeekIndex - 1);
    } else if (direction > 0 && currentWeekIndex < mealPlanHistory.length) {
      setCurrentWeekIndex(currentWeekIndex + 1);
    }
  };
  
  const copyMealToCurrent = async (meal, day, mealType) => {
    if (!mealPlan) {
      alert('Please generate a meal plan first');
      return;
    }
    
    const updatedPlan = { ...mealPlan };
    const dayIndex = updatedPlan.days.findIndex(d => d.day === day);
    if (dayIndex !== -1) {
      updatedPlan.days[dayIndex].meals[mealType] = meal;
      setMealPlan(updatedPlan);
      await saveUserData('currentMealPlan', updatedPlan);
      alert(`Copied ${meal.name} to ${day} ${mealType}`);
    }
  };
  
  const reuseEntireWeek = async (historicalPlan) => {
    // Create a new plan with current date but same meals
    const newPlan = {
      ...historicalPlan,
      dateAccepted: new Date().toISOString(),
      weekStartDate: getWeekStartDate(new Date())
    };
    
    setMealPlan(newPlan);
    await saveUserData('currentMealPlan', newPlan);
    setShoppingList(null); // Clear shopping list so they need to accept the reused plan
    setCurrentWeekIndex(0); // Navigate back to current week
    alert('Reused entire week! Click "Accept Meal Plan" to generate a new shopping list.');
  };
  
  const handleShareMealPlan = () => {
    try {
      if (!mealPlan) {
        alert('No meal plan to share');
        return;
      }

      console.log('Starting share process...');

      // Create minimal share data
      const shareData = {
        days: mealPlan.days.map(day => ({
          day: day.day,
          meals: day.meals
        })),
        sharedBy: user?.primaryEmailAddress?.emailAddress || 'Anonymous',
        sharedDate: new Date().toISOString()
      };

      // Try to encode the meal plan data as base64
      let encodedData;
      try {
        const jsonString = JSON.stringify(shareData);
        encodedData = btoa(unescape(encodeURIComponent(jsonString)));
      } catch (e) {
        console.error('Error encoding data:', e);
        alert('Meal plan is too large to share. Please try with a simpler plan.');
        return;
      }

      // Generate share URL
      const url = `${window.location.origin}/shared/${encodedData}`;

      if (url.length > 8000) {
        alert('Meal plan is too large to share via link. Feature coming soon!');
        return;
      }

      setShareLink(url);
      setShowShareModal(true);
      console.log('Share modal should now be visible');

    } catch (error) {
      console.error('Error creating share link:', error);
      alert(`Failed to create share link: ${error.message}`);
    }
  };
  
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Link copied to clipboard!');
  };


  const generateRecipesInBackground = async () => {
    if (!mealPlan) return;

    console.log('🍳 Starting background recipe generation...');

    // Get all unique meals
    const uniqueMeals = new Set();
    mealPlan.days.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(type => {
        if (day.meals[type]) {
          uniqueMeals.add(day.meals[type].name);
        }
      });
    });

    console.log(`Found ${uniqueMeals.size} unique meals to generate recipes for`);

    // Load existing recipes cache
    const existingRecipes = await loadUserData('recipesCache') || {};

    // Filter out meals that are already cached
    const mealsToGenerate = Array.from(uniqueMeals).filter(mealName => !existingRecipes[mealName]);

    console.log(`${mealsToGenerate.length} recipes need to be generated (${uniqueMeals.size - mealsToGenerate.length} already cached)`);

    if (mealsToGenerate.length === 0) {
      console.log('All recipes already cached!');
      return;
    }

    // Generate recipes in batches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < mealsToGenerate.length; i += batchSize) {
      const batch = mealsToGenerate.slice(i, i + batchSize);
      console.log(`Generating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(mealsToGenerate.length / batchSize)}: ${batch.join(', ')}`);

      await Promise.all(
        batch.map(async (mealName) => {
          try {
            console.log(`Generating recipe for: ${mealName}`);
            const recipe = await getDetailedRecipe({ name: mealName }, profile);

            // Update cache
            const updatedCache = await loadUserData('recipesCache') || {};
            updatedCache[mealName] = recipe;
            await saveUserData('recipesCache', updatedCache);

            console.log(`✅ Recipe cached for: ${mealName}`);
          } catch (error) {
            console.error(`❌ Failed to generate recipe for ${mealName}:`, error);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < mealsToGenerate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('🎉 All recipe generation complete!');
  };

  const handleDeleteMealPlan = async () => {
    if (window.confirm('Are you sure you want to delete this meal plan?')) {
      setMealPlan(null);
      setShoppingList(null);
      
      // Clear from localStorage
      await saveUserData('currentMealPlan', null);
      await saveUserData('currentShoppingList', null);
      await saveUserData('recipesCache', null);
    }
  };

  const handleCustomMeal = async (dayIndex, mealType, customMealName) => {
    // Check if this is a meal prep plan (same meals all week)
    const isMealPrep = profile?.prepStyle === 'Weekly Meal Prep';
    
    // Determine which days to update
    let daysToUpdate = [dayIndex];
    
    if (isMealPrep) {
      // For meal prep, ask if they want to update all days
      const confirmAll = window.confirm(
        `Set "${customMealName}" as ${mealType} for all 7 days?\n\n` +
        `Click OK for all days\n` +
        `Click Cancel for just ${mealPlan.days[dayIndex].day}`
      );
      
      if (confirmAll) {
        daysToUpdate = mealPlan.days.map((_, idx) => idx);
      }
    }
    
    // Set loading state for the days being updated
    const replacingState = {};
    daysToUpdate.forEach(idx => {
      replacingState[`${idx}-${mealType}`] = true;
    });
    setReplacing(replacingState);
    
    try {
      // Generate full meal details via OpenAI
      const customMealDetails = await generateCustomMeal(customMealName, profile, mealType);
      
      const updatedPlan = { ...mealPlan };
      
      // Update all selected days with the full meal details
      daysToUpdate.forEach(idx => {
        updatedPlan.days[idx].meals[mealType] = {
          ...customMealDetails,
          isCustom: true
        };
      });
      
      setMealPlan(updatedPlan);
      setShoppingList(null); // Require re-acceptance
      
      // Save to localStorage
      await saveUserData('currentMealPlan', updatedPlan);
      
      if (daysToUpdate.length > 1) {
        alert(`"${customMealName}" has been set for ${daysToUpdate.length} days!`);
      }
    } catch (error) {
      alert('Failed to generate custom meal details. Please try again.');
    } finally {
      setReplacing({});
    }
  };

  const handleReplaceMeal = async (dayIndex, mealType) => {
    // Check if this is a meal prep plan (same meals all week)
    const currentMeal = mealPlan.days[dayIndex].meals[mealType];
    const isMealPrep = profile?.prepStyle === 'Weekly Meal Prep';
    
    // Find all days with the same meal
    const sameMealDays = [];
    mealPlan.days.forEach((day, idx) => {
      if (day.meals[mealType]?.name === currentMeal.name) {
        sameMealDays.push(idx);
      }
    });

    // If meal appears on multiple days, ask user what to replace
    let daysToReplace = [dayIndex];
    
    if (isMealPrep && sameMealDays.length > 1) {
      const replaceAll = window.confirm(
        `This ${mealType} appears on ${sameMealDays.length} days.\n\n` +
        `Click OK to replace all ${sameMealDays.length} days\n` +
        `Click Cancel to replace just ${mealPlan.days[dayIndex].day}`
      );
      
      if (replaceAll) {
        daysToReplace = sameMealDays;
      }
    } else if (sameMealDays.length > 1) {
      // Even if not meal prep, if same meal appears multiple times, ask
      const replaceAll = window.confirm(
        `This ${mealType} appears on ${sameMealDays.length} days.\n\n` +
        `Click OK to replace all occurrences\n` +
        `Click Cancel to replace just ${mealPlan.days[dayIndex].day}`
      );
      
      if (replaceAll) {
        daysToReplace = sameMealDays;
      }
    }

    // Set all days as replacing
    const replacingState = {};
    daysToReplace.forEach(idx => {
      replacingState[`${idx}-${mealType}`] = true;
    });
    setReplacing(replacingState);

    try {
      const pantryItems = await loadUserData('pantry') || [];
      const newMeal = await replaceMeal(
        currentMeal,
        profile,
        pantryItems,
        mealType
      );
      
      const updatedPlan = { ...mealPlan };
      
      // Replace meal on all selected days
      daysToReplace.forEach(idx => {
        updatedPlan.days[idx].meals[mealType] = newMeal;
      });
      
      setMealPlan(updatedPlan);
      setShoppingList(null); // Require re-acceptance
      
      // Save to localStorage
      await saveUserData('currentMealPlan', updatedPlan);
      
      if (daysToReplace.length > 1) {
        alert(`${mealType} has been replaced on ${daysToReplace.length} days!`);
      }
    } catch (error) {
      console.error('Error replacing meal:', error);
      alert(`Failed to replace meal: ${error.message || 'Unknown error'}`);
    } finally {
      setReplacing({});
    }
  };

  useEffect(() => {
    const loadSavedData = async () => {
      if (!user) return;
      // Load saved meal plan
      const savedPlan = await loadUserData('currentMealPlan');
      const savedList = await loadUserData('currentShoppingList');
      if (savedPlan) setMealPlan(savedPlan);
      if (savedList) setShoppingList(savedList);
    };
    loadSavedData();
  }, [user]);

  return (
    <div className="meal-plan-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2>Weekly Meal Plan</h2>
        {mealPlanHistory.length > 0 && mealPlan && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => navigateWeek(1)}
              disabled={currentWeekIndex >= mealPlanHistory.length}
              style={{
                padding: '8px 16px',
                backgroundColor: currentWeekIndex >= mealPlanHistory.length ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: currentWeekIndex >= mealPlanHistory.length ? 'not-allowed' : 'pointer'
              }}
            >
              ← Previous Week
            </button>
            <span style={{ fontWeight: 'bold' }}>
              {currentWeekIndex === 0 ? 'Current Week' : `${currentWeekIndex} week${currentWeekIndex > 1 ? 's' : ''} ago`}
              {mealPlanHistory.length > 0 && ` (${mealPlanHistory.length} saved)`}
            </span>
            <button
              onClick={() => navigateWeek(-1)}
              disabled={currentWeekIndex === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: currentWeekIndex === 0 ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: currentWeekIndex === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Next Week →
            </button>
          </div>
        )}
      </div>
      
      {!mealPlan && (
        <div className="generate-section">
          <p>Generate a personalized meal plan based on your preferences and budget.</p>
          <button 
            onClick={handleGenerateMealPlan} 
            disabled={loading}
            className="generate-btn"
          >
            {loading ? 'Generating...' : 'Generate Meal Plan'}
          </button>
        </div>
      )}

      {(mealPlan || mealPlanHistory.length > 0) && (
        <div className="meal-plan-weeks">
          {/* Current Week */}
          {currentWeekIndex === 0 && mealPlan && (
            <div id="week-0">
              <div className="plan-header">
                <h3>Current Week Plan</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleShareMealPlan}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🔗 Share Plan
                  </button>
                  {!shoppingList && (
                    <button
                      onClick={handleAcceptMealPlan}
                      disabled={loading}
                      className="accept-btn"
                    >
                      {loading ? (loadingMessage || 'Processing...') : 'Accept & Generate Shopping List + Recipes'}
                    </button>
                  )}
                </div>
              </div>
              
              <MealPlanWeek
                weekPlan={mealPlan}
                weekLabel={formatWeekDate(getWeekStartDate(new Date()))}
                isCurrentWeek={true}
                onReplaceMeal={handleReplaceMeal}
                onCustomMeal={handleCustomMeal}
                onToggleFavorite={toggleFavorite}
                onToggleDislike={toggleDislike}
                onCookedMeal={handleCookedMeal}
                favorites={favorites}
                dislikes={dislikes}
                replacing={replacing}
                shoppingList={shoppingList}
                cookingHistory={cookingHistory}
              />
            </div>
          )}
          
          {/* Historical Weeks */}
          {currentWeekIndex > 0 && mealPlanHistory[currentWeekIndex - 1] && (
            <div id={`week-${currentWeekIndex}`}>
              <MealPlanWeek
                weekPlan={mealPlanHistory[currentWeekIndex - 1]}
                weekLabel={formatWeekDate(mealPlanHistory[currentWeekIndex - 1].weekStartDate)}
                isCurrentWeek={false}
                onCopyMeal={copyMealToCurrent}
                onReuseWeek={reuseEntireWeek}
                favorites={favorites}
                dislikes={dislikes}
              />
            </div>
          )}
          
          {/* Old meal plan grid code will be replaced by MealPlanWeek component */}
          <div style={{ display: 'none' }}>
            {mealPlan && mealPlan.days && mealPlan.days.map((day, dayIndex) => (
              <div key={dayIndex} className="day-card">
                <h4>{day.day}</h4>
                
                {['breakfast', 'lunch', 'dinner'].filter(mealType => day.meals && day.meals[mealType]).map(mealType => {
                  const isReplacing = replacing[`${dayIndex}-${mealType}`];
                  return (
                    <div key={mealType} className="meal-item">
                      <div className="meal-header">
                        <span className="meal-type">{mealType}</span>
                        <button
                          onClick={() => handleReplaceMeal(dayIndex, mealType)}
                          disabled={Object.keys(replacing).length > 0}
                          className="replace-btn"
                        >
                          {isReplacing ? 'Replacing...' : 'Replace'}
                        </button>
                      </div>
                      <p className="meal-name">{day.meals[mealType]?.name || 'N/A'}</p>
                      <p className="meal-cost">${day.meals[mealType]?.estimatedCost?.toFixed(2) || '0.00'}</p>
                      
                      <div className="meal-actions">
                        <button
                          onClick={() => day.meals[mealType] && toggleFavorite(day.meals[mealType].name)}
                          className={`thumb-btn ${day.meals[mealType] && favorites.includes(day.meals[mealType].name) ? 'active' : ''}`}
                          title="Like this recipe"
                          disabled={!day.meals[mealType]}
                        >
                          👍
                        </button>
                        <button
                          onClick={() => day.meals[mealType] && toggleDislike(day.meals[mealType].name)}
                          className={`thumb-btn ${day.meals[mealType] && dislikes.includes(day.meals[mealType].name) ? 'active' : ''}`}
                          title="Dislike this recipe"
                          disabled={!day.meals[mealType]}
                        >
                          👎
                        </button>
                        <button
                          onClick={() => day.meals[mealType] && handleCookedMeal({...day.meals[mealType], mealType})}
                          className="cooked-btn"
                          title="I cooked this"
                          disabled={!day.meals[mealType]}
                        >
                          🍳 Cooked
                        </button>
                      </div>
                      {day.meals[mealType]?.nutrition && (
                        <div className="meal-nutrition">
                          <span className="nutrition-badge">Cal: {day.meals[mealType].nutrition.calories}</span>
                          <span className="nutrition-badge">P: {day.meals[mealType].nutrition.protein}g</span>
                          <span className="nutrition-badge">C: {day.meals[mealType].nutrition.carbs}g</span>
                          <span className="nutrition-badge">F: {day.meals[mealType].nutrition.fat}g</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Display snacks if present */}
                {day.meals.snacks && day.meals.snacks.length > 0 && (
                  <div className="snack-section">
                    <h5 className="snack-header">Snacks</h5>
                    <div className="snack-list">
                      {day.meals.snacks.map((snack, idx) => {
                        // Handle different snack formats
                        let snackName = snack;
                        if (typeof snack === 'object') {
                          snackName = snack.name || snack.title || JSON.stringify(snack);
                        }
                        return <p key={idx} className="snack-item">• {snackName}</p>;
                      })}
                    </div>
                  </div>
                )}
                
                {/* Display daily nutritional totals */}
                {(() => {
                  // Check if any meal has nutrition data
                  const hasNutrition = ['breakfast', 'lunch', 'dinner'].some(mealType => 
                    day.meals[mealType]?.nutrition
                  );
                  
                  if (!hasNutrition) return null;
                  
                  const dailyTotals = ['breakfast', 'lunch', 'dinner'].reduce((totals, mealType) => {
                    const meal = day.meals[mealType];
                    if (meal?.nutrition) {
                      totals.calories += meal.nutrition.calories || 0;
                      totals.protein += meal.nutrition.protein || 0;
                      totals.carbs += meal.nutrition.carbs || 0;
                      totals.fat += meal.nutrition.fat || 0;
                      totals.fiber += meal.nutrition.fiber || 0;
                    }
                    return totals;
                  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
                  
                  return (
                    <div className="daily-nutrition-totals">
                      <h5>Daily Totals</h5>
                      <div className="nutrition-summary">
                        <span>Calories: {dailyTotals.calories}</span>
                        <span>Protein: {dailyTotals.protein}g</span>
                        <span>Carbs: {dailyTotals.carbs}g</span>
                        <span>Fat: {dailyTotals.fat}g</span>
                        <span>Fiber: {dailyTotals.fiber}g</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
          
          {currentWeekIndex === 0 && mealPlan && (
            <div className="plan-actions">
              {!shoppingList && (
                <button
                  onClick={handleAcceptMealPlan}
                  disabled={loading}
                  className="accept-btn"
                >
                  {loading ? (loadingMessage || 'Processing...') : 'Accept & Generate Shopping List + Recipes'}
                </button>
              )}
              <button 
                onClick={handleDeleteMealPlan}
                className="delete-plan-btn"
              >
                Delete Meal Plan
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Share Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Share Your Meal Plan</h3>
            <p style={{ marginBottom: '15px' }}>
              Share this link with family or friends:
            </p>
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <input
                type="text"
                value={shareLink}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              />
              <button
                onClick={copyShareLink}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                📋 Copy
              </button>
            </div>
            <p style={{ 
              fontSize: '14px', 
              color: '#666',
              marginBottom: '20px'
            }}>
              This link will be valid for 30 days. Recipients can view your meal plan without an account.
            </p>
            <button
              onClick={() => setShowShareModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#f0f0f0',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MealPlan;