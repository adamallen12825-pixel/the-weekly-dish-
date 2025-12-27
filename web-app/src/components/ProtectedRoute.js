import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import kvService from '../services/kvService';

function ProtectedRoute({ children, requireProfile = true }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const checkProfile = async () => {
      if (isLoaded && isSignedIn && user) {
        console.log('ProtectedRoute checking profile, user unsafeMetadata:', user.unsafeMetadata);
        
        // Don't just trust Clerk metadata - check if profile actually exists in cloud
        try {
          const cloudProfile = await kvService.get(user.id, 'profile', true); // Skip cache
          const profileExists = cloudProfile && cloudProfile.profileCompleted === true;
          
          console.log('Profile exists in cloud?', profileExists);
          
          setHasProfile(profileExists);
        } catch (error) {
          console.log('Error checking cloud profile:', error);
          setHasProfile(false);
        }
        
        setCheckingProfile(false);
      } else if (isLoaded) {
        setCheckingProfile(false);
      }
    };
    
    checkProfile();
  }, [user, isLoaded, isSignedIn]);

  if (!isLoaded || checkingProfile) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // Dashboard requires a profile
  if (requireProfile && !hasProfile) {
    return <Navigate to="/profile-setup" replace />;
  }

  // Profile setup page should redirect to dashboard if profile exists
  if (!requireProfile && hasProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;