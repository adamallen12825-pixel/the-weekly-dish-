import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import ProfileSetup from './ProfileSetup';
import { setCloudStorage } from '../utils/cloudStorage';

function ProfileSetupPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const handleProfileComplete = (completedProfile) => {
    // Profile is already saved and user data reloaded in ProfileSetup component
    // Navigate directly to dashboard
    navigate('/dashboard');
  };

  return <ProfileSetup user={user} onComplete={handleProfileComplete} />;
}

export default ProfileSetupPage;