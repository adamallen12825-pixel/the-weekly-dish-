import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { payments } from '../api';

function PaymentSuccess({ user }) {
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      payments.verifyPayment(sessionId)
        .then(() => {
          setProcessing(false);
          // Navigate to dashboard after successful payment
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        })
        .catch(err => {
          setError('Payment verification failed');
          setProcessing(false);
        });
    }
  }, [searchParams, navigate]);

  if (processing) {
    return <div className="payment-processing">Verifying payment...</div>;
  }

  if (error) {
    return (
      <div className="payment-error">
        <h2>Payment Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="payment-success">
      <h1>Payment Successful!</h1>
      <p>Welcome to The Weekly Dish Premium</p>
      <p>Redirecting you back...</p>
    </div>
  );
}

export default PaymentSuccess;