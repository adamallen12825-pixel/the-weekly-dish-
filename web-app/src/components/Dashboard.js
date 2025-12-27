import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, UserButton, useClerk } from '@clerk/clerk-react';
import MealPlan from './MealPlan';
import Pantry from './Pantry';
import ShoppingList from './ShoppingList';
import Recipes from './Recipes';
import QuickMeal from './QuickMeal';
import kvService from '../services/kvService';

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'meal-plan';
  const [currentTab, setCurrentTab] = useState(tabFromUrl);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  
  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') || 'meal-plan';
    setCurrentTab(tab);
  }, [searchParams]);
  
  // Update URL when tab changes
  const changeTab = (newTab) => {
    setCurrentTab(newTab);
    setSearchParams({ tab: newTab });
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!isLoaded) return;
      
      setLoadingProfile(true);
      
      // Clean up any legacy localStorage data without user ID
      const legacyKeys = ['userProfile', 'pantryItems', 'mealPlan', 'shoppingList', 'recipes'];
      legacyKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`Removed legacy localStorage key: ${key}`);
        }
      });
      
      if (isSignedIn && user) {
        // Load data from KV storage
        
        // Load profile from KV storage for cross-device sync (skip cache for fresh data)
        try {
          const profile = await kvService.get(user.id, 'profile');
          if (profile) {
            setProfile(profile);
          }
        } catch (e) {
          console.error('Error loading profile:', e);
        }
      }
      
      setLoadingProfile(false);
    };
    
    loadUserProfile();
  }, [user, isLoaded, isSignedIn]);

  // TEMPORARILY DISABLED: Periodic account deletion check
  // Will re-enable after fixing the deletion flag issue
  /*
  useEffect(() => {
    if (!user) return;
    
    const checkAccountDeletion = async () => {
      try {
        const deletionFlag = await kvService.get(user.id, 'accountDeleted', true); // Skip cache
        
        if (deletionFlag && deletionFlag.deleted === true) {
          
          // Clear all local data
          localStorage.clear();
          sessionStorage.clear();
          
          // Sign out and redirect
          await signOut();
          window.location.href = '/';
        }
      } catch (error) {
        // Silently ignore errors in periodic check
      }
    };
    
    // Check every 30 seconds
    const intervalId = setInterval(checkAccountDeletion, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [user, signOut]);
  */

  const handleProfileUpdate = () => {
    // Navigate to profile update page (bypasses the profile check)
    navigate('/profile-update');
  };


  const handleDeleteProfile = async () => {
    try {
      if (user) {
        // FIRST: Set account deletion flag in cloud to notify other devices
        try {
          await kvService.set(user.id, 'accountDeleted', { 
            deleted: true, 
            deletedAt: new Date().toISOString(),
            deletedBy: 'user_request'
          });
          console.log('Account deletion flag set in cloud');
        } catch (err) {
          console.error('Failed to set deletion flag:', err);
        }
        
        // Clear all data from cloud storage
        const keysToDelete = [
          'userProfile',
          'profile',
          'mealPlan', 
          'shoppingList',
          'recipes',
          'pantry',
          'recipeFavorites',
          'recipeDislikes',
          'mealPlanHistory',
          'currentMealPlan',
          'currentShoppingList',
          'pantryItems',
          'cookingHistory',
          'recipesCache',
          'accountDeleted'  // Also delete the deletion flag itself
        ];
        
        for (const key of keysToDelete) {
          try {
            await kvService.delete(user.id, key);
          } catch (err) {
            console.log(`Could not delete ${key}:`, err);
          }
        }
        
        // Clear all local storage
        localStorage.clear();
        sessionStorage.clear();
        
        
        // Delete the actual Clerk user account
        try {
          await user.delete();
        } catch (deleteError) {
          // Even if delete fails, we should still sign out
        }
        
        // Sign out from Clerk to clear the session
        await signOut();
        
        // Force redirect to home page
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again or contact support.');
    }
    
    setShowDeleteConfirm(false);
  };

  const getSubscriptionStatus = () => {
    return 'Premium Account';
  };

  if (loadingProfile) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h2>Loading your profile...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="site-header">
        <div className="header-left">
          <img src="/logo.png" alt="The Weekly Dish" className="header-logo" />
          <h1>The Weekly Dish</h1>
          <span className="subscription-badge">{getSubscriptionStatus()}</span>
        </div>
        <div className="header-right">
          {isSignedIn ? (
            <>
              <span className="user-email">{user?.primaryEmailAddress?.emailAddress || user?.email}</span>
              <UserButton afterSignOutUrl="/" />
            </>
          ) : (
            <>
              <span className="user-email">Guest User</span>
              <a href="/sign-in" className="logout-btn">Sign In</a>
            </>
          )}
        </div>
      </header>

      <nav className="tab-navigation">
        <button 
          className={currentTab === 'meal-plan' ? 'active' : ''}
          onClick={() => changeTab('meal-plan')}
        >
          🍽️ Meal Plan
        </button>
        <button 
          className={currentTab === 'quick-meal' ? 'active' : ''}
          onClick={() => changeTab('quick-meal')}
        >
          ⚡ Quick Meal
        </button>
        <button 
          className={currentTab === 'pantry' ? 'active' : ''}
          onClick={() => changeTab('pantry')}
        >
          🏠 Pantry
        </button>
        <button 
          className={currentTab === 'shopping' ? 'active' : ''}
          onClick={() => changeTab('shopping')}
        >
          🛒 Shopping List
        </button>
        <button 
          className={currentTab === 'recipes' ? 'active' : ''}
          onClick={() => changeTab('recipes')}
        >
          📖 Recipes
        </button>
        <button 
          className={currentTab === 'settings' ? 'active' : ''}
          onClick={() => changeTab('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>

      <div className="tab-content">
        {currentTab === 'meal-plan' && <MealPlan user={user} profile={profile} />}
        {currentTab === 'quick-meal' && <QuickMeal user={user} profile={profile} />}
        {currentTab === 'pantry' && <Pantry user={user} />}
        {currentTab === 'shopping' && <ShoppingList user={user} />}
        {currentTab === 'recipes' && <Recipes user={user} />}
        {currentTab === 'settings' && (
          <div className="settings-container">
            <h2>Settings</h2>
            
            <div className="settings-section">
              <h3>Profile</h3>
              <p>Budget: ${profile?.weeklyBudget}/week</p>
              <p>Household: {profile?.adults} adults, {profile?.kids} kids</p>
              <p>Diet: {profile?.dietType}</p>
              <p>Skill Level: {profile?.skillLevel}</p>
              <p>Meal Prep Style: {profile?.prepStyle}</p>
              <p>Milk: {profile?.dairyPreferences?.milk || 'Not set'}</p>
              <p>Eggs: {profile?.dairyPreferences?.eggs || 'Not set'}</p>
              <button onClick={handleProfileUpdate}>
                Update Profile
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                style={{ marginTop: '10px', backgroundColor: '#f44336' }}
              >
                Delete Profile
              </button>
            </div>
            
            <div className="settings-section">
              <h3>Account Status</h3>
              <p>✅ Signed in as: {user?.primaryEmailAddress?.emailAddress}</p>
              <p>All your data is automatically saved to the cloud</p>
            </div>

          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3>Delete Profile?</h3>
            <p>Are you sure you want to delete your profile? This will remove all your preferences, meal plans, pantry items, and shopping lists.</p>
            <p style={{ color: '#f44336', fontWeight: 'bold' }}>This action cannot be undone!</p>
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={handleDeleteProfile}
                style={{ 
                  backgroundColor: '#f44336', 
                  color: 'white',
                  padding: '10px 20px',
                  marginRight: '10px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Yes, Delete Everything
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                style={{ 
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;