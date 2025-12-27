import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import ToSAcceptance from './ToSAcceptance';
import kvService from '../services/kvService';

function AuthRedirect() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [checkingToS, setCheckingToS] = useState(true);
  const [needsToAcceptToS, setNeedsToAcceptToS] = useState(false);
  
  useEffect(() => {
    const checkToSAcceptance = async () => {
      if (!isLoaded || !isSignedIn || !user) return;
      
      // ONLY check the user's ACCOUNT data - never check device storage
      // First check Clerk metadata
      const clerkTosAccepted = user.publicMetadata?.tosAccepted === true;
      
      // Also check cloud storage for ToS acceptance
      let cloudTosAccepted = false;
      try {
        const cloudToS = await kvService.get(user.id, 'tosAcceptance', true); // Skip cache
        cloudTosAccepted = cloudToS?.tosAccepted === true;
      } catch (error) {
        console.log('Could not check cloud ToS status');
      }
      
      // User needs to accept if NEITHER account source shows acceptance
      // We NEVER check localStorage - only account data
      if (!clerkTosAccepted && !cloudTosAccepted) {
        setNeedsToAcceptToS(true);
      } else {
        setNeedsToAcceptToS(false);
      }
      
      setCheckingToS(false);
    };
    
    checkToSAcceptance();
  }, [user, isLoaded, isSignedIn]);

  if (!isLoaded || checkingToS) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // Show ToS acceptance if needed
  if (needsToAcceptToS) {
    return <ToSAcceptance />;
  }

  // Check Clerk's unsafeMetadata for profile completion
  const profileCompleted = user?.unsafeMetadata?.profileCompleted === true;
  
  if (profileCompleted) {
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/profile-setup" replace />;
  }
}

export default AuthRedirect;