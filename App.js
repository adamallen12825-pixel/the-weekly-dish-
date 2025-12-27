import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image, Platform, KeyboardAvoidingView, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClerkProvider, SignedIn, SignedOut, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import AuthScreen from './AuthScreen';
import PantryScreen from './PantryScreen';
import PantrySetupScreen from './PantrySetupScreen';
import MealPlanScreen from './MealPlanScreen';
import RecipesScreen from './RecipesScreen';
import ShoppingListScreen from './ShoppingListScreen';
import QuickMealScreen from './QuickMealScreen';
import { CustomNumberPicker, AgeInputGroup } from './CustomNumberPicker';
import { API_URL, APP_SCHEME } from './config';

const STORAGE_KEYS = {
  USER_PROFILE: '@weekly_dish_user_profile',
  ONBOARDING_COMPLETE: '@weekly_dish_onboarding_complete',
  PANTRY_SETUP_COMPLETE: '@weekly_dish_pantry_setup_complete',
  PANTRY_ITEMS: '@weekly_dish_pantry',
  MEAL_PLANS: '@weekly_dish_meal_plans',
  AUTH_TOKEN: '@weekly_dish_auth_token',
  USER_DATA: '@weekly_dish_user_data',
};

const USER_PERSONAS = [
  { id: 'survival', name: 'Survival Mode', budget: 20, description: 'Ultra-budget focused' },
  { id: 'healthy', name: 'Healthy Balance', budget: 50, description: 'Nutrition on a budget' },
  { id: 'quick', name: 'Quick & Easy', budget: 75, description: 'Time-saving meals' },
  { id: 'gourmet', name: 'Gourmet Explorer', budget: 100, description: 'Culinary adventures' },
];

const CLERK_PUBLISHABLE_KEY = 'pk_test_bHVja3ktd2FsbGFieS0yMS5jbGVyay5hY2NvdW50cy5kZXYk';

