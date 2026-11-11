import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import ToSAcceptance from './ToSAcceptance';
import kvService from '../services/kvService';

// Where to send someone right after signing in or up: Terms of Service first,
// then profile setup, then the dashboard. Both answers come from the data
// saved to their account, so they are the same on every device.
function AuthRedirect() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState('checking'); // checking | needs-tos | needs-profile | ready | error
  const userId = user?.id;

  const check = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !userId) return;
    setState('checking');
    try {
      const [tos, profile] = await Promise.all([
        kvService.get(userId, 'tosAcceptance', true),
        kvService.get(userId, 'profile', true),
      ]);
      if (!tos || tos.tosAccepted !== true) setState('needs-tos');
      else if (!profile || profile.profileCompleted !== true) setState('needs-profile');
      else setState('ready');
    } catch (error) {
      setState('error');
    }
  }, [userId, isLoaded, isSignedIn]);

  useEffect(() => {
    check();
  }, [check]);

  if (isLoaded && !isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (state === 'error') {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>We could not load your account</h2>
        <p>Check your internet connection and try again.</p>
        <button
          onClick={check}
          style={{ padding: '12px 28px', fontSize: '16px', color: '#fff', background: '#4CAF50', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!isLoaded || state === 'checking') {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (state === 'needs-tos') return <ToSAcceptance />;
  if (state === 'needs-profile') return <Navigate to="/profile-setup" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default AuthRedirect;
