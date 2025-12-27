// API endpoints for Vercel KV storage
const API_BASE = process.env.REACT_APP_API_URL || '/api';

// Helper to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// KV Storage API
export const kvStorage = {
  // Get data for a user
  get: async (userId, key) => {
    try {
      const response = await fetch(`${API_BASE}/kv/${userId}/${key}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.status === 404) {
        return null; // Key doesn't exist
      }
      
      return handleResponse(response);
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      // Fallback to localStorage if API fails
      const stored = localStorage.getItem(`${userId}_${key}`);
      return stored ? JSON.parse(stored) : null;
    }
  },

  // Set data for a user
  set: async (userId, key, value) => {
    try {
      // Always save to localStorage first (instant feedback)
      localStorage.setItem(`${userId}_${key}`, JSON.stringify(value));
      
      // Then sync to cloud
      const response = await fetch(`${API_BASE}/kv/${userId}/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      // If cloud sync fails, data is still in localStorage
      return { success: false, error: error.message };
    }
  },

  // Delete data for a user
  delete: async (userId, key) => {
    try {
      // Remove from localStorage first
      localStorage.removeItem(`${userId}_${key}`);
      
      // Then remove from cloud
      const response = await fetch(`${API_BASE}/kv/${userId}/${key}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      return { success: false, error: error.message };
    }
  },

  // Get all keys for a user
  getAllKeys: async (userId) => {
    try {
      const response = await fetch(`${API_BASE}/kv/${userId}/keys`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Error getting keys:', error);
      return [];
    }
  },

  // Batch get multiple keys
  batchGet: async (userId, keys) => {
    try {
      const promises = keys.map(key => kvStorage.get(userId, key));
      const results = await Promise.all(promises);
      
      const data = {};
      keys.forEach((key, index) => {
        data[key] = results[index];
      });
      
      return data;
    } catch (error) {
      console.error('Error batch getting:', error);
      return {};
    }
  },

  // Clear all data for a user
  clearAll: async (userId) => {
    try {
      const response = await fetch(`${API_BASE}/kv/${userId}/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      // Also clear localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`${userId}_`)) {
          localStorage.removeItem(key);
        }
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('Error clearing all data:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export for use in components
export default kvStorage;