import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MealPlan.css';

function SharedMealPlan() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [mealPlan, setMealPlan] = useState(null);
  const [sharedBy, setSharedBy] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const show = (data) => {
      if (cancelled) return;
      const plan = data && data.days ? data : data && data.mealPlan;
      if (plan && Array.isArray(plan.days) && plan.days.length) {
        setMealPlan(plan);
        setSharedBy(data.sharedBy || 'A Weekly Dish User');
      } else {
        setError('This meal plan link is invalid or has expired.');
      }
    };

    const load = async () => {
      // Current links: a short id that points at the plan stored on the server.
      if (/^[A-Za-z0-9_-]{12}$/.test(shareId)) {
        try {
          const response = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
          if (response.ok) {
            show(await response.json());
            return;
          }
          if (response.status !== 404) {
            if (!cancelled) setError('We could not load this meal plan right now. Please try again in a moment.');
            return;
          }
        } catch {
          if (!cancelled) setError('We could not load this meal plan. Check your connection and try again.');
          return;
        }
      }

      // Older links carried the whole plan inside the link itself.
      try {
        const base64 = shareId.replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        show(JSON.parse(new TextDecoder().decode(bytes)));
      } catch {
        if (!cancelled) setError('This meal plan link is invalid or has expired.');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const handleCreateAccount = () => {
    // Save the shared meal plan to session storage so they can import it after signing up
    sessionStorage.setItem('importMealPlan', JSON.stringify(mealPlan));
    navigate('/sign-up');
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <h2>Meal Plan Not Found</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} style={styles.homeButton}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <h2>Loading meal plan...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <img src="/logo.png" alt="The Weekly Dish" style={styles.logo} />
        <h1 style={styles.title}>The Weekly Dish</h1>
      </div>

      <div style={styles.sharedInfo}>
        <h2>Shared Meal Plan</h2>
        <p>Shared by: {sharedBy}</p>
        <p style={styles.date}>
          {mealPlan.weekStartDate ? `Week of ${new Date(mealPlan.weekStartDate).toLocaleDateString()}` : 'Current Week'}
        </p>
      </div>

      <div style={styles.ctaBox}>
        <p>Like this meal plan? Create your own personalized plans!</p>
        <button onClick={handleCreateAccount} style={styles.ctaButton}>
          Sign Up Free - Import This Plan
        </button>
      </div>

      <div className="days-grid" style={{ marginTop: '30px' }}>
        {mealPlan.days && mealPlan.days.map((day, dayIndex) => (
          <div key={dayIndex} className="day-card">
            <h4>{day.day}</h4>

            {['breakfast', 'lunch', 'dinner'].map(mealType => {
              const meal = day.meals && day.meals[mealType];

              if (!meal) return null;

              return (
                <div key={mealType} className="meal-item">
                  <div className="meal-header">
                    <span className="meal-type">{mealType}</span>
                  </div>
                  <p className="meal-name">{meal.name}</p>
                  {meal.estimatedCost && (
                    <p className="meal-cost">${meal.estimatedCost.toFixed(2)}</p>
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

      <div style={styles.footer}>
        <p>Want to customize this meal plan or create your own?</p>
        <button onClick={handleCreateAccount} style={styles.footerButton}>
          Get Started with The Weekly Dish
        </button>
        <p style={styles.footerText}>
          Free during beta • AI-powered meal planning • Budget-friendly
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #f0f0f0'
  },
  logo: {
    width: '50px',
    height: '50px'
  },
  title: {
    color: '#4CAF50',
    margin: 0
  },
  sharedInfo: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  date: {
    color: '#666',
    fontSize: '14px'
  },
  ctaBox: {
    backgroundColor: '#e8f4fd',
    border: '2px solid #0071ce',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center',
    marginBottom: '30px'
  },
  ctaButton: {
    padding: '12px 30px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  errorBox: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: '#fff3cd',
    borderRadius: '10px',
    marginTop: '50px'
  },
  loadingBox: {
    textAlign: 'center',
    padding: '40px',
    marginTop: '50px'
  },
  homeButton: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  footer: {
    marginTop: '50px',
    padding: '30px',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px'
  },
  footerButton: {
    padding: '12px 30px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    margin: '15px 0'
  },
  footerText: {
    color: '#666',
    fontSize: '14px',
    marginTop: '10px'
  }
};

export default SharedMealPlan;