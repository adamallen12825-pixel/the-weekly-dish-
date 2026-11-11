import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import kvService from '../services/kvService';

// Guards the signed-in pages. The saved profile is the single source of truth
// for "has this person finished setup". If the profile cannot be checked
// (offline, server trouble) the user is shown a retry screen; they are never
// bounced back into profile setup because of a failed request.
function ProtectedRoute({ children, requireProfile = true }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState('checking'); // checking | has-profile | no-profile | error
  const userId = user?.id;

  const checkProfile = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      setState('no-profile');
      return;
    }
    setState('checking');
    try {
      const profile = await kvService.get(userId, 'profile', true);
      setState(profile && profile.profileCompleted === true ? 'has-profile' : 'no-profile');
    } catch (error) {
      setState('error');
    }
  }, [userId, isLoaded, isSignedIn]);

  useEffect(() => {
    checkProfile();
  }, [checkProfile]);

  if (!isLoaded || (isSignedIn && state === 'checking')) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  if (state === 'error') {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>We could not load your account</h2>
        <p>Check your internet connection and try again. Your data is safe.</p>
        <button
          onClick={checkProfile}
          style={{ padding: '12px 28px', fontSize: '16px', color: '#fff', background: '#4CAF50', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    );
  }

  // Dashboard requires a profile
  if (requireProfile && state === 'no-profile') {
    return <Navigate to="/profile-setup" replace />;
  }

  // Profile setup page should redirect to dashboard if profile exists
  if (!requireProfile && state === 'has-profile') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
