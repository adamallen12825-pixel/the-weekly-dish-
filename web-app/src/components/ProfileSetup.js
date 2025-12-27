import React, { useState, useEffect } from 'react';
import { getCloudStorage, setCloudStorage } from '../utils/cloudStorage';
import kvService from '../services/kvService';
import './ProfileSetup.css';

function ProfileSetup({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Load saved profile or use defaults
  const getInitialProfile = () => {
    const defaultProfile = {
      adults: 1,
      kids: 0,
      kidAges: [],
      weeklyBudget: 100,
      stickToBudget: false,  // New field - when true, use full budget amount
      zipCode: '',
      cookingTools: [],
      skillLevel: 'Intermediate',
      mealDifficulty: 'Medium (15-30 min)',
      dietType: 'None',
      customDiet: '',
      cuisineTypes: [],
      customCuisines: '',
      dietaryRestrictions: '',
      dislikedFoods: [],
      customDislikedFoods: '',
      foodGoals: [],
      mealTypes: ['Breakfast', 'Lunch', 'Dinner'],
      snackTypes: [],
      prepStyle: 'Cook Every Meal',
      dairyPreferences: {
        milk: 'Whole Milk',
        eggs: 'Large White Eggs'
      },
      nutritionalTargets: {
        trackNutrition: false,
        dailyCalories: 2000,
        dailyProtein: 50,
        dailyCarbs: 300,
        dailyFat: 65,
        dailyFiber: 25,
        dailySugar: 50,
        dailySodium: 2300,
        dailyCholesterol: 300
      }
    };
    
    // Don't load from localStorage - we'll load from cloud in useEffect
    return defaultProfile;
  };
  
  const [profile, setProfile] = useState(getInitialProfile());
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showNutritionCalculator, setShowNutritionCalculator] = useState(false);
  const [nutritionCalc, setNutritionCalc] = useState({
    age: 30,
    gender: 'male',
    weight: 170,
    heightFeet: 5,
    heightInches: 10,
    activityLevel: 'moderate',
    goal: 'maintain'
  });

  // Check if we're in update mode (coming from dashboard)
  const isUpdateMode = window.location.pathname === '/profile-update';

  // Load existing profile from cloud on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        try {
          
          const cloudProfile = await kvService.get(user.id, 'profile');
          if (cloudProfile) {
            // Merge cloud profile with defaults to ensure all fields exist
            const mergedProfile = {
              ...getInitialProfile(), // Start with defaults
              ...cloudProfile, // Override with cloud data
              // Ensure arrays are always arrays
              kidAges: cloudProfile.kidAges || [],
              cookingTools: cloudProfile.cookingTools || [],
              cuisineTypes: cloudProfile.cuisineTypes || [],
              dislikedFoods: cloudProfile.dislikedFoods || [],
              foodGoals: cloudProfile.foodGoals || [],
              mealTypes: cloudProfile.mealTypes || ['Breakfast', 'Lunch', 'Dinner'],
              snackTypes: cloudProfile.snackTypes || [],
              dairyPreferences: {
                milk: 'Whole Milk',
                eggs: 'Large White Eggs',
                ...(cloudProfile.dairyPreferences || {})
              },
              nutritionalTargets: {
                ...getInitialProfile().nutritionalTargets,
                ...(cloudProfile.nutritionalTargets || {})
              }
            };
            setProfile(mergedProfile);
            setIsExistingProfile(true);
            console.log('Loaded existing profile from cloud with dietType:', mergedProfile.dietType);
          }
          setProfileLoaded(true);
        } catch (error) {
          console.error('Error loading profile:', error);
          setProfileLoaded(true);
        }
      }
    };
    loadProfile();
  }, [user]);

  // NO AUTO-SAVE - Profile only saves when user clicks save button

  // Remove any old localStorage data (clean up all profile data from localStorage)
  useEffect(() => {
    // Clean up any old non-user-specific data AND user-specific localStorage
    const legacyKeys = ['userProfile', 'pantryItems', 'mealPlan', 'shoppingList', 'recipes'];
    legacyKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`Removed legacy localStorage key: ${key}`);
      }
    });
    
    // Also remove user-specific localStorage profile data
    if (user) {
      const userProfileKey = `${user.id}_userProfile`;
      if (localStorage.getItem(userProfileKey)) {
        localStorage.removeItem(userProfileKey);
        console.log(`Removed user-specific localStorage profile: ${userProfileKey}`);
      }
    }
  }, [user]); // Run when user changes

  // Removed auto-save to prevent conflicts during setup

  const tools = ['Stove', 'Oven', 'Microwave', 'Air Fryer', 'Instant Pot', 'Slow Cooker', 'Grill'];
  const cuisines = ['Italian', 'Mexican', 'Greek', 'Southern', 'Asian', 'American', 'Mediterranean', 'Indian'];
  const dietTypes = ['None', 'Keto', 'Paleo', 'Carnivore', 'Mediterranean', 'Vegan', 'Vegetarian', 'Whole30', 'Low FODMAP', 'Gluten-Free', 'Dairy-Free', 'Other'];
  const dislikedFoods = [
    'Celery', 'Broccoli', 'Brussels Sprouts', 'Cauliflower', 'Mushrooms', 'Onions', 
    'Bell Peppers', 'Olives', 'Tomatoes', 'Cilantro', 'Beets', 'Eggplant',
    'Fish', 'Seafood', 'Tofu', 'Beans', 'Liver', 'Blue Cheese',
    'Mayonnaise', 'Pickles', 'Sauerkraut', 'Anchovies', 'Capers', 'Ginger'
  ];
  const goals = ['Extra Healthy', 'Weight Loss', 'Muscle Gain', 'High Protein', 'Low Carb', 'Balanced', 'Budget Friendly'];
  const meals = ['Breakfast', 'Lunch', 'Dinner'];
  const snacks = ['Homemade Snacks', 'Store-Bought Snacks', 'Healthy Snacks', 'Desserts'];
  const prepStyles = ['Cook Every Meal', 'Cook Once Daily', 'Weekly Meal Prep'];
  const skillLevels = ['Beginner', 'Intermediate', 'Advanced'];
  const difficulties = ['Easy (5-10 min)', 'Medium (15-30 min)', 'Complex (30+ min)'];
  const milkTypes = ['Whole Milk', '2% Milk', '1% Milk', 'Skim Milk', 'Lactose-Free Milk', 'Almond Milk', 'Soy Milk', 'Oat Milk', 'Coconut Milk', 'No Milk'];
  const eggTypes = ['Large White Eggs', 'Large Brown Eggs', 'Medium Eggs', 'Jumbo Eggs', 'Organic Eggs', 'Pasture-Raised Eggs', 'Egg Whites Only', 'Liquid Eggs', 'No Eggs'];

  const handleNext = async (e) => {
    // Prevent any default action
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    console.log(`handleNext called - current step: ${step}`);
    if (step < 12) {
      console.log(`Moving to step ${step + 1}`);
      setStep(step + 1);
    } else {
      console.log('Step 12 reached - starting save process');
      setSaving(true);
      
      try {
        // Save and complete with profileCompleted flag
        const completedProfile = {
          ...profile,
          profileCompleted: true
        };
        
        if (user) {
          try {
            // Save profile to KV storage for cross-device sync
            console.log('Attempting to save profile to cloud:', {
              userId: user.id,
              profileSize: JSON.stringify(completedProfile).length,
              profileKeys: Object.keys(completedProfile)
            });
            const saveResult = await kvService.set(user.id, 'profile', completedProfile);
            console.log('Profile save result:', saveResult);
            console.log('Profile saved to KV storage');
            
            // IMPORTANT: Wait for the cloud sync to complete
            console.log('Waiting for cloud sync to complete...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for sync
            
            // Verify the profile saved to cloud
            console.log('Verifying profile in cloud...');
            const verifyProfile = await kvService.get(user.id, 'profile', true); // Skip cache
            if (!verifyProfile) {
              throw new Error('Profile failed to save to cloud storage');
            }
            console.log('Profile verified in cloud!');
            
            // Only save completion status to Clerk (small data)
            const response = await user.update({
              unsafeMetadata: {
                ...user.unsafeMetadata,
                profileCompleted: true,
                lastUpdated: new Date().toISOString()
              }
            });
            console.log('Profile completion saved to Clerk');
            
            // Mark as existing profile for future auto-saves
            setIsExistingProfile(true);
          } catch (error) {
            console.error('Error saving profile:', error);
            throw error;
          }
        }
        
        // Only redirect after everything is saved and verified
        console.log('All saves complete - redirecting to dashboard');
        window.location.href = '/dashboard';
      } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile. Please try again.');
        setSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };
  
  const goToStep = (targetStep) => {
    setStep(targetStep);
  };

  const toggleArrayItem = (array, item, field) => {
    const currentArray = profile[field] || [];
    const updated = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    setProfile({ ...profile, [field]: updated });
  };

  const calculateNutrition = () => {
    const { age, gender, weight, heightFeet, heightInches, activityLevel, goal } = nutritionCalc;
    
    // Use defaults if fields are empty
    const finalAge = age || 30;
    const finalWeight = weight || 170;
    const finalHeightFeet = heightFeet || 5;
    const finalHeightInches = heightInches || 10;
    
    // Convert height to total inches
    const totalHeightInches = (finalHeightFeet * 12) + finalHeightInches;
    
    // Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
    let bmr;
    if (gender === 'male') {
      bmr = (10 * finalWeight * 0.453592) + (6.25 * totalHeightInches * 2.54) - (5 * finalAge) + 5;
    } else {
      bmr = (10 * finalWeight * 0.453592) + (6.25 * totalHeightInches * 2.54) - (5 * finalAge) - 161;
    }
    
    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,      // Little to no exercise
      light: 1.375,        // Light exercise 1-3 days/week
      moderate: 1.55,      // Moderate exercise 3-5 days/week
      active: 1.725,       // Heavy exercise 6-7 days/week
      veryActive: 1.9      // Very heavy physical job or 2x training
    };
    
    // Calculate TDEE (Total Daily Energy Expenditure)
    const tdee = bmr * activityMultipliers[activityLevel];
    
    // Adjust calories based on goal
    let targetCalories = tdee;
    if (goal === 'lose') {
      targetCalories = tdee - 500; // 500 calorie deficit for ~1 lb/week loss
    } else if (goal === 'gain') {
      targetCalories = tdee + 300; // 300 calorie surplus for lean gains
    }
    
    // Calculate macros based on goal
    let proteinRatio, carbRatio, fatRatio;
    
    if (goal === 'lose') {
      proteinRatio = 0.35; // High protein for muscle preservation
      carbRatio = 0.35;
      fatRatio = 0.30;
    } else if (goal === 'gain') {
      proteinRatio = 0.30;
      carbRatio = 0.45; // Higher carbs for energy and muscle building
      fatRatio = 0.25;
    } else { // maintain
      proteinRatio = 0.30;
      carbRatio = 0.40;
      fatRatio = 0.30;
    }
    
    // Calculate grams
    const protein = Math.round((targetCalories * proteinRatio) / 4); // 4 cal per gram
    const carbs = Math.round((targetCalories * carbRatio) / 4);      // 4 cal per gram
    const fat = Math.round((targetCalories * fatRatio) / 9);         // 9 cal per gram
    
    // Calculate other nutrients
    const fiber = gender === 'male' ? 38 : 25; // Daily recommended
    const sugar = Math.round(targetCalories * 0.10 / 4); // Max 10% of calories
    const sodium = 2300; // Daily recommended max
    const cholesterol = 300; // Daily recommended max
    
    // Auto-fill the nutrition targets
    setProfile({
      ...profile,
      nutritionalTargets: {
        ...profile.nutritionalTargets,
        trackNutrition: true,
        dailyCalories: Math.round(targetCalories),
        dailyProtein: protein,
        dailyCarbs: carbs,
        dailyFat: fat,
        dailyFiber: fiber,
        dailySugar: sugar,
        dailySodium: sodium,
        dailyCholesterol: cholesterol
      }
    });
    
    // Close calculator
    setShowNutritionCalculator(false);
  };

  const stepTitles = [
    'Family & Budget',
    'Store Location',
    'Cooking Tools',
    'Experience',
    'Diet Type',
    'Cuisines & Restrictions',
    'Dislikes',
    'Goals',
    'Meal Types',
    'Snacks',
    'Dairy',
    'Nutrition'
  ];

  return (
    <div className="profile-setup">
      <div className="setup-container">
        <div className="progress-bar">
          <div className="progress" style={{ width: `${(step / 12) * 100}%` }}></div>
        </div>
        
        <div className="step-indicators">
          {stepTitles.map((title, index) => (
            <button
              key={index}
              className={`step-dot ${step === index + 1 ? 'active' : ''} ${index + 1 < step ? 'completed' : ''}`}
              onClick={() => goToStep(index + 1)}
              title={title}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {step === 1 && !user?.publicMetadata?.profileCompleted && !isUpdateMode && (
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f0f8ff',
            borderRadius: '8px'
          }}>
            <h1 style={{ color: '#4CAF50', marginBottom: '10px' }}>Welcome to The Weekly Dish! 🎉</h1>
            <p style={{ fontSize: '16px', color: '#666' }}>
              Let's set up your profile to create personalized meal plans just for you.
            </p>
          </div>
        )}
        {isUpdateMode && step === 1 && (
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px'
          }}>
            <h1 style={{ color: '#2e7d32', marginBottom: '10px' }}>Update Your Profile</h1>
            <p style={{ fontSize: '16px', color: '#666' }}>
              Make changes to your preferences and click "Save & Return to Dashboard" when done.
            </p>
          </div>
        )}
        <h2>{stepTitles[step - 1]}</h2>

        {step === 1 && (
          <div className="setup-step">
            <h3>Who are we cooking for?</h3>
            <div className="input-group">
              <label>
                Adults
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={profile.adults}
                  onChange={(e) => setProfile({ ...profile, adults: parseInt(e.target.value) })}
                />
              </label>
              <label>
                Kids
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={profile.kids}
                  onChange={(e) => setProfile({ ...profile, kids: parseInt(e.target.value) })}
                />
              </label>
            </div>
            {profile.kids > 0 && (
              <div className="kid-ages">
                <label>Kid Ages</label>
                <div className="age-selectors">
                  {[...Array(profile.kids)].map((_, index) => (
                    <div key={index} className="age-selector">
                      <label>Child {index + 1} Age:</label>
                      <select
                        value={profile.kidAges[index] || 0}
                        onChange={(e) => {
                          const newAges = [...profile.kidAges];
                          newAges[index] = parseInt(e.target.value);
                          setProfile({ ...profile, kidAges: newAges });
                        }}
                      >
                        {[...Array(19)].map((_, age) => (
                          <option key={age} value={age}>{age}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="budget-input">
              <label>Weekly Budget ($)</label>
              <input
                type="number"
                min="20"
                max="1000"
                value={profile.weeklyBudget}
                onChange={(e) => setProfile({ ...profile, weeklyBudget: parseInt(e.target.value) })}
              />
              <div className="budget-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={profile.stickToBudget}
                    onChange={(e) => setProfile({ ...profile, stickToBudget: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-text">
                    {profile.stickToBudget ? '✓ Stick to Budget (Use full amount)' : 'Stay Under Budget'}
                  </span>
                </label>
                <p className="toggle-description">
                  {profile.stickToBudget 
                    ? 'Meal plans will use as close to your full budget as possible'
                    : 'Meal plans will stay under budget, using less if possible'}
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="setup-step">
            <h3>Where do you shop?</h3>
            <div className="location-input">
              <label>Enter your ZIP code for local Walmart pricing</label>
              <input
                type="text"
                placeholder="ZIP Code (e.g., 90210)"
                value={profile.zipCode}
                onChange={(e) => setProfile({ ...profile, zipCode: e.target.value.replace(/\D/g, '') })}
                maxLength="5"
              />
              
              {profile.zipCode && profile.zipCode.length === 5 && (
                <div className="zip-confirmed">
                  ✓ We'll search for Walmart products and prices in ZIP {profile.zipCode}
                </div>
              )}
              
              <p className="location-note">
                Your ZIP code helps us find accurate Walmart prices and products available in your area. The AI will search Walmart.com for your specific location when creating meal plans.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="setup-step">
            <h3>What cooking tools do you have?</h3>
            <div className="checkbox-grid">
              {tools.map(tool => (
                <label key={tool} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.cookingTools?.includes(tool) || false}
                    onChange={() => toggleArrayItem(tool, tool, 'cookingTools')}
                  />
                  <span>{tool}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="setup-step">
            <h3>Cooking Experience</h3>
            <div className="radio-group">
              <label>Skill Level</label>
              {skillLevels.map(level => (
                <label key={level} className="radio-item">
                  <input
                    type="radio"
                    name="skill"
                    checked={profile.skillLevel === level}
                    onChange={() => setProfile({ ...profile, skillLevel: level })}
                  />
                  <span>{level}</span>
                </label>
              ))}
            </div>
            <div className="radio-group">
              <label>Meal Difficulty Preference</label>
              {difficulties.map(level => (
                <label key={level} className="radio-item">
                  <input
                    type="radio"
                    name="difficulty"
                    checked={profile.mealDifficulty === level}
                    onChange={() => setProfile({ ...profile, mealDifficulty: level })}
                  />
                  <span>{level}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="setup-step">
            <h3>Diet Type</h3>
            <div className="radio-group">
              {dietTypes.map(diet => (
                <label key={diet} className="radio-item">
                  <input
                    type="radio"
                    name="diet"
                    checked={profile.dietType === diet}
                    onChange={() => {
                      console.log('Changing diet from', profile.dietType, 'to', diet);
                      setProfile({ ...profile, dietType: diet });
                    }}
                  />
                  <span>{diet}</span>
                </label>
              ))}
            </div>
            {profile.dietType === 'Other' && (
              <textarea
                placeholder="Describe your custom diet..."
                value={profile.customDiet}
                onChange={(e) => setProfile({ ...profile, customDiet: e.target.value })}
                rows="3"
              />
            )}
          </div>
        )}

        {step === 6 && (
          <div className="setup-step">
            <h3>Cuisine Preferences</h3>
            <div className="checkbox-grid">
              {cuisines.map(cuisine => (
                <label key={cuisine} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.cuisineTypes?.includes(cuisine) || false}
                    onChange={() => toggleArrayItem(cuisine, cuisine, 'cuisineTypes')}
                  />
                  <span>{cuisine}</span>
                </label>
              ))}
            </div>
            <div className="custom-input">
              <label>Other Cuisine Types</label>
              <input
                type="text"
                placeholder="e.g., Thai, French, Korean, Ethiopian (comma separated)"
                value={profile.customCuisines}
                onChange={(e) => setProfile({ ...profile, customCuisines: e.target.value })}
              />
            </div>
            <div className="restrictions-input">
              <label>Dietary Restrictions/Allergies</label>
              <input
                type="text"
                placeholder="e.g., no peanuts, shellfish allergy, lactose intolerant"
                value={profile.dietaryRestrictions}
                onChange={(e) => setProfile({ ...profile, dietaryRestrictions: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="setup-step">
            <h3>Foods You Dislike</h3>
            <p>Select foods you don't want in your meals</p>
            <div className="checkbox-grid">
              {dislikedFoods.map(food => (
                <label key={food} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.dislikedFoods?.includes(food) || false}
                    onChange={() => toggleArrayItem(food, food, 'dislikedFoods')}
                  />
                  <span>{food}</span>
                </label>
              ))}
            </div>
            <div className="custom-input" style={{marginTop: '20px'}}>
              <label>Other Foods You Dislike</label>
              <input
                type="text"
                placeholder="e.g., spinach, quinoa, kale (comma separated)"
                value={profile.customDislikedFoods}
                onChange={(e) => setProfile({ ...profile, customDislikedFoods: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="setup-step">
            <h3>Food Goals</h3>
            <div className="checkbox-grid">
              {goals.map(goal => (
                <label key={goal} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.foodGoals?.includes(goal) || false}
                    onChange={() => toggleArrayItem(goal, goal, 'foodGoals')}
                  />
                  <span>{goal}</span>
                </label>
              ))}
            </div>
            <div className="radio-group">
              <label>Meal Prep Style</label>
              {prepStyles.map(style => (
                <label key={style} className="radio-item">
                  <input
                    type="radio"
                    name="prepStyle"
                    checked={profile.prepStyle === style}
                    onChange={() => setProfile({ ...profile, prepStyle: style })}
                  />
                  <span>{style}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 9 && (
          <div className="setup-step">
            <h3>What Meals to Plan</h3>
            <div className="checkbox-grid">
              {meals.map(meal => (
                <label key={meal} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.mealTypes?.includes(meal) || false}
                    onChange={() => toggleArrayItem(meal, meal, 'mealTypes')}
                  />
                  <span>{meal}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 10 && (
          <div className="setup-step">
            <h3>Snack Preferences</h3>
            <p>Select all that apply</p>
            <div className="checkbox-grid">
              {snacks.map(snack => (
                <label key={snack} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={profile.snackTypes?.includes(snack) || false}
                    onChange={() => toggleArrayItem(snack, snack, 'snackTypes')}
                  />
                  <span>{snack}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 11 && (
          <div className="setup-step">
            <h3>Dairy Preferences</h3>
            <p>Select your preferred milk and egg types for shopping and recipes</p>
            
            <div className="radio-group">
              <label style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>Milk Preference</label>
              {milkTypes.map(type => (
                <label key={type} className="radio-item">
                  <input
                    type="radio"
                    name="milkType"
                    checked={profile.dairyPreferences?.milk === type}
                    onChange={() => setProfile({ 
                      ...profile, 
                      dairyPreferences: {
                        ...profile.dairyPreferences,
                        milk: type
                      }
                    })}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
            
            <div className="radio-group" style={{ marginTop: '30px' }}>
              <label style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>Egg Preference</label>
              {eggTypes.map(type => (
                <label key={type} className="radio-item">
                  <input
                    type="radio"
                    name="eggType"
                    checked={profile.dairyPreferences?.eggs === type}
                    onChange={() => setProfile({ 
                      ...profile, 
                      dairyPreferences: {
                        ...profile.dairyPreferences,
                        eggs: type
                      }
                    })}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 12 && (
          <div className="setup-step">
            <h3>Nutritional Targets (Optional)</h3>
            <div className="nutrition-toggle">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={profile.nutritionalTargets.trackNutrition}
                  onChange={(e) => setProfile({
                    ...profile,
                    nutritionalTargets: {
                      ...profile.nutritionalTargets,
                      trackNutrition: e.target.checked
                    }
                  })}
                />
                <span>Track nutritional values and set daily targets</span>
              </label>
            </div>
            
            {profile.nutritionalTargets.trackNutrition && (
              <div className="nutrition-inputs">
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#e3f2fd', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <label className="checkbox-item" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={showNutritionCalculator}
                      onChange={(e) => setShowNutritionCalculator(e.target.checked)}
                    />
                    <span>I don't know my numbers - help me calculate them</span>
                  </label>
                </div>

                {showNutritionCalculator && (
                  <div style={{
                    marginBottom: '20px',
                    padding: '20px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    border: '2px solid #4CAF50'
                  }}>
                    <h4 style={{ marginBottom: '15px', color: '#4CAF50' }}>Nutrition Calculator</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div>
                        <label>Age</label>
                        <input
                          type="number"
                          value={nutritionCalc.age || ''}
                          onChange={(e) => setNutritionCalc({...nutritionCalc, age: e.target.value === '' ? '' : parseInt(e.target.value)})}
                          placeholder="30"
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      
                      <div>
                        <label>Gender</label>
                        <select
                          value={nutritionCalc.gender}
                          onChange={(e) => setNutritionCalc({...nutritionCalc, gender: e.target.value})}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      
                      <div>
                        <label>Weight (lbs)</label>
                        <input
                          type="number"
                          value={nutritionCalc.weight || ''}
                          onChange={(e) => setNutritionCalc({...nutritionCalc, weight: e.target.value === '' ? '' : parseInt(e.target.value)})}
                          placeholder="170"
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                      </div>
                      
                      <div>
                        <label>Height</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input
                            type="number"
                            value={nutritionCalc.heightFeet || ''}
                            onChange={(e) => setNutritionCalc({...nutritionCalc, heightFeet: e.target.value === '' ? '' : parseInt(e.target.value)})}
                            placeholder="5"
                            style={{ width: '50%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                          <span style={{ alignSelf: 'center' }}>ft</span>
                          <input
                            type="number"
                            value={nutritionCalc.heightInches || ''}
                            onChange={(e) => setNutritionCalc({...nutritionCalc, heightInches: e.target.value === '' ? '' : parseInt(e.target.value)})}
                            placeholder="10"
                            min="0"
                            max="11"
                            style={{ width: '50%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                          <span style={{ alignSelf: 'center' }}>in</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <label>Activity Level</label>
                      <select
                        value={nutritionCalc.activityLevel}
                        onChange={(e) => setNutritionCalc({...nutritionCalc, activityLevel: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        <option value="sedentary">Sedentary (little to no exercise)</option>
                        <option value="light">Light (exercise 1-3 days/week)</option>
                        <option value="moderate">Moderate (exercise 3-5 days/week)</option>
                        <option value="active">Active (exercise 6-7 days/week)</option>
                        <option value="veryActive">Very Active (physical job or 2x daily training)</option>
                      </select>
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <label>Goal</label>
                      <select
                        value={nutritionCalc.goal}
                        onChange={(e) => setNutritionCalc({...nutritionCalc, goal: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        <option value="lose">Lose Weight</option>
                        <option value="maintain">Maintain Weight</option>
                        <option value="gain">Build Muscle/Gain Weight</option>
                      </select>
                    </div>
                    
                    <button
                      type="button"
                      onClick={calculateNutrition}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Calculate & Auto-Fill My Nutrition Targets
                    </button>
                  </div>
                )}
                
                <p className="nutrition-note">Set your daily nutritional targets per person:</p>
                
                <div className="nutrition-grid">
                  <div className="nutrition-input">
                    <label>Calories</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailyCalories || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailyCalories: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Protein (g)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailyProtein || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailyProtein: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Carbs (g)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailyCarbs || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailyCarbs: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Fat (g)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailyFat || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailyFat: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Fiber (g)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailyFiber || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailyFiber: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Sugar (g)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailySugar || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailySugar: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Sodium (mg)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailySodium || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailySodium: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  
                  <div className="nutrition-input">
                    <label>Cholesterol (mg)</label>
                    <input
                      type="number"
                      value={profile.nutritionalTargets.dailyCholesterol || ''}
                      onChange={(e) => setProfile({
                        ...profile,
                        nutritionalTargets: {
                          ...profile.nutritionalTargets,
                          dailyCholesterol: e.target.value === '' ? 0 : parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="setup-actions">
          {step > 1 && (
            <button onClick={handleBack} className="back-btn">← Previous</button>
          )}
          {isUpdateMode && (
            <button 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setSaving(true);
                console.log('Saving profile updates and returning to dashboard');
                
                
                try {
                  // Save the updated profile with completion flag
                  const updatedProfile = {
                    ...profile,
                    profileCompleted: true,
                    lastUpdated: new Date().toISOString()
                  };
                  
                  console.log('Saving updated profile with dietType:', updatedProfile.dietType);
                  await kvService.set(user.id, 'profile', updatedProfile);
                  
                  // Wait for sync to complete
                  console.log('Waiting for cloud sync...');
                  await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds
                  
                  // Verify save with fresh data (no cache)
                  const verifyProfile = await kvService.get(user.id, 'profile', true);
                  if (!verifyProfile) {
                    throw new Error('Profile updates failed to save');
                  }
                  
                  console.log('Profile verified in cloud with dietType:', verifyProfile.dietType);
                  
                  // Clear the cache to ensure fresh data on next load
                  
                  window.location.href = '/dashboard';
                } catch (error) {
                  console.error('Error saving profile updates:', error);
                  alert('Failed to save profile updates. Please try again.');
                  setSaving(false);
                }
              }}
              className="next-btn"
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save & Return to Dashboard'}
            </button>
          )}
          {!isUpdateMode && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Button clicked on step ${step}`);
                handleNext(e);
              }} 
              className="next-btn" 
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : step === 12 ? 'Save & Start Meal Planning' : 'Next →'}
            </button>
          )}
          {isUpdateMode && step < 12 && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setStep(step + 1);
              }} 
              className="next-btn" 
              type="button"
            >
              Next →
            </button>
          )}
        </div>
        
        {isUpdateMode && (
          <div className="save-indicator">
            <span>💡 Use "Save & Return to Dashboard" when done</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileSetup;