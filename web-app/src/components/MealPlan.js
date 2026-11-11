import React, { useState, useEffect } from 'react';
import { generateMealPlan, replaceMeal, generateShoppingList, getDetailedRecipe, generateCustomMeal } from '../services/gptService';
import MealPlanWeek from './MealPlanWeek';
import kvService from '../services/kvService';
import { getAuthToken } from '../utils/authToken';
import './MealPlan.css';

function MealPlan({ user, profile: profileProp }) {
  const [mealPlan, setMealPlan] = useState(null);
  const [, setShoppingList] = useState(null);
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
  const [mealPlanAccepted, setMealPlanAccepted] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Copy a plan before changing it, so saved history is never altered by
  // edits to the current week.
  const clonePlan = (plan) => JSON.parse(JSON.stringify(plan));

  // Changing a meal makes the saved shopping list out of date.
  const invalidateShoppingList = async () => {
    setShoppingList(null);
    setMealPlanAccepted(false);
    await saveUserData('currentShoppingList', null);
    await saveUserData('mealPlanAccepted', false);
  };

  // Helper function to save data to cloud storage
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
        savedCookingHistory,
        savedMealPlanAccepted
      ] = await Promise.all([
        loadUserData('recipeFavorites'),
        loadUserData('recipeDislikes'),
        loadUserData('mealPlanHistory'),
        loadUserData('currentMealPlan'),
        loadUserData('currentShoppingList'),
        loadUserData('cookingHistory'),
        loadUserData('mealPlanAccepted')
      ]);

      setFavorites(savedFavorites || []);
      setDislikes(savedDislikes || []);
      setCookingHistory(savedCookingHistory || []);
      setMealPlanAccepted(savedMealPlanAccepted || false);

      if (history) {
        setMealPlanHistory(history);
      } else {
        setMealPlanHistory([]);
      }

      if (savedMealPlan) {
        setMealPlan(savedMealPlan);
      } else {
        // A plan the user chose to import from a shared link before signing up.
        try {
          const imported = JSON.parse(sessionStorage.getItem('importMealPlan') || 'null');
          if (imported && Array.isArray(imported.days) && imported.days.length) {
            const plan = { days: imported.days };
            setMealPlan(plan);
            await saveUserData('currentMealPlan', plan);
          }
          sessionStorage.removeItem('importMealPlan');
        } catch {
          sessionStorage.removeItem('importMealPlan');
        }
      }

      if (savedShoppingList) {
        setShoppingList(savedShoppingList);
      }
    };
    
    loadAllData();
    // Using user?.id instead of user to prevent re-running when Clerk's user object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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


      // Try to get the recipe details to know what ingredients to remove
      try {
        // First check if recipe is cached
        const recipesCache = await loadUserData('recipesCache') || {};
        let recipe = recipesCache[meal.name];

        // If not cached, fetch it
        if (!recipe) {
          recipe = await getDetailedRecipe(meal, profile);
          await saveUserData('recipesCache', { ...recipesCache, [meal.name]: recipe });
        }

        if (recipe && recipe.ingredients && Array.isArray(recipe.ingredients)) {

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

                // Parse pantry quantity
                const pantryQty = parseQuantity(pantryQtyStr);

                // Normalize units for comparison
                const normalizedPantryUnit = normalizeUnit(pantryQty.unit || 'count');
                const normalizedRecipeUnit = normalizeUnit(recipeQty.unit || 'count');

                // Subtract quantities - be smart about unit matching
                let amountToSubtract = recipeQty.quantity;

                // If units don't match, just subtract 1 (assume 1 serving used)
                if (normalizedPantryUnit !== normalizedRecipeUnit) {
                  amountToSubtract = 1;
                }

                const newQuantity = pantryQty.quantity - amountToSubtract;

                if (newQuantity <= 0) {
                  // Remove item completely if we used it all
                  pantryItems.splice(pantryIndex, 1);
                  removedCount++;
                } else {
                  // Update quantity - keep the pantry's original unit
                  pantryItems[pantryIndex].quantity = `${newQuantity} ${pantryQty.unit}`;
                  removedCount++;
                }
              } else {
              }
            } catch (ingredientError) {
              console.error(`Error processing ingredient:`, ingredient, ingredientError);
              // Continue with next ingredient instead of failing entirely
            }
          }


          // Save updated pantry and clear cache to ensure Pantry component sees fresh data
          if (!user || !user.id) {
            console.error('ERROR: No user ID available for pantry save!');
            throw new Error('User not available');
          }
          await kvService.set(user.id, 'pantry', pantryItems);

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
    setLoadingMessage('Planning your week...');
    try {
      const pantryItems = await loadUserData('pantry') || [];
      
      // Create enhanced profile with recipe preferences
      const enhancedProfile = {
        ...profile,
        favoriteRecipes: favorites,
        dislikedRecipes: dislikes
      };
      
      
      const plan = await generateMealPlan(enhancedProfile, pantryItems, (progress) => {
        if (progress.stage) setLoadingMessage(`${progress.stage}...`);
      });
      setMealPlan(plan);
      setShoppingList(null);
      setMealPlanAccepted(false);

      // Save the new meal plan to cloud immediately
      await saveUserData('currentMealPlan', plan);
      // Also clear the shopping list and accepted status since we have a new meal plan
      await saveUserData('currentShoppingList', null);
      await saveUserData('mealPlanAccepted', false);
    } catch (error) {
      alert(error.message || 'Failed to generate the meal plan. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleAcceptMealPlan = async () => {
    if (!mealPlan) return;

    setLoading(true);
    setLoadingMessage('Building your shopping list...');

    try {
      // Step 1: Generate shopping list
      const pantryItems = await loadUserData('pantry') || [];
      const list = await generateShoppingList(mealPlan, pantryItems, profile, (progress) => {
        if (progress.stage) setLoadingMessage(`${progress.stage}...`);
      });
      setShoppingList(list);

      // Save to localStorage (Clerk has 8KB limit)
      await saveUserData('currentMealPlan', mealPlan);
      await saveUserData('currentShoppingList', list);

      // Mark meal plan as accepted (persists even after shopping list is cleared)
      setMealPlanAccepted(true);
      await saveUserData('mealPlanAccepted', true);

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

      // Step 2: Write the recipes. The plan is already accepted and the list is
      // saved, so a recipe that fails here is simply written later on demand.
      setLoadingMessage('Writing your recipes...');
      const missing = await generateRecipesInBackground();

      alert(
        missing > 0
          ? `✅ Meal plan accepted! Your shopping list is ready. ${missing} recipe${missing === 1 ? '' : 's'} will be written when you open ${missing === 1 ? 'it' : 'them'}.`
          : '✅ Meal plan accepted! Shopping list and all recipes are ready.'
      );
    } catch (error) {
      console.error('Shopping list generation error:', error);
      alert(error.message || 'Failed to generate the shopping list. Please try again.');
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
    
    const updatedPlan = clonePlan(mealPlan);
    const dayIndex = updatedPlan.days.findIndex(d => d.day === day);
    if (dayIndex !== -1) {
      updatedPlan.days[dayIndex].meals[mealType] = clonePlan(meal);
      setMealPlan(updatedPlan);
      await saveUserData('currentMealPlan', updatedPlan);
      await invalidateShoppingList();
      alert(`Copied ${meal.name} to ${day} ${mealType}`);
    }
  };
  
  const reuseEntireWeek = async (historicalPlan) => {
    // Create a new plan with current date but same meals
    const newPlan = {
      ...clonePlan(historicalPlan),
      dateAccepted: new Date().toISOString(),
      weekStartDate: getWeekStartDate(new Date())
    };
    
    setMealPlan(newPlan);
    await saveUserData('currentMealPlan', newPlan);
    await invalidateShoppingList(); // They need to accept the reused plan
    setCurrentWeekIndex(0); // Navigate back to current week
    alert('Reused entire week! Click "Accept Meal Plan" to generate a new shopping list.');
  };
  
  const handleShareMealPlan = async () => {
    if (!mealPlan) {
      alert('No meal plan to share');
      return;
    }
    setSharing(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          plan: { days: mealPlan.days },
          // A first name only: the link can be opened by anyone who has it.
          sharedBy: user?.firstName || 'A Weekly Dish User'
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.id) {
        throw new Error(data.error || 'Could not create the share link. Please try again.');
      }
      setShareLink(`${window.location.origin}/shared/${data.id}`);
      setShowShareModal(true);
    } catch (error) {
      alert(error.message);
    } finally {
      setSharing(false);
    }
  };
  
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert('Link copied to clipboard!');
    } catch {
      alert('Copy failed. Select the link and copy it manually.');
    }
  };


  // Writes a recipe for every meal in the plan that does not have one yet.
  // Returns how many could not be written (they are fetched later on demand).
  const generateRecipesInBackground = async () => {
    if (!mealPlan) return 0;

    // One recipe per distinct meal, passing the full meal so the recipe uses
    // the same ingredients the shopping list was built from.
    const uniqueMeals = new Map();
    mealPlan.days.forEach(day => {
      ['breakfast', 'lunch', 'dinner'].forEach(type => {
        const meal = day.meals[type];
        if (meal && meal.name && !uniqueMeals.has(meal.name)) uniqueMeals.set(meal.name, meal);
      });
    });

    const recipes = { ...((await loadUserData('recipesCache')) || {}) };
    const mealsToGenerate = Array.from(uniqueMeals.values()).filter(meal => !recipes[meal.name]);
    if (mealsToGenerate.length === 0) return 0;

    const writeRecipe = async (meal) => {
      try {
        recipes[meal.name] = await getDetailedRecipe(meal, profile);
        return true;
      } catch (error) {
        console.error(`Recipe for ${meal.name} failed:`, error.message);
        return false;
      }
    };

    let failed = 0;
    const batchSize = 3;
    for (let i = 0; i < mealsToGenerate.length; i += batchSize) {
      setLoadingMessage(`Writing recipes (${i} of ${mealsToGenerate.length})...`);
      const outcomes = await Promise.all(mealsToGenerate.slice(i, i + batchSize).map(writeRecipe));
      failed += outcomes.filter((ok) => !ok).length;
      // Save after each batch so finished recipes are kept if the tab closes.
      await saveUserData('recipesCache', { ...recipes });
    }
    return failed;
  };

  const handleDeleteMealPlan = async () => {
    if (window.confirm('Are you sure you want to delete this meal plan?')) {
      setMealPlan(null);
      setShoppingList(null);
      setMealPlanAccepted(false);

      await saveUserData('currentMealPlan', null);
      await saveUserData('currentShoppingList', null);
      await saveUserData('mealPlanAccepted', false);
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
      
      const updatedPlan = clonePlan(mealPlan);
      
      // Update all selected days with the full meal details
      daysToUpdate.forEach(idx => {
        updatedPlan.days[idx].meals[mealType] = {
          ...customMealDetails,
          isCustom: true
        };
      });
      
      setMealPlan(updatedPlan);
      await saveUserData('currentMealPlan', updatedPlan);
      await invalidateShoppingList(); // Require re-acceptance
      
      if (daysToUpdate.length > 1) {
        alert(`"${customMealName}" has been set for ${daysToUpdate.length} days!`);
      }
    } catch (error) {
      alert(error.message || 'Failed to generate custom meal details. Please try again.');
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
      // Tell the AI what is already planned so the replacement is not a repeat.
      const otherMeals = Array.from(new Set(
        mealPlan.days.flatMap(day => ['breakfast', 'lunch', 'dinner'].map(type => day.meals[type]?.name).filter(Boolean))
      ));
      const newMeal = await replaceMeal(
        currentMeal,
        { ...profile, dislikedRecipes: dislikes },
        pantryItems,
        mealType,
        otherMeals
      );
      
      const updatedPlan = clonePlan(mealPlan);
      
      // Replace meal on all selected days
      daysToReplace.forEach(idx => {
        updatedPlan.days[idx].meals[mealType] = { ...newMeal };
      });
      
      setMealPlan(updatedPlan);
      await saveUserData('currentMealPlan', updatedPlan);
      await invalidateShoppingList(); // Require re-acceptance
      
      if (daysToReplace.length > 1) {
        alert(`${mealType} has been replaced on ${daysToReplace.length} days!`);
      }
    } catch (error) {
      console.error('Error replacing meal:', error);
      alert(error.message || 'Failed to replace the meal. Please try again.');
    } finally {
      setReplacing({});
    }
  };

  // Removed duplicate useEffect - data is already loaded in the first useEffect

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
            {loading ? (loadingMessage || 'Generating...') : 'Generate Meal Plan'}
          </button>
          {loading && (
            <p className="generate-hint">This usually takes under a minute. You can keep this tab open while it works.</p>
          )}
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
                    disabled={sharing}
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
                    {sharing ? 'Creating link...' : '🔗 Share Plan'}
                  </button>
                  {!mealPlanAccepted && (
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
              
              {(() => {
                // Honest budget summary, added up from the meals shown.
                const total = mealPlan.days.reduce((sum, day) => sum + ['breakfast', 'lunch', 'dinner']
                  .reduce((t, type) => t + (Number(day.meals?.[type]?.estimatedCost) || 0), 0), 0);
                const budget = Number(profile?.weeklyBudget) || 0;
                if (!total) return null;
                const over = budget > 0 && total > budget * 1.02;
                return (
                  <div className={`plan-budget ${over ? 'over' : ''}`}>
                    <strong>Estimated cost of meals: ${total.toFixed(2)}</strong>
                    {budget > 0 && <span> of your ${budget.toFixed(2)} weekly budget</span>}
                    {over && <span> — over budget. Replace a pricier meal or raise the budget in your profile.</span>}
                    <div className="plan-budget-note">Prices are estimates. Your shopping list shows the full grocery total.</div>
                  </div>
                );
              })()}

              {Array.isArray(mealPlan.warnings) && mealPlan.warnings.length > 0 && (
                <div className="plan-warnings" role="alert">
                  <strong>Please double-check:</strong>
                  <ul>{mealPlan.warnings.map((warning, idx) => <li key={idx}>{warning}</li>)}</ul>
                </div>
              )}

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
                mealPlanAccepted={mealPlanAccepted}
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
          
          {currentWeekIndex === 0 && mealPlan && (
            <div className="plan-actions">
              {!mealPlanAccepted && (
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
              This link works for 6 months. Anyone with the link can view this meal plan without an account. It shows only the meals, not your profile or pantry.
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