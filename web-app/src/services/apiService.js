// API service for communicating with the backend
const API_URL = process.env.REACT_APP_API_URL || 'https://weekly-dish-api.vercel.app/api';

// Helper function to get auth headers
const getAuthHeaders = (user) => {
  if (!user) return {};
  return {
    'Authorization': `Bearer ${user.id}`,
    'Content-Type': 'application/json'
  };
};

// API calls for user data
export const userDataAPI = {
  // Save user profile
  saveProfile: async (user, profile) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(user),
        body: JSON.stringify({ profile })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  },

  // Get user profile
  getProfile: async (user) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/profile`, {
        method: 'GET',
        headers: getAuthHeaders(user)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  },

  // Save meal plan
  saveMealPlan: async (user, mealPlan, shoppingList) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/meal-plan`, {
        method: 'PUT',
        headers: getAuthHeaders(user),
        body: JSON.stringify({ mealPlan, shoppingList })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error saving meal plan:', error);
      throw error;
    }
  },

  // Get meal plan
  getMealPlan: async (user) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/meal-plan`, {
        method: 'GET',
        headers: getAuthHeaders(user)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting meal plan:', error);
      throw error;
    }
  },

  // Save pantry items
  savePantry: async (user, pantryItems) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/pantry`, {
        method: 'PUT',
        headers: getAuthHeaders(user),
        body: JSON.stringify({ pantryItems })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error saving pantry:', error);
      throw error;
    }
  },

  // Get pantry items
  getPantry: async (user) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/pantry`, {
        method: 'GET',
        headers: getAuthHeaders(user)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting pantry:', error);
      throw error;
    }
  },

  // Save user preferences (favorites, dislikes, etc.)
  savePreferences: async (user, preferences) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/preferences`, {
        method: 'PUT',
        headers: getAuthHeaders(user),
        body: JSON.stringify(preferences)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error saving preferences:', error);
      throw error;
    }
  },

  // Get user preferences
  getPreferences: async (user) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/preferences`, {
        method: 'GET',
        headers: getAuthHeaders(user)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting preferences:', error);
      throw error;
    }
  }
};

// Fallback to localStorage if API fails
export const storageWithFallback = {
  save: async (key, value, user) => {
    try {
      // Try API first
      if (key === 'profile') {
        await userDataAPI.saveProfile(user, value);
      } else if (key === 'mealPlan') {
        await userDataAPI.saveMealPlan(user, value.mealPlan, value.shoppingList);
      } else if (key === 'pantry') {
        await userDataAPI.savePantry(user, value);
      }
      return true;
    } catch (error) {
      console.warn('API save failed, using localStorage fallback:', error);
      // Fallback to localStorage
      localStorage.setItem(`${user.id}_${key}`, JSON.stringify(value));
      return false;
    }
  },

  load: async (key, user) => {
    try {
      // Try API first
      if (key === 'profile') {
        const data = await userDataAPI.getProfile(user);
        return data.profile;
      } else if (key === 'mealPlan') {
        return await userDataAPI.getMealPlan(user);
      } else if (key === 'pantry') {
        const data = await userDataAPI.getPantry(user);
        return data.pantryItems;
      }
    } catch (error) {
      console.warn('API load failed, using localStorage fallback:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem(`${user.id}_${key}`);
      return stored ? JSON.parse(stored) : null;
    }
  }
};