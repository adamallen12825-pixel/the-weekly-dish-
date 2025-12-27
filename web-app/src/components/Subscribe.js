import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import kvService from '../services/kvService';

function Subscribe() {
  const { user, isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [squareLoaded, setSquareLoaded] = useState(false);
  const [card, setCard] = useState(null);
  const [payments, setPayments] = useState(null);

  useEffect(() => {
    // Load Square Web SDK
    const script = document.createElement('script');
    script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
    script.async = true;
    script.onload = () => initializeSquare();
    document.body.appendChild(script);

    return () => {
      if (card) {
        card.destroy();
      }
    };
  }, []);

  const initializeSquare = async () => {
    if (!window.Square) {
      console.error('Square.js failed to load');
      return;
    }

    try {
      const payments = window.Square.payments(
        process.env.REACT_APP_SQUARE_APPLICATION_ID,
        process.env.REACT_APP_SQUARE_LOCATION_ID
      );
      setPayments(payments);

      // Initialize Card payment method
      const card = await payments.card();
      await card.attach('#card-container');
      setCard(card);
      setSquareLoaded(true);
    } catch (e) {
      console.error('Initializing Square Payments failed', e);
    }
  };

  const handleSubscribe = async () => {
    if (!isSignedIn) {
      alert('Please sign in first');
      return;
    }

    if (!card) {
      alert('Payment form not ready. Please refresh and try again.');
      return;
    }

    setLoading(true);

    try {
      // Generate payment token
      const result = await card.tokenize();
      
      if (result.status === 'OK') {
        // Send token to your backend to create subscription
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/payments/create-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceId: result.token,
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            planId: 'WEEKLY_DISH_MONTHLY', // Your Square subscription plan ID
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setSubscribed(true);
          alert('Welcome to The Weekly Dish! Your subscription is active.');
          
          // Store subscription status to cloud
          if (user) {
            await kvService.set(user.id, 'subscriptionStatus', 'active');
          }
          
          // Redirect to dashboard
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        } else {
          alert(data.error || 'Subscription failed. Please try again.');
        }
      } else {
        console.error('Tokenization failed', result);
        alert('Payment validation failed. Please check your card details.');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      // Create customer portal session
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/payments/customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        alert('Unable to access customer portal. Please contact support.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscribe-container" style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>The Weekly Dish Premium</h1>
        <div style={styles.price}>
          <span style={styles.priceAmount}>$9.99</span>
          <span style={styles.pricePeriod}>/month</span>
        </div>
        
        <div style={styles.features}>
          <h3>What's Included:</h3>
          <ul style={styles.featureList}>
            <li>✓ Personalized Meal Planning</li>
            <li>✓ Smart Shopping Lists</li>
            <li>✓ Pantry Management with Camera Scanning</li>
            <li>✓ Budget Optimization ($20-$100/week)</li>
            <li>✓ Nutrition Tracking</li>
            <li>✓ Recipe Storage & Instructions</li>
            <li>✓ Walmart Integration</li>
            <li>✓ Weekly Meal Prep Support</li>
            <li>✓ Diet Compliance (Keto, Paleo, Vegan, etc.)</li>
            <li>✓ Family-Friendly Meal Plans</li>
          </ul>
        </div>

        <div style={styles.trial}>
          <p>🎉 Start with a 7-day free trial!</p>
          <p style={styles.cancelText}>Cancel anytime, no questions asked</p>
        </div>

        {/* SKIP PAYMENT BUTTON */}
        <button 
          onClick={async () => {
            if (user) {
              await kvService.set(user.id, 'subscriptionStatus', 'active');
            }
            window.location.href = '/dashboard';
          }}
          style={{
            ...styles.button, 
            backgroundColor: '#ff9800',
            marginBottom: '20px'
          }}
        >
          SKIP PAYMENT - ACCESS DASHBOARD NOW
        </button>

        {!subscribed ? (
          <>
            {isSignedIn ? (
              <>
                <div id="card-container" style={styles.cardContainer}></div>
                {!squareLoaded && (
                  <div style={styles.loadingCard}>Loading payment form...</div>
                )}
                <button 
                  onClick={handleSubscribe} 
                  disabled={loading || !squareLoaded}
                  style={loading || !squareLoaded ? styles.buttonDisabled : styles.button}
                >
                  {loading ? 'Processing...' : 'Start Free Trial'}
                </button>
              </>
            ) : (
              <>
                <p style={styles.signInText}>Please sign in to subscribe</p>
                <a href="/sign-in" style={styles.button}>Sign In to Continue</a>
              </>
            )}
          </>
        ) : (
          <button 
            onClick={handleManageSubscription} 
            disabled={loading}
            style={styles.buttonSecondary}
          >
            {loading ? 'Loading...' : 'Manage Subscription'}
          </button>
        )}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Secure payment powered by Square<br/>
            Your payment info is never stored on our servers
          </p>
          <div style={styles.badges}>
            <span style={styles.badge}>🔒 SSL Secured</span>
            <span style={styles.badge}>💳 PCI Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '32px',
    color: '#333',
    marginBottom: '20px',
    textAlign: 'center',
  },
  price: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: '30px',
  },
  priceAmount: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  pricePeriod: {
    fontSize: '20px',
    color: '#666',
    marginLeft: '5px',
  },
  features: {
    marginBottom: '30px',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    fontSize: '16px',
    lineHeight: '2',
    color: '#555',
  },
  trial: {
    backgroundColor: '#f0f8ff',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '30px',
    textAlign: 'center',
  },
  cancelText: {
    fontSize: '14px',
    color: '#666',
    marginTop: '5px',
  },
  cardContainer: {
    marginBottom: '20px',
    padding: '15px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  loadingCard: {
    padding: '40px',
    textAlign: 'center',
    color: '#999',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  button: {
    width: '100%',
    padding: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    textDecoration: 'none',
    textAlign: 'center',
    display: 'block',
  },
  buttonDisabled: {
    width: '100%',
    padding: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#ccc',
    border: 'none',
    borderRadius: '8px',
    cursor: 'not-allowed',
  },
  buttonSecondary: {
    width: '100%',
    padding: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: 'white',
    border: '2px solid #4CAF50',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  signInText: {
    textAlign: 'center',
    color: '#666',
    marginTop: '20px',
    fontSize: '16px',
  },
  footer: {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #eee',
  },
  footerText: {
    fontSize: '12px',
    color: '#999',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  badges: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginTop: '10px',
  },
  badge: {
    fontSize: '12px',
    color: '#666',
  },
};

export default Subscribe;