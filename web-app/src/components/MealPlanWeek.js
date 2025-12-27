import React, { useState } from 'react';

function MealPlanWeek({
  weekPlan,
  weekLabel,
  isCurrentWeek,
  onReplaceMeal,
  onCopyMeal,
  onReuseWeek,
  onToggleFavorite,
  onToggleDislike,
  onCookedMeal,
  onCustomMeal,
  favorites = [],
  dislikes = [],
  replacing = {},
  shoppingList = null,
  cookingHistory = []
}) {
  // Helper to check if a meal has been cooked
  const isMealCooked = (mealName, day, mealType) => {
    return cookingHistory.some(entry =>
      entry.meal === mealName &&
      entry.day === day &&
      entry.mealType === mealType
    );
  };
  const [customMealInputs, setCustomMealInputs] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});
  if (!weekPlan) return null;

  return (
    <div className="week-container" style={{ marginBottom: '40px' }}>
      <div className="week-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: isCurrentWeek ? '#f0f8f0' : '#f8f8f8',
        borderRadius: '8px'
      }}>
        <h3>{weekLabel}</h3>
        {!isCurrentWeek && (
          <button
            onClick={() => onReuseWeek(weekPlan)}
            style={{
              padding: '8px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reuse Entire Week
          </button>
        )}
      </div>

      <div className="days-grid">
        {weekPlan.days.map((day, dayIndex) => (
          <div key={dayIndex} className="day-card">
            <h4>{day.day}</h4>
            
            {['breakfast', 'lunch', 'dinner'].map(mealType => {
              const isReplacing = replacing[`${dayIndex}-${mealType}`];
              const isGeneratingCustom = replacing[`${dayIndex}-${mealType}`] && showCustomInput[`${dayIndex}-${mealType}`];
              const meal = day.meals ? day.meals[mealType] : null;

              // Skip rendering if meal doesn't exist
              if (!meal) return null;

              const isCooked = isMealCooked(meal.name, day.day, mealType);

              return (
                <div key={mealType} className="meal-item" style={{
                  position: 'relative',
                  ...(isCooked ? { opacity: 0.5 } : {})
                }}>
                  {isCooked && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10,
                      borderRadius: '8px',
                      pointerEvents: 'none'
                    }}>
                      <span style={{
                        color: 'white',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                        transform: 'rotate(-15deg)'
                      }}>
                        COOKED
                      </span>
                    </div>
                  )}
                  <div className="meal-header">
                    <span className="meal-type">{mealType}</span>
                    {isCurrentWeek && !shoppingList ? (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => onReplaceMeal(dayIndex, mealType)}
                          disabled={Object.keys(replacing).length > 0}
                          className="replace-btn"
                        >
                          {isReplacing && !isGeneratingCustom ? 'Replacing...' : 'Replace'}
                        </button>
                        <button
                          onClick={() => {
                            const key = `${dayIndex}-${mealType}`;
                            setShowCustomInput(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                          className="custom-meal-btn"
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#9C27B0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Custom
                        </button>
                      </div>
                    ) : isCurrentWeek ? (
                      <span style={{ fontSize: '12px', color: '#666' }}>Accepted</span>
                    ) : (
                      <button
                        onClick={() => onCopyMeal(meal, day.day, mealType)}
                        className="copy-btn"
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Copy to Current
                      </button>
                    )}
                  </div>
                  
                  {showCustomInput[`${dayIndex}-${mealType}`] && !shoppingList && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Enter custom meal name..."
                        value={customMealInputs[`${dayIndex}-${mealType}`] || ''}
                        onChange={(e) => {
                          const key = `${dayIndex}-${mealType}`;
                          setCustomMealInputs(prev => ({ ...prev, [key]: e.target.value }));
                        }}
                        style={{
                          width: '100%',
                          padding: '6px',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          marginBottom: '5px'
                        }}
                      />
                      <button
                        onClick={async () => {
                          const key = `${dayIndex}-${mealType}`;
                          const customMealName = customMealInputs[key];
                          if (customMealName && customMealName.trim()) {
                            try {
                              await onCustomMeal(dayIndex, mealType, customMealName.trim());
                              // Clear the input and hide the form after successful submission
                              setCustomMealInputs(prev => ({ ...prev, [key]: '' }));
                              setShowCustomInput(prev => ({ ...prev, [key]: false }));
                            } catch (error) {
                              console.error('Failed to set custom meal:', error);
                              // Keep the input open on error so user can try again
                            }
                          }
                        }}
                        disabled={isReplacing}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginRight: '5px'
                        }}
                      >
                        {isReplacing ? 'Generating...' : 'Set Meal'}
                      </button>
                      <button
                        onClick={() => {
                          const key = `${dayIndex}-${mealType}`;
                          setShowCustomInput(prev => ({ ...prev, [key]: false }));
                          setCustomMealInputs(prev => ({ ...prev, [key]: '' }));
                        }}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  
                  <p className="meal-name">{meal.name}</p>
                  <p className="meal-cost">${meal.estimatedCost?.toFixed(2)}</p>
                  
                  {isCurrentWeek && (
                    <div className="meal-actions">
                      <button
                        onClick={() => onToggleFavorite(meal.name)}
                        className={`thumb-btn ${favorites.includes(meal.name) ? 'active' : ''}`}
                        title="Like this recipe"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => onToggleDislike(meal.name)}
                        className={`thumb-btn ${dislikes.includes(meal.name) ? 'active' : ''}`}
                        title="Dislike this recipe"
                      >
                        👎
                      </button>
                      <button
                        onClick={() => onCookedMeal({...meal, mealType, day: day.day})}
                        className="cooked-btn"
                        title="I cooked this"
                        disabled={isCooked}
                        style={isCooked ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        {isCooked ? '✓ Cooked' : '🍳 Cooked'}
                      </button>
                    </div>
                  )}
                  
                  {meal.nutrition && (
                    <div className="meal-nutrition">
                      <span className="nutrition-badge">Cal: {meal.nutrition.calories}</span>
                      <span className="nutrition-badge">P: {meal.nutrition.protein}g</span>
                      <span className="nutrition-badge">C: {meal.nutrition.carbs}g</span>
                      <span className="nutrition-badge">F: {meal.nutrition.fat}g</span>
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
                    let snackName = snack;
                    if (typeof snack === 'object') {
                      snackName = snack.name || snack.title || JSON.stringify(snack);
                    }
                    return <p key={idx} className="snack-item">• {snackName}</p>;
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isCurrentWeek && shoppingList && (
        <div className="shopping-list-preview">
          <h3>Shopping List Generated</h3>
          <p>Total: ${shoppingList.totalCost?.toFixed(2)}</p>
          <p>View the Shopping List tab for details</p>
        </div>
      )}
    </div>
  );
}

export default MealPlanWeek;