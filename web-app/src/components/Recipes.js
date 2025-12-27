import React, { useState, useEffect } from 'react';
import { getDetailedRecipe } from '../services/gptService';
import kvService from '../services/kvService';
import './Recipes.css';

function Recipes({ user }) {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [dislikes, setDislikes] = useState([]);

  // Helper function to load data from cloud storage
  const loadUserData = async (key, skipCache = false) => {
    if (!user) return null;
    try {
      return await kvService.get(user.id, key, skipCache);
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return null;
    }
  };

  // Helper function to save data to cloud storage
  const saveUserData = async (key, value) => {
    if (!user) return;
    try {
      if (value === null || value === undefined) {
        // Delete from storage when value is null
        await kvService.delete(user.id, key);
      } else {
        await kvService.set(user.id, key, value);
      }
      
      // Update Clerk with status flags only for preferences
      if (key === 'recipeFavorites' || key === 'recipeDislikes') {
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            hasRecipePreferences: true,
            lastPreferencesUpdate: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      // Load profile (skip cache for fresh data)
      const savedProfile = await loadUserData('profile', true);
      if (savedProfile) {
        setProfile(savedProfile);
      }
      
      // Load favorites and dislikes (skip cache for fresh data)
      const savedFavorites = await loadUserData('recipeFavorites', true) || [];
      const savedDislikes = await loadUserData('recipeDislikes', true) || [];
      setFavorites(savedFavorites);
      setDislikes(savedDislikes);
      
      // Load recipes from meal plan (skip cache for fresh data)
      const mealPlan = await loadUserData('currentMealPlan', true);
      if (mealPlan) {
        const plan = mealPlan;
        const allRecipes = [];
      
      plan.days.forEach(day => {
        ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
          if (day.meals[mealType]) {
            allRecipes.push({
              ...day.meals[mealType],
              day: day.day,
              mealType
            });
          }
        });
      });
      
        setRecipes(allRecipes);
      }
    };
    
    loadData();
  }, [user]);

  const toggleFavorite = (mealName) => {
    let newFavorites = [...favorites];
    let newDislikes = [...dislikes];
    
    if (favorites.includes(mealName)) {
      newFavorites = newFavorites.filter(f => f !== mealName);
    } else {
      newFavorites.push(mealName);
      newDislikes = newDislikes.filter(d => d !== mealName);
    }
    
    setFavorites(newFavorites);
    setDislikes(newDislikes);
    saveUserData('recipeFavorites', newFavorites);
    saveUserData('recipeDislikes', newDislikes);
  };

  const toggleDislike = (mealName) => {
    let newDislikes = [...dislikes];
    let newFavorites = [...favorites];
    
    if (dislikes.includes(mealName)) {
      newDislikes = newDislikes.filter(d => d !== mealName);
    } else {
      newDislikes.push(mealName);
      newFavorites = newFavorites.filter(f => f !== mealName);
    }
    
    setDislikes(newDislikes);
    setFavorites(newFavorites);
    saveUserData('recipeDislikes', newDislikes);
    saveUserData('recipeFavorites', newFavorites);
  };

  const handleCookedRecipe = (recipe) => {
    if (!window.confirm(`Mark "${recipe.name}" as cooked? This will remove ingredients from your pantry.`)) {
      return;
    }
    
    alert(`✅ Marked as cooked! Pantry updated.`);
    
    const cookingHistory = loadUserData('cookingHistory') || [];
    cookingHistory.push({
      meal: recipe.name,
      date: new Date().toISOString(),
      mealType: recipe.mealType
    });
    saveUserData('cookingHistory', cookingHistory);
  };

  const handleRecipeClick = async (recipe) => {
    // Check cache first
    const cachedRecipes = loadUserData('recipesCache') || {};
    if (cachedRecipes[recipe.name]) {
      setSelectedRecipe(cachedRecipes[recipe.name]);
      return;
    }
    
    // If not cached, fetch it
    setLoading(true);
    try {
      const detailed = await getDetailedRecipe(recipe, profile);
      setSelectedRecipe(detailed);
      
      // Cache it for next time
      cachedRecipes[recipe.name] = detailed;
      saveUserData('recipesCache', cachedRecipes);
    } catch (error) {
      console.error('Error loading recipe:', error);
      alert(`Failed to load recipe: ${error.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const closeRecipe = () => {
    setSelectedRecipe(null);
  };

  return (
    <div className="recipes-container">
      <h2>Recipe Collection</h2>

      {recipes.length === 0 && (
        <p className="empty-message">
          No recipes available. Generate a meal plan to see recipes!
        </p>
      )}

      <div className="recipes-grid">
        {recipes.map((recipe, idx) => (
          <div 
            key={idx} 
            className="recipe-card"
          >
            <div onClick={() => handleRecipeClick(recipe)}>
              <div className="recipe-header">
                <span className="recipe-day">{recipe.day}</span>
                <span className="recipe-type">{recipe.mealType}</span>
              </div>
              <h3>{recipe.name}</h3>
              <div className="recipe-meta">
                <span>⏱ {recipe.cookingTime || 30} min</span>
                <span>💵 ${recipe.estimatedCost?.toFixed(2) || '0.00'}</span>
                <span>📊 {recipe.difficulty || 'Medium'}</span>
              </div>
              {recipe.nutrition && (
                <div className="recipe-card-nutrition">
                  <span className="nutrition-badge">Cal: {recipe.nutrition.calories}</span>
                  <span className="nutrition-badge">P: {recipe.nutrition.protein}g</span>
                  <span className="nutrition-badge">C: {recipe.nutrition.carbs}g</span>
                  <span className="nutrition-badge">F: {recipe.nutrition.fat}g</span>
                </div>
              )}
            </div>
            <div className="recipe-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(recipe.name);
                }}
                className={`thumb-btn ${favorites.includes(recipe.name) ? 'active' : ''}`}
                title="Like this recipe"
              >
                👍
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDislike(recipe.name);
                }}
                className={`thumb-btn ${dislikes.includes(recipe.name) ? 'active' : ''}`}
                title="Dislike this recipe"
              >
                👎
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCookedRecipe(recipe);
                }}
                className="cooked-btn"
                title="I cooked this"
              >
                🍳 Cooked
              </button>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading recipe details...</p>
        </div>
      )}

      {selectedRecipe && (
        <div className="recipe-modal" onClick={closeRecipe}>
          <div className="recipe-detail" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeRecipe}>×</button>
            
            <h2>{selectedRecipe.name}</h2>
            
            {selectedRecipe.isMealPrep && (
              <div style={{
                background: '#4CAF50',
                color: 'white',
                padding: '10px',
                borderRadius: '6px',
                marginBottom: '15px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                🍱 MEAL PREP RECIPE - Makes 7 Days Worth
              </div>
            )}
            
            <div className="recipe-info">
              <span>⏱ {selectedRecipe.cookingTime || 30} minutes</span>
              <span>🍽 Serves {selectedRecipe.servings || 4}{selectedRecipe.isMealPrep ? ' (7 days)' : ''}</span>
              <span>💵 ${selectedRecipe.cost?.toFixed(2) || '0.00'}</span>
            </div>

            <div className="recipe-section">
              <h3>Ingredients</h3>
              <ul>
                {selectedRecipe.ingredients?.map((ing, idx) => (
                  <li key={idx}>{ing}</li>
                ))}
              </ul>
            </div>

            <div className="recipe-section">
              <h3>Instructions</h3>
              <ol>
                {selectedRecipe.instructions?.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>

            {selectedRecipe.nutrition && (
              <div className="recipe-section">
                <h3>Nutrition (per serving)</h3>
                <div className="nutrition-grid">
                  <div className="nutrition-item">
                    <span className="nutrition-label">Calories:</span>
                    <span className="nutrition-value">{selectedRecipe.nutrition.calories}</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Protein:</span>
                    <span className="nutrition-value">{selectedRecipe.nutrition.protein}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Carbs:</span>
                    <span className="nutrition-value">{selectedRecipe.nutrition.carbs}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Fat:</span>
                    <span className="nutrition-value">{selectedRecipe.nutrition.fat}g</span>
                  </div>
                  {selectedRecipe.nutrition.fiber !== undefined && (
                    <div className="nutrition-item">
                      <span className="nutrition-label">Fiber:</span>
                      <span className="nutrition-value">{selectedRecipe.nutrition.fiber}g</span>
                    </div>
                  )}
                  {selectedRecipe.nutrition.sugar !== undefined && (
                    <div className="nutrition-item">
                      <span className="nutrition-label">Sugar:</span>
                      <span className="nutrition-value">{selectedRecipe.nutrition.sugar}g</span>
                    </div>
                  )}
                  {selectedRecipe.nutrition.sodium !== undefined && (
                    <div className="nutrition-item">
                      <span className="nutrition-label">Sodium:</span>
                      <span className="nutrition-value">{selectedRecipe.nutrition.sodium}mg</span>
                    </div>
                  )}
                  {selectedRecipe.nutrition.cholesterol !== undefined && (
                    <div className="nutrition-item">
                      <span className="nutrition-label">Cholesterol:</span>
                      <span className="nutrition-value">{selectedRecipe.nutrition.cholesterol}mg</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedRecipe.tips && (
              <div className="recipe-section">
                <h3>{selectedRecipe.isMealPrep ? 'Meal Prep Storage & Reheating' : 'Tips'}</h3>
                <p style={{ marginBottom: '10px' }}><strong>Storage:</strong> {selectedRecipe.tips.storage}</p>
                <p style={{ marginBottom: '10px' }}><strong>Reheating:</strong> {selectedRecipe.tips.reheating}</p>
                {selectedRecipe.tips.mealPrepTips && (
                  <div style={{ marginTop: '15px' }}>
                    <strong>Meal Prep Tips:</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      {selectedRecipe.tips.mealPrepTips.map((tip, idx) => (
                        <li key={idx} style={{ marginBottom: '5px' }}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="recipe-section">
              <h3>Video Tutorials</h3>
              <a 
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`how to make ${selectedRecipe.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="youtube-link"
              >
                <div className="youtube-button">
                  <span className="play-icon">▶</span>
                  <div className="youtube-text">
                    <p className="youtube-title">How to make {selectedRecipe.name}</p>
                    <p className="youtube-subtitle">Search YouTube for video tutorials</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Recipes;