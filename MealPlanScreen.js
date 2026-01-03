import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import DebugScreen, { DebugLogger } from './DebugScreen';
import UserCounter from './UserCounter';

const STORAGE_KEYS = {
  USER_PROFILE: '@weekly_dish_user_profile',
  PANTRY_ITEMS: '@weekly_dish_pantry',
  MEAL_PLANS: '@weekly_dish_meal_plans',
  CURRENT_MEAL_PLAN: '@weekly_dish_current_meal_plan',
  MEAL_PLAN_ACCEPTED: '@weekly_dish_meal_plan_accepted',
};

export default function MealPlanScreen({ onBack }) {
  const [userProfile, setUserProfile] = useState(null);
  const [pantryItems, setPantryItems] = useState([]);
  const [currentMealPlan, setCurrentMealPlan] = useState(null);
  const [savedMealPlans, setSavedMealPlans] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [replacingMeal, setReplacingMeal] = useState(false);
  const [shoppingList, setShoppingList] = useState(null);
  const [generatingList, setGeneratingList] = useState(false);
  const [mealPlanAccepted, setMealPlanAccepted] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profile, pantry, mealPlan, savedPlans, savedList, accepted] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.PANTRY_ITEMS),
        AsyncStorage.getItem(STORAGE_KEYS.CURRENT_MEAL_PLAN),
        AsyncStorage.getItem(STORAGE_KEYS.MEAL_PLANS),
        AsyncStorage.getItem('@weekly_dish_shopping_list'),
        AsyncStorage.getItem(STORAGE_KEYS.MEAL_PLAN_ACCEPTED),
      ]);

      if (profile) setUserProfile(JSON.parse(profile));
      if (pantry) setPantryItems(JSON.parse(pantry));
      if (mealPlan) {
        const parsedPlan = JSON.parse(mealPlan);
        // Convert old format if needed
        if (parsedPlan.meal_plan && !parsedPlan.days) {
          const daysArray = [];
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          
          for (let i = 1; i <= 7; i++) {
            const dayKey = `day_${i}`;
            if (parsedPlan.meal_plan[dayKey]) {
              daysArray.push({
                day: dayNames[i - 1],
                meals: parsedPlan.meal_plan[dayKey]
              });
            }
          }
          
          parsedPlan.days = daysArray;
        }
        setCurrentMealPlan(parsedPlan);
      }
      if (savedPlans) setSavedMealPlans(JSON.parse(savedPlans));
      if (savedList) setShoppingList(JSON.parse(savedList));
      if (accepted === 'true') setMealPlanAccepted(true);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateMealPlan = async () => {
    DebugLogger.log('MEAL PLAN BUTTON PRESSED');
    
    if (!userProfile) {
      DebugLogger.log('ERROR: No user profile found!');
      Alert.alert('Error', 'Please complete your profile first');
      return;
    }

    setGenerating(true);
    try {
      DebugLogger.log('Starting generation...', {
        adults: userProfile.adults,
        kids: userProfile.kids,
        budget: userProfile.weeklyBudget,
        pantryCount: pantryItems.length
      });
      
      const mealPlan = await apiService.generateMealPlan(
        userProfile,
        pantryItems,
        {
          startDate: new Date().toISOString(),
          preferences: userProfile.cuisineTypes,
          restrictions: userProfile.dietaryRestrictions,
        }
      );

      DebugLogger.log('Meal plan received', mealPlan);

      // Convert meal_plan format to days array format
      let formattedPlan = mealPlan;
      if (mealPlan.meal_plan && !mealPlan.days) {
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
        
        formattedPlan = {
          ...mealPlan,
          days: daysArray
        };
      }

      // Add timestamp and save
      const planWithMeta = {
        ...formattedPlan,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        weekBudget: userProfile.weeklyBudget,
      };

      console.log('Saving meal plan with metadata:', planWithMeta);
      
      setCurrentMealPlan(planWithMeta);
      await AsyncStorage.setItem(
        STORAGE_KEYS.CURRENT_MEAL_PLAN,
        JSON.stringify(planWithMeta)
      );

      // Add to saved plans
      const allPlans = [planWithMeta, ...savedMealPlans];
      setSavedMealPlans(allPlans);
      await AsyncStorage.setItem(
        STORAGE_KEYS.MEAL_PLANS,
        JSON.stringify(allPlans)
      );

      console.log('Meal plan saved successfully');
      setSelectedDay(0); // Reset to Monday
      setMealPlanAccepted(false); // Reset acceptance status for new plan
      await AsyncStorage.setItem(STORAGE_KEYS.MEAL_PLAN_ACCEPTED, 'false');
      setShoppingList(null); // Clear old shopping list
      
      // Load recipes in background
      const servings = parseInt(userProfile.adults || 2) + parseInt(userProfile.kids || 0);
      console.log('Starting background recipe loading...');
      apiService.loadAllRecipes(mealPlan, servings, userProfile.weeklyBudget)
        .then(() => {
          console.log('Background recipe loading complete');
        })
        .catch(error => {
          console.error('Background recipe loading failed:', error);
        });
      
      Alert.alert(
        'Meal Plan Generated!',
        `Your personalized meal plan is ready! Review it and click "Accept Meal Plan" when you're satisfied.`
      );
    } catch (error) {
      console.error('Error generating meal plan:', error);
      Alert.alert('Error', 'Failed to generate meal plan. Please try again.');
      DebugLogger.log('ERROR generating meal plan', error.message);
    } finally {
      setGenerating(false);
    }
  };

  const replaceMeal = async (dayIndex, mealType, replaceAll = false) => {
    const currentMeal = currentMealPlan.days[dayIndex].meals[mealType.toLowerCase()];
    const dayName = currentMealPlan.days[dayIndex].day;
    
    DebugLogger.log('Replace meal clicked', { 
      dayIndex, 
      dayName, 
      mealType, 
      currentMeal 
    });
    
    // Check if this is meal prep and the same meal appears on other days
    const isMealPrep = userProfile?.prepStyle === 'Weekly Meal Prep';
    const sameMealDays = [];
    
    if (isMealPrep) {
      currentMealPlan.days.forEach((day, idx) => {
        if (day.meals[mealType.toLowerCase()] === currentMeal) {
          sameMealDays.push(idx);
        }
      });
      DebugLogger.log('Found same meal on days:', sameMealDays);
    }
    
    // If meal prep and meal appears multiple times, ask what to replace
    if (isMealPrep && sameMealDays.length > 1 && !replaceAll) {
      Alert.alert(
        'Replace Meal',
        `This ${mealType} appears on ${sameMealDays.length} days. What would you like to replace?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Just ${dayName}`,
            onPress: () => {
              DebugLogger.log('User chose: Just this day', [dayIndex]);
              performReplacement([dayIndex], mealType, currentMeal);
            }
          },
          {
            text: 'All Days',
            onPress: () => {
              DebugLogger.log('User chose: All days', sameMealDays);
              performReplacement(sameMealDays, mealType, currentMeal);
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Replace Meal',
        `Generate a new ${mealType} for ${dayName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            onPress: () => {
              DebugLogger.log('Single day replacement', [dayIndex]);
              performReplacement([dayIndex], mealType, currentMeal);
            }
          }
        ]
      );
    }
  };

  const performReplacement = async (dayIndices, mealType, currentMeal) => {
    setReplacingMeal(true);
    try {
      console.log('performReplacement called');
      DebugLogger.log('Starting replacement for days:', dayIndices);
      DebugLogger.log('Meal type:', mealType);
      DebugLogger.log('Current meal to replace:', currentMeal);
      
      // Get the current plan from state right now
      const planSnapshot = JSON.parse(JSON.stringify(currentMealPlan));
      DebugLogger.log('Current plan snapshot:', planSnapshot);
      
      console.log('Calling apiService.generateReplacementMeal with:', {
        userProfile,
        mealType,
        day: planSnapshot.days[dayIndices[0]].day,
        currentMeal
      });
      
      // Call API to generate new meal
      const newMealName = await apiService.generateReplacementMeal(
        userProfile,
        mealType,
        planSnapshot.days[dayIndices[0]].day,
        currentMeal
      );
      
      DebugLogger.log('Got new meal from API:', newMealName);
      DebugLogger.log('Type of newMealName:', typeof newMealName);
      
      // Make sure we have a valid meal name
      console.log('Received meal name:', newMealName);
      console.log('Meal name type:', typeof newMealName);
      
      if (!newMealName || (typeof newMealName === 'string' && newMealName.trim() === '')) {
        console.error('Invalid meal name received:', newMealName);
        throw new Error('No meal name received from API');
      }
      
      // Update the plan with the new meal
      const updatedPlan = {
        ...planSnapshot,
        days: planSnapshot.days.map((day, idx) => {
          if (dayIndices.includes(idx)) {
            const mealKey = mealType.toLowerCase();
            DebugLogger.log(`Updating day ${idx} ${day.day} - ${mealKey}: "${newMealName}"`);
            
            const updatedDay = {
              ...day,
              meals: {
                ...day.meals,
                [mealKey]: newMealName
              }
            };
            
            DebugLogger.log(`Day ${idx} meals after update:`, updatedDay.meals);
            return updatedDay;
          }
          return day;
        })
      };
      
      DebugLogger.log('Full updated plan:', JSON.stringify(updatedPlan));
      
      // Update state - this should trigger re-render
      setCurrentMealPlan(updatedPlan);
      
      // Save to storage
      await AsyncStorage.setItem(
        STORAGE_KEYS.CURRENT_MEAL_PLAN,
        JSON.stringify(updatedPlan)
      );
      
      DebugLogger.log('Meal replaced successfully - state updated');
      
      // Mark plan as not accepted since it was modified
      setMealPlanAccepted(false);
      await AsyncStorage.setItem(STORAGE_KEYS.MEAL_PLAN_ACCEPTED, 'false');
      setShoppingList(null); // Clear shopping list since plan changed
      
      // Show success message
      Alert.alert('Success', `${mealType} has been replaced! Click "Accept Meal Plan" when you're done making changes.`);
    } catch (error) {
      console.error('Error in performReplacement:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      DebugLogger.log('Error replacing meal:', error.message);
      Alert.alert('Error', 'Failed to generate replacement meal. Please try again.');
    } finally {
      setReplacingMeal(false);
    }
  };

  const renderMealCard = (meal, mealType, dayIndex) => {
    if (!meal) return null;
    
    const mealName = typeof meal === 'string' ? meal : meal.name;
    
    return (
      <View style={styles.mealCard}>
        <View style={styles.mealHeader}>
          <Text style={styles.mealType}>{mealType}</Text>
          <TouchableOpacity 
            style={[styles.replaceButton, replacingMeal && styles.disabledButton]}
            onPress={() => replaceMeal(dayIndex, mealType)}
            disabled={replacingMeal}
          >
            <Text style={styles.replaceButtonText}>
              {replacingMeal ? 'Replacing Meal...' : 'Replace Meal'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.mealName}>{mealName}</Text>
      </View>
    );
  };

  const renderDay = () => {
    console.log('Rendering day, currentMealPlan:', currentMealPlan);
    console.log('Selected day index:', selectedDay);
    
    if (!currentMealPlan || !currentMealPlan.days) {
      console.log('No meal plan or days found');
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No meals planned for this day yet.</Text>
        </View>
      );
    }
    
    const day = currentMealPlan.days[selectedDay];
    console.log('Day data:', day);
    
    if (!day) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No meals planned for this day.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.dayContainer}>
        <Text style={styles.dayTitle}>{day.day}</Text>
        {day.meals && day.meals.breakfast && renderMealCard(day.meals.breakfast, 'Breakfast', selectedDay)}
        {day.meals && day.meals.lunch && renderMealCard(day.meals.lunch, 'Lunch', selectedDay)}
        {day.meals && day.meals.dinner && renderMealCard(day.meals.dinner, 'Dinner', selectedDay)}
        {day.meals && day.meals.snacks && day.meals.snacks.length > 0 && (
          <View style={styles.snackCard}>
            <Text style={styles.snackTitle}>Snacks</Text>
            {day.meals.snacks.map((snack, index) => (
              <Text key={index} style={styles.snackItem}>• {snack}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const acceptMealPlan = async () => {
    if (!currentMealPlan) {
      Alert.alert('Error', 'No meal plan to accept');
      return;
    }
    
    setGeneratingList(true);
    Alert.alert(
      'Generating Shopping List', 
      'This may take up to 5 minutes. Please be patient while we create your detailed shopping list...'
    );
    
    try {
      DebugLogger.log('Accepting meal plan and generating shopping list...');
      
      const list = await apiService.generateShoppingList(
        currentMealPlan,
        pantryItems,
        userProfile.weeklyBudget
      );
      
      DebugLogger.log('Shopping list generated:', list);
      setShoppingList(list);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(
        '@weekly_dish_shopping_list',
        JSON.stringify(list)
      );
      
      setMealPlanAccepted(true);
      await AsyncStorage.setItem(STORAGE_KEYS.MEAL_PLAN_ACCEPTED, 'true');
      
      Alert.alert('Success', 'Meal plan accepted and shopping list generated!');
    } catch (error) {
      console.error('Error generating shopping list:', error);
      if (error.name === 'AbortError') {
        Alert.alert('Timeout', 'Shopping list generation took too long. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to generate shopping list. Please try again.');
      }
    } finally {
      setGeneratingList(false);
    }
  };

  const renderShoppingList = () => {
    if (!shoppingList) {
      return (
        <ScrollView style={styles.shoppingContainer}>
          <Text style={styles.sectionTitle}>Shopping List</Text>
          
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No shopping list yet</Text>
            <Text style={styles.emptySubtext}>
              A shopping list will be automatically generated when you create a meal plan
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.shoppingContainer}>
        <View style={styles.shoppingHeader}>
          <Text style={styles.sectionTitle}>Shopping List</Text>
          <TouchableOpacity 
            style={styles.regenerateButton}
            onPress={acceptMealPlan}
            disabled={generatingList}
          >
            <Text style={styles.regenerateText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
        
        {shoppingList.sections?.map((section, index) => {
          console.log(`Rendering section ${section.category}, items:`, section.items);
          return (
          <View key={index} style={styles.itemSection}>
            <Text style={styles.itemSectionTitle}>{section.category}</Text>
            {section.items?.map((item, itemIndex) => {
              console.log(`Item ${itemIndex}:`, item);
              return (
              <View key={itemIndex} style={styles.shoppingItem}>
                <Text style={styles.itemName}>
                  {item.quantity || item.amount || ''} {item.unit || ''} {item.name || item.item || item.description || 'Unknown item'}
                </Text>
                <Text style={styles.itemPrice}>
                  ${(() => {
                    let price = item.price || item.estimatedPrice || item.cost || 0;
                    // Handle string prices like "$11.97"
                    if (typeof price === 'string') {
                      price = parseFloat(price.replace('$', '').replace(',', ''));
                    }
                    return !isNaN(price) && price > 0 ? price.toFixed(2) : '0.00';
                  })()}
                </Text>
              </View>
              );
            })}
          </View>
          );
        })}
        
        <View style={styles.totalSection}>
          <Text style={styles.totalText}>
            Total: ${(() => {
              // First try to calculate from individual items
              let calculatedTotal = 0;
              if (shoppingList.sections && shoppingList.sections.length > 0) {
                shoppingList.sections.forEach(section => {
                  if (section.items) {
                    section.items.forEach(item => {
                      let itemPrice = item.price || item.estimatedPrice || item.cost || 0;
                      if (typeof itemPrice === 'string') {
                        itemPrice = parseFloat(itemPrice.replace('$', '').replace(',', ''));
                      }
                      if (!isNaN(itemPrice)) {
                        calculatedTotal += itemPrice;
                      }
                    });
                  }
                });
              }
              
              // Use calculated total if we have it, otherwise fall back to provided total
              if (calculatedTotal > 0) {
                console.log('Using calculated total:', calculatedTotal);
                return calculatedTotal.toFixed(2);
              }
              
              // Fall back to provided total
              let total = shoppingList.totalCost || shoppingList.totalEstimatedCost || shoppingList.totals?.estimatedCost || shoppingList.totals?.estimatedTotal || 0;
              if (typeof total === 'string') {
                total = parseFloat(total.replace('$', '').replace(',', ''));
              }
              return !isNaN(total) && total > 0 ? total.toFixed(2) : '0.00';
            })()}
          </Text>
          <Text style={styles.budgetText}>
            Budget: ${userProfile.weeklyBudget}
          </Text>
          {(() => {
            // Calculate total from items
            let calculatedTotal = 0;
            if (shoppingList.sections && shoppingList.sections.length > 0) {
              shoppingList.sections.forEach(section => {
                if (section.items) {
                  section.items.forEach(item => {
                    let itemPrice = item.price || item.estimatedPrice || item.cost || 0;
                    if (typeof itemPrice === 'string') {
                      itemPrice = parseFloat(itemPrice.replace('$', '').replace(',', ''));
                    }
                    if (!isNaN(itemPrice)) {
                      calculatedTotal += itemPrice;
                    }
                  });
                }
              });
            }
            
            // Use calculated total or fall back
            let total = calculatedTotal > 0 ? calculatedTotal : 0;
            if (total === 0) {
              let providedTotal = shoppingList.totalCost || shoppingList.totalEstimatedCost || shoppingList.totals?.estimatedCost || 0;
              if (typeof providedTotal === 'string') {
                providedTotal = parseFloat(providedTotal.replace('$', '').replace(',', ''));
              }
              total = providedTotal;
            }
            
            const budget = parseFloat(userProfile.weeklyBudget);
            const isUnderBudget = total <= budget;
            const difference = Math.abs(budget - total);
            
            return (
              <Text style={[styles.budgetStatus, isUnderBudget ? styles.underBudget : styles.overBudget]}>
                {isUnderBudget ? `✓ Within Budget ($${difference.toFixed(2)} under)` : `⚠ Over Budget ($${difference.toFixed(2)} over)`}
              </Text>
            );
          })()}
        </View>
        
        {shoppingList.savingTips && (
          <View style={styles.savingTips}>
            <Text style={styles.savingTitle}>Money-Saving Tips:</Text>
            {typeof shoppingList.savingTips === 'string' ? (
              <Text style={styles.savingText}>{shoppingList.savingTips}</Text>
            ) : (
              Object.values(shoppingList.savingTips).map((tip, index) => (
                <Text key={index} style={styles.savingText}>• {tip}</Text>
              ))
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <UserCounter />
      <DebugScreen />
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      
      <Text style={styles.title}>Weekly Meal Plan</Text>
      <Text style={styles.subtitle}>
        {userProfile?.adults || 0} adults, {userProfile?.kids || 0} kids • 
        ${userProfile?.weeklyBudget || 0}/week budget
      </Text>

      <TouchableOpacity
        style={[styles.generateButton, generating && styles.disabledButton]}
        onPress={generateMealPlan}
        disabled={generating}
      >
        {generating ? (
          <View style={styles.generatingContainer}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.generatingText}>Generating your personalized meal plan...</Text>
            <Text style={styles.generatingSubtext}>This may take 1-2 minutes</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Generate New Meal Plan</Text>
        )}
      </TouchableOpacity>

      {currentMealPlan ? (
        <>
          <View style={styles.planActions}>
            {!mealPlanAccepted && (
              <TouchableOpacity
                style={[styles.acceptButton, generatingList && styles.disabledButton]}
                onPress={acceptMealPlan}
                disabled={generatingList}
              >
                {generatingList ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept Meal Plan</Text>
                )}
              </TouchableOpacity>
            )}
            
            {mealPlanAccepted && (
              <View style={styles.acceptedBadge}>
                <Text style={styles.acceptedText}>✓ Plan Accepted</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.deletePlanButton}
              onPress={() => {
                Alert.alert(
                  'Delete Meal Plan',
                  'Are you sure you want to delete this meal plan?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        setCurrentMealPlan(null);
                        setShoppingList(null);
                        setMealPlanAccepted(false);
                        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_MEAL_PLAN);
                        await AsyncStorage.removeItem('@weekly_dish_shopping_list');
                        await AsyncStorage.removeItem(STORAGE_KEYS.MEAL_PLAN_ACCEPTED);
                        DebugLogger.log('Meal plan deleted');
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.deletePlanText}>Delete Plan</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.daySelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    selectedDay === index && styles.selectedDayButton
                  ]}
                  onPress={() => setSelectedDay(index)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    selectedDay === index && styles.selectedDayText
                  ]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.contentTabs}>
            <TouchableOpacity
              style={[styles.tab, selectedDay < 7 && styles.activeTab]}
              onPress={() => setSelectedDay(0)}
            >
              <Text style={styles.tabText}>Meals</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedDay === 7 && styles.activeTab]}
              onPress={() => setSelectedDay(7)}
            >
              <Text style={styles.tabText}>Shopping List</Text>
            </TouchableOpacity>
          </View>

          {selectedDay < 7 ? renderDay() : renderShoppingList()}
          
          {replacingMeal && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Generating new meal...</Text>
              </View>
            </View>
          )}

          {currentMealPlan.prepInstructions && (
            <View style={styles.prepTips}>
              <Text style={styles.prepTitle}>Meal Prep Tips:</Text>
              <Text style={styles.prepText}>{currentMealPlan.prepInstructions}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No meal plan yet. Generate one to get started!
          </Text>
          <Text style={styles.emptySubtext}>
            We'll create a personalized meal plan based on your budget, 
            preferences, and what's in your pantry.
          </Text>
        </View>
      )}
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
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  daySelector: {
    marginBottom: 15,
  },
  dayButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  selectedDayButton: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  dayButtonText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  contentTabs: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  tab: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ecf0f1',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  dayContainer: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  mealCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
  },
  snackCard: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
  },
  snackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f57c00',
    marginBottom: 10,
  },
  snackItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    paddingLeft: 10,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  mealType: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  replaceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replaceButtonText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  mealName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  viewRecipeButton: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 6,
    alignItems: 'center',
  },
  viewRecipeText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: 'bold',
  },
  shoppingContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  itemSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  itemSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
  },
  shoppingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  itemName: {
    fontSize: 14,
    color: '#34495e',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  totalSection: {
    backgroundColor: '#2c3e50',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  budgetText: {
    fontSize: 14,
    color: '#ecf0f1',
  },
  prepTips: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  prepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 5,
  },
  prepText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
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
    lineHeight: 20,
  },
  generateShoppingButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  generateShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  deletePlanButton: {
    backgroundColor: '#e74c3c',
    padding: 10,
    borderRadius: 6,
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  deletePlanText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  generatingContainer: {
    alignItems: 'center',
  },
  generatingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
  generatingSubtext: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#2c3e50',
  },
  shoppingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  regenerateButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#3498db',
    borderRadius: 6,
  },
  regenerateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  budgetStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
  },
  underBudget: {
    color: '#27ae60',
  },
  overBudget: {
    color: '#e74c3c',
  },
  savingTips: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  savingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 5,
  },
  savingText: {
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20,
  },
  planActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  acceptButton: {
    backgroundColor: '#27ae60',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  acceptedBadge: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  acceptedText: {
    color: '#27ae60',
    fontSize: 16,
    fontWeight: 'bold',
  },
});