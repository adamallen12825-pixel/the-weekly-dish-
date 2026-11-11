import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getAuthToken } from '../utils/authToken';

// The Square card form must come from the matching environment. Set
// REACT_APP_SQUARE_ENVIRONMENT=production (with the production application id)
// when going live; anything else uses the sandbox, where no real money moves.
const SQUARE_PRODUCTION = process.env.REACT_APP_SQUARE_ENVIRONMENT === 'production';
const SQUARE_SDK_URL = SQUARE_PRODUCTION
  ? 'https://web.squarecdn.com/v1/square.js'
  : 'https://sandbox.web.squarecdn.com/v1/square.js';

async function api(path, options = {}) {
  const token = await getAuthToken();
  const response = await fetch(`/api/payments/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

function Subscribe() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [squareLoaded, setSquareLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const cardRef = useRef(null);

  const loadStatus = useCallback(async () => {
    const { ok, data } = await api('status');
    if (ok) setStatus(data);
    setStatusLoaded(true);
  }, []);

  useEffect(() => {
    if (isSignedIn) loadStatus();
  }, [isSignedIn, loadStatus]);

  const subscription = status && status.subscription;
  const subscribed = Boolean(subscription && subscription.active);
  const showCardForm = isSignedIn && statusLoaded && !subscribed;

  // Load the Square card form only when it is needed.
  useEffect(() => {
    if (!showCardForm) return undefined;
    let cancelled = false;

    const initializeSquare = async () => {
      if (cancelled || !window.Square || cardRef.current) return;
      try {
        const payments = window.Square.payments(
          process.env.REACT_APP_SQUARE_APPLICATION_ID,
          process.env.REACT_APP_SQUARE_LOCATION_ID
        );
        const card = await payments.card();
        if (cancelled) {
          card.destroy();
          return;
        }
        await card.attach('#card-container');
        cardRef.current = card;
        setSquareLoaded(true);
      } catch (e) {
        console.error('Initializing Square Payments failed', e);
        setMessage('The payment form could not load. Please refresh the page.');
      }
    };

    if (window.Square) {
      initializeSquare();
    } else {
      const script = document.createElement('script');
      script.src = SQUARE_SDK_URL;
      script.async = true;
      script.onload = initializeSquare;
      script.onerror = () => setMessage('The payment form could not load. Please refresh the page.');
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (cardRef.current) {
        cardRef.current.destroy();
        cardRef.current = null;
      }
      setSquareLoaded(false);
    };
  }, [showCardForm]);

  const handleSubscribe = async () => {
    if (!cardRef.current || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        setMessage('Please check your card details and try again.');
        return;
      }
      // The server takes the user and the price from its own records; only
      // the one-time payment token is sent from here.
      const { ok, data } = await api('create-subscription', {
        method: 'POST',
        body: JSON.stringify({ sourceId: result.token }),
      });
      if (ok && data.success) {
        setMessage(data.alreadySubscribed ? 'You already have an active subscription.' : 'Welcome! Your subscription is active.');
        await loadStatus();
      } else {
        setMessage(data.error || 'We could not start your subscription. Please try again.');
      }
    } catch (error) {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You keep access until the end of the period you have paid for.')) return;
    setLoading(true);
    setMessage('');
    try {
      const { ok, data } = await api('cancel', { method: 'POST' });
      if (ok && data.success) {
        setMessage(data.endsOn ? `Your subscription is cancelled. You have access until ${formatDate(data.endsOn)}.` : 'Your subscription is cancelled.');
        await loadStatus();
      } else {
        setMessage(data.error || 'We could not cancel your subscription. Please try again.');
      }
    } catch (error) {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inTrial = status && status.reason === 'trial' && status.trialEndsAt;
  const trialEnded = status && status.reason === 'trial_ended';

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
            <li>✓ Personalized Weekly Meal Plans</li>
            <li>✓ Smart Shopping Lists Built From Your Meals</li>
            <li>✓ Pantry Tracking with Barcode and Photo Scanning</li>
            <li>✓ Plans Built Around Your Grocery Budget</li>
            <li>✓ Nutrition Targets</li>
            <li>✓ Full Recipes with Step-by-Step Instructions</li>
            <li>✓ Walmart Shop Mode</li>
            <li>✓ Weekly Meal Prep Support</li>
            <li>✓ Diet Support (Keto, Paleo, Vegan and more)</li>
            <li>✓ Family-Friendly Meal Plans</li>
          </ul>
        </div>

        <div style={styles.trial}>
          {inTrial && <p>🎉 Your free trial runs until {formatDate(status.trialEndsAt)}.</p>}
          {trialEnded && <p>Your free trial has ended. Subscribe to keep planning meals.</p>}
          <p style={styles.cancelText}>Cancel anytime, no questions asked</p>
        </div>

        {message && <p style={styles.signInText} role="status">{message}</p>}

        {!isSignedIn ? (
          <>
            <p style={styles.signInText}>Please sign in to subscribe</p>
            <a href="/sign-in" style={styles.button}>Sign In to Continue</a>
          </>
        ) : !statusLoaded ? (
          <div style={styles.loadingCard}>Loading your account...</div>
        ) : subscribed ? (
          <>
            <p style={styles.signInText}>
              {subscription.endsOn
                ? `Your subscription is cancelled and ends on ${formatDate(subscription.endsOn)}.`
                : `✅ Your subscription is active${subscription.paidThrough ? ` (paid through ${formatDate(subscription.paidThrough)})` : ''}.`}
            </p>
            <a href="/dashboard" style={styles.button}>Go to Dashboard</a>
            {!subscription.endsOn && (
              <button onClick={handleCancel} disabled={loading} style={styles.buttonSecondary}>
                {loading ? 'Working...' : 'Cancel Subscription'}
              </button>
            )}
          </>
        ) : (
          <>
            <div id="card-container" style={styles.cardContainer}></div>
            {!squareLoaded && <div style={styles.loadingCard}>Loading payment form...</div>}
            <button
              onClick={handleSubscribe}
              disabled={loading || !squareLoaded}
              style={loading || !squareLoaded ? styles.buttonDisabled : styles.button}
            >
              {loading ? 'Processing...' : 'Subscribe'}
            </button>
          </>
        )}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Secure payment powered by Square<br/>
            Your card details go straight to Square and never touch our servers
          </p>
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