const tokenCache = {
  async getToken(key) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

function MainApp() {
  const { isSignedIn, isLoaded, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [isPantrySetup, setIsPantrySetup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [userProfile, setUserProfile] = useState({
    adults: '1',
    kids: '0',
    kidAges: [],
    weeklyBudget: '',
    cookingTools: [],
    skillLevel: '',
    mealDifficulty: '',
    prepStyle: '',
    cuisineTypes: [],
    dietaryRestrictions: '',
    dietType: '',
    customDiet: '',
    foodGoals: [],
    mealTypes: [],
    snackTypes: [],
  });

  useEffect(() => {
    if (isLoaded) {
      setIsAuthenticated(isSignedIn);
      if (isSignedIn && user) {
        checkSubscriptionStatus();
        checkAuthAndLoadData();
      } else {
        setIsLoading(false);
      }
    }
  }, [isLoaded, isSignedIn, user]);

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/payments/subscription-status/${user.id}`);
      const data = await response.json();
      setHasSubscription(data.hasActiveSubscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasSubscription(false);
    }
  };

  useEffect(() => {
    setupDeepLinking();
  }, []);

  const setupDeepLinking = () => {
    // Handle deep links
    Linking.addEventListener('url', handleDeepLink);
    
    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      Linking.removeAllListeners('url');
    };
  };

  const handleDeepLink = async (event) => {
    const url = event.url;
    // Clerk handles auth redirects internally
    console.log('Deep link received:', url);
  };

  const checkAuthAndLoadData = async () => {
    try {
      await loadUserData();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      // Check if user has completed onboarding
      const onboardingComplete = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
      const savedProfile = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      
      if (onboardingComplete === 'true' && savedProfile) {
        // User has already set up, load their profile
        setUserProfile(JSON.parse(savedProfile));
        setIsOnboarding(false);
      } else {
        // New user, show onboarding
        setIsOnboarding(true);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setIsOnboarding(true); // Show onboarding on error
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!userProfile.adults || !userProfile.weeklyBudget || !userProfile.skillLevel) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
      setIsOnboarding(false);
      setIsPantrySetup(true); // Show pantry setup after onboarding
    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Error', 'Failed to save your information');
    }
  };

  const resetApp = async () => {
    try {
      await AsyncStorage.clear();
      setIsOnboarding(true);
      setUserProfile({
        adults: '1',
        kids: '0',
        kidAges: [],
        weeklyBudget: '',
        cookingTools: [],
        skillLevel: '',
        mealDifficulty: '',
        prepStyle: '',
        cuisineTypes: [],
        dietaryRestrictions: '',
        dietType: '',
        customDiet: '',
        foodGoals: [],
        mealTypes: [],
        snackTypes: [],
      });
      setCurrentScreen('home');
    } catch (error) {
      console.error('Error resetting app:', error);
    }
  };

  const completePantrySetup = () => {
    setIsPantrySetup(false);
    setCurrentScreen('home');
  };

  const skipPantrySetup = () => {
    setIsPantrySetup(false);
    setCurrentScreen('home');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <Text>Loading...</Text>
      </View>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen setIsAuthenticated={setIsAuthenticated} />;
  }

  // Show subscription prompt if authenticated but no subscription
  if (isAuthenticated && !hasSubscription && !isLoading) {
    return (
      <View style={styles.container}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>Welcome to The Weekly Dish!</Text>
        <Text style={styles.subtitle}>Start your 7-day free trial to access all features</Text>
        
        <View style={styles.subscriptionCard}>
          <Text style={styles.subscriptionTitle}>Premium Features:</Text>
          <Text style={styles.feature}>✓ Smart Meal Planning</Text>
          <Text style={styles.feature}>✓ Smart Shopping Lists</Text>
          <Text style={styles.feature}>✓ Pantry Management</Text>
          <Text style={styles.feature}>✓ Budget Optimization</Text>
          <Text style={styles.feature}>✓ Recipe Storage</Text>
          
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => Linking.openURL('https://theweekly-dish.com/subscribe')}
          >
            <Text style={styles.buttonText}>Start Free Trial</Text>
          </TouchableOpacity>
          
          <Text style={styles.priceText}>$9.99/month after trial</Text>
        </View>
      </View>
    );
  }

  if (isOnboarding) {
    const tools = ['Stove', 'Oven', 'Microwave', 'Air Fryer', 'Instant Pot', 'Slow Cooker', 'Grill'];
    const cuisines = ['Italian', 'Mexican', 'Greek', 'Southern', 'Asian', 'American', 'Mediterranean', 'Indian'];
    const goals = ['Extra Healthy', 'Weight Loss', 'Muscle Gain', 'High Protein', 'Low Carb', 'Balanced', 'Budget Friendly'];
    const meals = ['Breakfast', 'Lunch', 'Dinner'];
    const snacks = ['Homemade Snacks', 'Store-Bought Snacks', 'Healthy Snacks', 'Desserts'];

    return (
      <ScrollView contentContainerStyle={[styles.scrollContainer, {paddingBottom: 100}]}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>Welcome to The Weekly Dish</Text>
        <Text style={styles.subtitle}>Let's set up your meal planning profile</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Adults</Text>
          <CustomNumberPicker
            value={userProfile.adults}
            onChange={(value) => setUserProfile({...userProfile, adults: value})}
            min={1}
            max={100}
            label="Adults"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Kids</Text>
          <CustomNumberPicker
            value={userProfile.kids}
            onChange={(value) => setUserProfile({...userProfile, kids: value})}
            min={0}
            max={100}
            label="Kids"
          />
        </View>

        <AgeInputGroup
          count={parseInt(userProfile.kids)}
          ages={userProfile.kidAges}
          onChange={(ages) => setUserProfile({...userProfile, kidAges: ages})}
          label="Kid"
          maxAge={18}
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weekly Food Budget ($)</Text>
          <TextInput
            style={styles.input}
            value={userProfile.weeklyBudget}
            onChangeText={(text) => setUserProfile({...userProfile, weeklyBudget: text})}
            keyboardType="numeric"
            placeholder="e.g., 100"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cooking Tools Available</Text>
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool}
              style={[styles.checkboxRow, userProfile.cookingTools.includes(tool) && styles.checkboxSelected]}
              onPress={() => {
                const updatedTools = userProfile.cookingTools.includes(tool)
                  ? userProfile.cookingTools.filter(t => t !== tool)
                  : [...userProfile.cookingTools, tool];
                setUserProfile({...userProfile, cookingTools: updatedTools});
              }}
            >
              <Text>{userProfile.cookingTools.includes(tool) ? '✓ ' : '○ '}{tool}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cooking Skill Level</Text>
          {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.radioRow, userProfile.skillLevel === level && styles.radioSelected]}
              onPress={() => setUserProfile({...userProfile, skillLevel: level})}
            >
              <Text>{userProfile.skillLevel === level ? '● ' : '○ '}{level}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meal Difficulty Preference</Text>
          {['Easy (5-10 min)', 'Medium (15-30 min)', 'Complex (30+ min)'].map((diff) => (
            <TouchableOpacity
              key={diff}
              style={[styles.radioRow, userProfile.mealDifficulty === diff && styles.radioSelected]}
              onPress={() => setUserProfile({...userProfile, mealDifficulty: diff})}
            >
              <Text>{userProfile.mealDifficulty === diff ? '● ' : '○ '}{diff}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Meal Prep Style</Text>
          {['Cook Every Meal', 'Cook Once Daily', 'Weekly Meal Prep'].map((style) => (
            <TouchableOpacity
              key={style}
              style={[styles.radioRow, userProfile.prepStyle === style && styles.radioSelected]}
              onPress={() => setUserProfile({...userProfile, prepStyle: style})}
            >
              <Text>{userProfile.prepStyle === style ? '● ' : '○ '}{style}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cuisine Preferences</Text>
          {cuisines.map((cuisine) => (
            <TouchableOpacity
              key={cuisine}
              style={[styles.checkboxRow, userProfile.cuisineTypes.includes(cuisine) && styles.checkboxSelected]}
              onPress={() => {
                const updated = userProfile.cuisineTypes.includes(cuisine)
                  ? userProfile.cuisineTypes.filter(c => c !== cuisine)
                  : [...userProfile.cuisineTypes, cuisine];
                setUserProfile({...userProfile, cuisineTypes: updated});
              }}
            >
              <Text>{userProfile.cuisineTypes.includes(cuisine) ? '✓ ' : '○ '}{cuisine}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diet Type</Text>
          {['None', 'Keto', 'Paleo', 'Carnivore', 'Mediterranean', 'Vegan', 'Vegetarian', 'Whole30', 'Low FODMAP', 'Gluten-Free', 'Dairy-Free', 'Other'].map((diet) => (
            <TouchableOpacity
              key={diet}
              style={[styles.radioRow, userProfile.dietType === diet && styles.radioSelected]}
              onPress={() => setUserProfile({...userProfile, dietType: diet, customDiet: diet === 'Other' ? userProfile.customDiet : ''})}
            >
              <Text>{userProfile.dietType === diet ? '● ' : '○ '}{diet}</Text>
            </TouchableOpacity>
          ))}
          {userProfile.dietType === 'Other' && (
            <TextInput
              style={[styles.input, {marginTop: 10}]}
              value={userProfile.customDiet}
              onChangeText={(text) => setUserProfile({...userProfile, customDiet: text})}
              placeholder="Enter your diet type (e.g., Pescatarian, DASH, etc.)"
            />
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dietary Restrictions/Allergies</Text>
          <TextInput
            style={styles.input}
            value={userProfile.dietaryRestrictions}
            onChangeText={(text) => setUserProfile({...userProfile, dietaryRestrictions: text})}
            placeholder="e.g., no peanuts, shellfish allergy, lactose intolerant"
            multiline
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Food Goals (select all that apply)</Text>
          {goals.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[styles.checkboxRow, userProfile.foodGoals.includes(goal) && styles.checkboxSelected]}
              onPress={() => {
                const updated = userProfile.foodGoals.includes(goal)
                  ? userProfile.foodGoals.filter(g => g !== goal)
                  : [...userProfile.foodGoals, goal];
                setUserProfile({...userProfile, foodGoals: updated});
              }}
            >
              <Text>{userProfile.foodGoals.includes(goal) ? '✓ ' : '○ '}{goal}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>What Meals to Plan</Text>
          {meals.map((meal) => (
            <TouchableOpacity
              key={meal}
              style={[styles.checkboxRow, userProfile.mealTypes.includes(meal) && styles.checkboxSelected]}
              onPress={() => {
                const updated = userProfile.mealTypes.includes(meal)
                  ? userProfile.mealTypes.filter(m => m !== meal)
                  : [...userProfile.mealTypes, meal];
                setUserProfile({...userProfile, mealTypes: updated});
              }}
            >
              <Text>{userProfile.mealTypes.includes(meal) ? '✓ ' : '○ '}{meal}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Snack Preferences (select all that apply)</Text>
          {snacks.map((snack) => (
            <TouchableOpacity
              key={snack}
              style={[styles.checkboxRow, userProfile.snackTypes.includes(snack) && styles.checkboxSelected]}
              onPress={() => {
                const updated = userProfile.snackTypes.includes(snack)
                  ? userProfile.snackTypes.filter(s => s !== snack)
                  : [...userProfile.snackTypes, snack];
                setUserProfile({...userProfile, snackTypes: updated});
              }}
            >
              <Text>{userProfile.snackTypes.includes(snack) ? '✓ ' : '○ '}{snack}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={completeOnboarding}>
          <Text style={styles.buttonText}>Start Meal Planning</Text>
        </TouchableOpacity>
        
        <StatusBar style="auto" />
      </ScrollView>
    );
  }

  if (isPantrySetup) {
    return (
      <PantrySetupScreen 
        onComplete={completePantrySetup}
        onSkip={skipPantrySetup}
      />
    );
  }

  const renderMainApp = () => {
    switch(currentScreen) {
      case 'home':
        return (
          <View style={styles.mainContainer}>
            <Image source={require('./assets/logo.png')} style={styles.logoSmall} />
            <Text style={styles.welcomeText}>
              Welcome back! {parseInt(userProfile.adults || 0) + parseInt(userProfile.kids || 0)} people, ${userProfile.weeklyBudget}/week
            </Text>
            
            <View style={styles.menuGrid}>
              <TouchableOpacity 
                style={styles.menuCard}
                onPress={() => setCurrentScreen('mealPlan')}
              >
                <Text style={styles.menuCardTitle}>📅 Meal Plans</Text>
                <Text style={styles.menuCardDescription}>Generate weekly meal plans</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuCard}
                onPress={() => setCurrentScreen('pantry')}
              >
                <Text style={styles.menuCardTitle}>🏠 My Pantry</Text>
                <Text style={styles.menuCardDescription}>Track what you have</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuCard}
                onPress={() => setCurrentScreen('shopping')}
              >
                <Text style={styles.menuCardTitle}>🛒 Shopping List</Text>
                <Text style={styles.menuCardDescription}>Ready to checkout</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuCard}
                onPress={() => setCurrentScreen('recipes')}
              >
                <Text style={styles.menuCardTitle}>📖 Recipes</Text>
                <Text style={styles.menuCardDescription}>Browse saved recipes</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.pantryMealButton}
              onPress={() => setCurrentScreen('quickMeal')}
            >
              <Text style={styles.pantryMealButtonText}>🍳 Use What's in My Pantry</Text>
              <Text style={styles.pantryMealSubtext}>Get a quick meal idea from your current ingredients</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => setCurrentScreen('settings')}
            >
              <Text style={styles.settingsButtonText}>⚙️ Settings</Text>
            </TouchableOpacity>
          </View>
        );

      case 'mealPlan':
        return <MealPlanScreen onBack={() => setCurrentScreen('home')} />;

      case 'pantry':
        return <PantryScreen onBack={() => setCurrentScreen('home')} />;

      case 'shopping':
        return <ShoppingListScreen onBack={() => setCurrentScreen('home')} />;

      case 'recipes':
        return <RecipesScreen onBack={() => setCurrentScreen('home')} />;

      case 'quickMeal':
        return <QuickMealScreen onBack={() => setCurrentScreen('home')} userProfile={userProfile} />;

      case 'settings':
        return (
          <View style={styles.mainContainer}>
            <TouchableOpacity onPress={() => setCurrentScreen('home')}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Settings</Text>
            
            <View style={styles.settingsSection}>
              <Text style={styles.settingsLabel}>Profile</Text>
              <Text>Adults: {userProfile.adults} | Kids: {userProfile.kids}</Text>
              <Text>Weekly Budget: ${userProfile.weeklyBudget}</Text>
              <Text>Skill Level: {userProfile.skillLevel}</Text>
              <Text>Prep Style: {userProfile.prepStyle}</Text>
              <Text>Goals: {userProfile.foodGoals}</Text>
              {userProfile.dietType && userProfile.dietType !== 'None' ? (
                <Text>Diet: {userProfile.dietType === 'Other' ? userProfile.customDiet : userProfile.dietType}</Text>
              ) : null}
              {userProfile.dietaryRestrictions ? (
                <Text>Restrictions: {userProfile.dietaryRestrictions}</Text>
              ) : null}
            </View>

            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={() => setIsOnboarding(true)}
            >
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} onPress={resetApp}>
              <Text style={styles.buttonText}>Reset App (Clear All Data)</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderMainApp()}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <MainApp />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 50,
  },
  scrollContainer: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 50,
  },
  mainContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  personaCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ecf0f1',
  },
  selectedPersona: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  personaName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  personaDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  personaBudget: {
    fontSize: 14,
    color: '#27ae60',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '48%',
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  menuCardDescription: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  pantryMealButton: {
    backgroundColor: '#f39c12',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  pantryMealButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  pantryMealSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  settingsButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  settingsButtonText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    marginBottom: 20,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  settingsSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  settingsLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  feature: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 10,
  },
  logoSmall: {
    width: 100,
    height: 100,
    marginBottom: 15,
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  checkboxRow: {
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  checkboxSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  radioRow: {
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  radioSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderColor: '#bdc3c7',
    borderRadius: 8,
    minHeight: 50,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderColor: '#bdc3c7',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    maxHeight: 250,
  },
});