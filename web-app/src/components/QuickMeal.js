import React, { useState, useEffect } from 'react';
import { generateQuickMeal } from '../services/gptService';
import kvService from '../services/kvService';
import './QuickMeal.css';

function QuickMeal({ user, profile }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mealSuggestion, setMealSuggestion] = useState(null);
  const [recipe, setRecipe] = useState(null);

  useEffect(() => {
    // Load pantry items from kvService
    const loadPantry = async () => {
      if (user) {
        try {
          const saved = await kvService.get(user.id, 'pantry');
          if (saved) {
            setPantryItems(saved);
          }
        } catch (error) {
          console.error('Error loading pantry:', error);
        }
      }
    };
    loadPantry();
  }, [user]);

  const generateMeal = async () => {
    if (pantryItems.length === 0) {
      alert('Please add items to your pantry first');
      return;
    }

    setLoading(true);
    setMealSuggestion(null);
    setRecipe(null);

    try {
      const result = await generateQuickMeal(pantryItems, profile);
      setMealSuggestion(result.meal);
      setRecipe(result.recipe);
    } catch (error) {
      console.error('Error generating meal:', error);
      alert('Failed to generate meal suggestion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quick-meal-container">
      <h2>Quick Meal from Pantry</h2>
      <p className="subtitle">Make something delicious with what you have on hand</p>

      <div className="pantry-info">
        <p>You have <strong>{pantryItems.length}</strong> items in your pantry</p>
        {pantryItems.length > 0 && (
          <p className="pantry-preview">
            Including: {pantryItems.slice(0, 5).map(item => item.name).join(', ')}
            {pantryItems.length > 5 && '...'}
          </p>
        )}
      </div>

      <button 
        className="generate-btn"
        onClick={generateMeal}
        disabled={loading}
      >
        {loading ? 'Generating...' : mealSuggestion ? 'Get Another Suggestion' : 'Get Meal Suggestion'}
      </button>

      {mealSuggestion && (
        <div className="result-container">
          <div className="meal-card">
            <h3>{mealSuggestion}</h3>
            
            {recipe && (
              <>
                <div className="recipe-section">
                  <h4>Ingredients Used from Pantry:</h4>
                  <ul>
                    {recipe.ingredients?.map((ing, idx) => (
                      <li key={idx}>{ing}</li>
                    ))}
                  </ul>
                </div>

                <div className="recipe-section">
                  <h4>Instructions:</h4>
                  <ol>
                    {recipe.instructions?.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="recipe-meta">
                  <span>⏱ {recipe.cookingTime || 20} minutes</span>
                  <span>🍽 Serves {recipe.servings || 4}</span>
                  <span>💵 Estimated: ${recipe.estimatedCost?.toFixed(2) || '5.00'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickMeal;