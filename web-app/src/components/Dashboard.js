import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, UserButton, useClerk } from '@clerk/clerk-react';
import MealPlan from './MealPlan';
import Pantry from './Pantry';
import ShoppingList from './ShoppingList';
import Recipes from './Recipes';
import QuickMeal from './QuickMeal';
import kvService from '../services/kvService';
import { getAuthToken } from '../utils/authToken';
import SyncStatus from './SyncStatus';

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'meal-plan';
  const [currentTab, setCurrentTab] = useState(tabFromUrl);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [access, setAccess] = useState(null);
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
      
      if (isSignedIn && user) {
        // Finish any saves a previous visit could not complete.
        kvService.resumePending(user.id);

        try {
          const profile = await kvService.get(user.id, 'profile');
          if (profile) setProfile(profile);
          setProfileError(false);
        } catch (e) {
          setProfileError(true);
        }

        // Subscription / trial status for the account badge.
        try {
          const token = await getAuthToken();
          const response = await fetch('/api/payments/status', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (response.ok) setAccess(await response.json());
        } catch (e) {
          // The badge is informational; ignore failures.
        }
      }
      
      setLoadingProfile(false);
    };
    
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isLoaded, isSignedIn]);

  const handleProfileUpdate = () => {
    // Navigate to profile update page (bypasses the profile check)
    navigate('/profile-update');
  };


  // Deletes the account on the server (data, subscription and sign-in) in one
  // step, so nothing is left behind if this tab closes part-way through.
  const handleDeleteProfile = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account.');
      }
      kvService.clearLocal(user.id);
      sessionStorage.clear();
      try {
        await signOut();
      } catch (e) {
        // The account no longer exists; signing out can fail harmlessly.
      }
      window.location.href = '/';
    } catch (error) {
      alert(`${error.message} Please try again or contact support.`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!access) return 'Member';
    if (access.subscription && access.subscription.active) return 'Premium';
    if (access.reason === 'trial') return 'Free Trial';
    if (access.reason === 'beta') return 'Beta Access';
    return 'Subscription Needed';
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

      <SyncStatus />
      {profileError && (
        <p className="load-error" role="alert" style={{ margin: '12px 20px' }}>
          We could not load your profile. Check your connection and refresh the page.
        </p>
      )}

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
                Delete Account
              </button>
            </div>
            
            <div className="settings-section">
              <h3>Account Status</h3>
              <p>✅ Signed in as: {user?.primaryEmailAddress?.emailAddress}</p>
              <p>All your data is automatically saved to your account</p>
              <p>Plan: {getSubscriptionStatus()}</p>
              {access && access.reason === 'trial' && access.trialEndsAt && (
                <p>Free trial ends {new Date(access.trialEndsAt).toLocaleDateString()}</p>
              )}
              {access && (access.enforced || access.subscription) && (
                <button onClick={() => navigate('/subscribe')}>
                  {access.subscription && access.subscription.active ? 'Manage Subscription' : 'Subscribe'}
                </button>
              )}
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
            <h3>Delete your account?</h3>
            <p>This permanently deletes your account, including your profile, meal plans, pantry and shopping lists, and cancels any subscription.</p>
            <p style={{ color: '#f44336', fontWeight: 'bold' }}>This action cannot be undone!</p>
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={handleDeleteProfile}
                disabled={deleting}
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
                {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
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