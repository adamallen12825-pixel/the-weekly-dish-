import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Simple confirmation page. The active subscription flow (Square) redirects
// straight to the dashboard; this page just shows a friendly message for any
// external return URL and forwards the user along.
function PaymentSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="payment-success">
      <h1>Payment Successful!</h1>
      <p>Welcome to The Weekly Dish Premium</p>
      <p>Redirecting you to your dashboard...</p>
    </div>
  );
}

export default PaymentSuccess;
