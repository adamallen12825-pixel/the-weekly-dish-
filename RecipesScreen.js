import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import UserCounter from './UserCounter';

export default function RecipesScreen({ onBack }) {
  const [currentMealPlan, setCurrentMealPlan] = useState(null);
  const [recipes, setRecipes] = useState({});
  const [loadingRecipe, setLoadingRecipe] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    loadMealPlan();
  }, []);

  const loadMealPlan = async () => {
    try {
      const mealPlan = await AsyncStorage.getItem('@weekly_dish_current_meal_plan');
      if (mealPlan) {
        const plan = JSON.parse(mealPlan);
        setCurrentMealPlan(plan);
        
        // Load saved recipes
        const savedRecipes = await AsyncStorage.getItem('@weekly_dish_recipes');
        if (savedRecipes) {
          setRecipes(JSON.parse(savedRecipes));
        }
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    }
  };

  const loadRecipe = async (mealName) => {
    // Check if recipe already loaded
    if (recipes[mealName]) {
      setSelectedRecipe({ name: mealName, ...recipes[mealName] });
      return;
    }

    setLoadingRecipe(mealName);
    try {
      // Get user profile for servings
      const profileData = await AsyncStorage.getItem('@weekly_dish_user_profile');
      const profile = JSON.parse(profileData);
      let servings = parseInt(profile.adults || 2) + parseInt(profile.kids || 0);
      
      // For meal prep, multiply servings by 7 days
      if (profile.prepStyle === 'Weekly Meal Prep') {
        // Count how many times this meal appears in the week
        const mealCount = getAllMeals().filter(meal => meal === mealName).length;
        servings = servings * mealCount;
        console.log('Meal prep mode: making', mealCount, 'batches for', servings, 'total servings');
      }
      
      console.log('Loading recipe for:', mealName, 'Servings:', servings);
      
      const recipe = await apiService.getRecipeDetails(
        mealName,
        servings,
        profile.weeklyBudget
      );
      
      console.log('Recipe loaded:', recipe);
      console.log('Instructions check:', {
        hasInstructions: !!recipe.instructions,
        instructionsType: typeof recipe.instructions,
        instructionsLength: recipe.instructions?.length,
        firstInstruction: recipe.instructions?.[0],
        hasRecipeInstructions: !!recipe.recipe?.instructions,
        allKeys: Object.keys(recipe)
      });
      
      // Save recipe
      const updatedRecipes = { ...recipes, [mealName]: recipe };
      setRecipes(updatedRecipes);
      await AsyncStorage.setItem('@weekly_dish_recipes', JSON.stringify(updatedRecipes));
      
      setSelectedRecipe({ name: mealName, ...recipe });
    } catch (error) {
      console.error('Error loading recipe:', error);
      console.error('Error message:', error.message);
      
      // Show user-friendly error
      Alert.alert(
        'Error Loading Recipe',
        'Failed to load the recipe. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingRecipe(null);
    }
  };

  const getAllMeals = () => {
    if (!currentMealPlan || !currentMealPlan.days) return [];
    
    const meals = new Set();
    currentMealPlan.days.forEach(day => {
      if (day.meals) {
        if (day.meals.breakfast) meals.add(day.meals.breakfast);
        if (day.meals.lunch) meals.add(day.meals.lunch);
        if (day.meals.dinner) meals.add(day.meals.dinner);
      }
    });
    
    return Array.from(meals);
  };

  const renderRecipeList = () => {
    const meals = getAllMeals();
    
    if (meals.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No recipes yet</Text>
          <Text style={styles.emptySubtext}>
            Generate a meal plan to see recipes here
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.recipeList}>
        {meals.map((meal, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recipeCard}
            onPress={() => loadRecipe(meal)}
            disabled={loadingRecipe === meal}
          >
            <Text style={styles.recipeName}>{meal}</Text>
            {loadingRecipe === meal ? (
              <ActivityIndicator size="small" color="#3498db" />
            ) : (
              <Text style={styles.viewText}>View Recipe →</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderRecipeDetails = () => {
    if (!selectedRecipe) return null;

    return (
      <ScrollView style={styles.recipeDetails}>
        <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
          <Text style={styles.backToList}>← Back to recipes</Text>
        </TouchableOpacity>
        
        <Text style={styles.recipeTitle}>{selectedRecipe.name}</Text>
        
        {selectedRecipe.prepTime && (
          <View style={styles.timeInfo}>
            <Text style={styles.timeLabel}>Prep: {selectedRecipe.prepTime}</Text>
            <Text style={styles.timeLabel}>Cook: {selectedRecipe.cookTime}</Text>
            <Text style={styles.timeLabel}>Total: {selectedRecipe.totalTime}</Text>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {Array.isArray(selectedRecipe.ingredients) ? (
            selectedRecipe.ingredients.map((item, index) => (
              <Text key={index} style={styles.ingredient}>
                • {typeof item === 'string' 
                    ? item 
                    : `${item.amount || item.quantity || ''} ${item.name || item.ingredient || item}`}
              </Text>
            ))
          ) : selectedRecipe.recipe?.ingredients ? (
            selectedRecipe.recipe.ingredients.map((item, index) => (
              <Text key={index} style={styles.ingredient}>
                • {typeof item === 'string' 
                    ? item 
                    : `${item.amount || item.quantity || ''} ${item.name || item.ingredient || item}`}
              </Text>
            ))
          ) : (
            <Text style={styles.ingredient}>No ingredients available</Text>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {(() => {
            // Try to get instructions from various sources
            let instructionsList = selectedRecipe.instructions || 
                                  selectedRecipe.recipe?.instructions || 
                                  selectedRecipe.steps || 
                                  selectedRecipe.directions || 
                                  selectedRecipe.method || 
                                  [];
            
            // Ensure it's an array
            if (!Array.isArray(instructionsList)) {
              if (typeof instructionsList === 'string') {
                instructionsList = instructionsList.split(/\n|\.(?=[A-Z])/).filter(s => s.trim());
              } else if (typeof instructionsList === 'object') {
                instructionsList = Object.values(instructionsList);
              } else {
                instructionsList = [];
              }
            }
            
            // If still no instructions, generate basic ones
            if (instructionsList.length === 0) {
              const recipeLower = selectedRecipe.name.toLowerCase();
              if (recipeLower.includes('scrambled') || recipeLower.includes('eggs')) {
                instructionsList = [
                  'Heat butter or oil in a pan over medium heat',
                  'Beat eggs in a bowl, season with salt and pepper',
                  'Pour eggs into heated pan',
                  'Stir gently until cooked to desired consistency',
                  'Serve immediately'
                ];
              } else if (recipeLower.includes('grilled')) {
                instructionsList = [
                  'Preheat grill to medium-high heat',
                  'Season meat with salt, pepper, and desired spices',
                  'Grill for recommended time, flipping halfway',
                  'Let rest for 5 minutes before serving'
                ];
              } else if (recipeLower.includes('baked') || recipeLower.includes('roast')) {
                instructionsList = [
                  'Preheat oven to appropriate temperature',
                  'Season ingredients as desired',
                  'Bake for recommended time',
                  'Check for doneness and serve'
                ];
              } else {
                instructionsList = [
                  `Prepare ingredients for ${selectedRecipe.name}`,
                  'Cook using appropriate method for this dish',
                  'Season to taste and serve'
                ];
              }
              console.log('Generated fallback instructions in UI for:', selectedRecipe.name);
            }
            
            return instructionsList.map((step, index) => (
              <View key={index} style={styles.instruction}>
                <Text style={styles.stepNumber}>Step {index + 1}</Text>
                <Text style={styles.stepText}>
                  {typeof step === 'string' ? step : (step.instruction || step.details || step.action || step.text || JSON.stringify(step))}
                </Text>
              </View>
            ));
          })()}
        </View>
        
        {selectedRecipe.nutrition && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition (per serving)</Text>
            <Text style={styles.nutritionText}>
              Calories: {selectedRecipe.nutrition.calories}
            </Text>
            <Text style={styles.nutritionText}>
              Protein: {selectedRecipe.nutrition.protein}g
            </Text>
            <Text style={styles.nutritionText}>
              Carbs: {selectedRecipe.nutrition.carbs}g
            </Text>
            <Text style={styles.nutritionText}>
              Fat: {selectedRecipe.nutrition.fat}g
            </Text>
          </View>
        )}
        
        
        {selectedRecipe.tips && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tips</Text>
            <Text style={styles.tipsText}>{selectedRecipe.tips}</Text>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Tutorials</Text>
          <TouchableOpacity
            style={styles.youtubeButton}
            onPress={() => {
              const query = encodeURIComponent(`how to make ${selectedRecipe.name}`);
              const youtubeUrl = `https://www.youtube.com/results?search_query=${query}`;
              Linking.openURL(youtubeUrl).catch(err => 
                Alert.alert('Error', 'Could not open YouTube')
              );
            }}
          >
            <View style={styles.youtubeContent}>
              <View style={styles.youtubeLeft}>
                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
                <View style={styles.youtubeTextContainer}>
                  <Text style={styles.youtubeTitle}>How to make {selectedRecipe.name}</Text>
                  <Text style={styles.youtubeSubtitle}>Search YouTube for video tutorials</Text>
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <UserCounter />
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Recipes</Text>
      
      {selectedRecipe ? renderRecipeDetails() : renderRecipeList()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  recipeList: {
    flex: 1,
  },
  recipeCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  viewText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  recipeDetails: {
    flex: 1,
  },
  backToList: {
    fontSize: 14,
    color: '#3498db',
    marginBottom: 15,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  timeInfo: {
    flexDirection: 'row',
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 6,
    marginBottom: 20,
  },
  timeLabel: {
    fontSize: 14,
    color: '#34495e',
    marginRight: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  ingredient: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
  },
  instruction: {
    marginBottom: 15,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  stepText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
  },
  nutritionText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 3,
  },
  tipsText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
  },
  youtubeButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  youtubeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  youtubeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff0000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playIcon: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 2,
  },
  youtubeTextContainer: {
    flex: 1,
  },
  youtubeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  youtubeSubtitle: {
    fontSize: 13,
    color: '#95a5a6',
  },
  arrow: {
    fontSize: 24,
    color: '#bdc3c7',
    marginLeft: 8,
  },
});