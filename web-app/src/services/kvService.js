// KV Storage Service for cross-device sync
// This service handles all communication with Vercel KV

class KVStorageService {
  constructor() {
    this.cache = new Map();
    this.pendingWrites = new Map();
    this.syncInterval = null;
  }

  // Get the API base URL
  getApiBase() {
    // Always use relative URLs since domain is properly configured
    return '/api';
  }

  // Get data from KV storage
  async get(userId, key, skipCache = false) {
    if (!userId) {
      return null;
    }

    const cacheKey = `${userId}:${key}`;
    
    // Check cache first (unless skipCache is true)
    if (!skipCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      // Cache for 5 minutes
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.value;
      }
    }

    try {
      const response = await fetch(`${this.getApiBase()}/kv?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        // Try localStorage fallback
        const localKey = `${userId}_${key}`;
        const localData = localStorage.getItem(localKey);
        return localData ? JSON.parse(localData) : null;
      }

      if (!response.ok) {
        const localKey = `${userId}_${key}`;
        const localData = localStorage.getItem(localKey);
        return localData ? JSON.parse(localData) : null;
      }

      // Try to parse as JSON
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          const localKey = `${userId}_${key}`;
          const localData = localStorage.getItem(localKey);
          return localData ? JSON.parse(localData) : null;
        }
      } else {
        const localKey = `${userId}_${key}`;
        const localData = localStorage.getItem(localKey);
        return localData ? JSON.parse(localData) : null;
      }
      
      // Update cache
      this.cache.set(cacheKey, {
        value: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      
      // Fallback to localStorage
      const localKey = `${userId}_${key}`;
      const localData = localStorage.getItem(localKey);
      return localData ? JSON.parse(localData) : null;
    }
  }

  // Set data in KV storage
  async set(userId, key, value) {
    if (!userId) {
      return false;
    }

    const cacheKey = `${userId}:${key}`;
    const localKey = `${userId}_${key}`;

    // Save to localStorage immediately for instant feedback
    localStorage.setItem(localKey, JSON.stringify(value));

    // Update cache
    this.cache.set(cacheKey, {
      value: value,
      timestamp: Date.now()
    });

    // For critical data like pantry, sync immediately
    if (key === 'pantry') {
      try {
        const dataSize = JSON.stringify(value).length;
        
        const response = await fetch(`${this.getApiBase()}/kv?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value }),
        });

        if (!response.ok) {
          let errorDetails = '';
          try {
            const errorData = await response.json();
            errorDetails = errorData.details || errorData.error || '';
          } catch (e) {
          }
          throw new Error(`Failed to sync pantry: ${response.status}`);
        } else {
        }
      } catch (error) {
        console.error('Error syncing pantry to cloud:', error);
        throw error; // Propagate error so UI can handle it
      }
      return true;
    }

    // Queue for cloud sync (for non-critical data)
    this.pendingWrites.set(cacheKey, { userId, key, value });
    
    // Debounce cloud sync (wait 1 second before syncing)
    if (this.syncInterval) {
      clearTimeout(this.syncInterval);
    }
    
    this.syncInterval = setTimeout(() => {
      this.syncPendingWrites();
    }, 1000);

    return true;
  }

  // Sync all pending writes to cloud
  async syncPendingWrites() {
    if (this.pendingWrites.size === 0) return;

    const writes = Array.from(this.pendingWrites.entries());
    this.pendingWrites.clear();

    for (const [cacheKey, { userId, key, value }] of writes) {
      try {
        // Log data size for debugging
        const dataSize = JSON.stringify(value).length;
        console.log(`Syncing ${key} to cloud (${(dataSize / 1024).toFixed(2)} KB)`);
        
        const response = await fetch(`${this.getApiBase()}/kv?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value }),
        });

        if (!response.ok) {
          // Try to get error details from response
          let errorDetails = '';
          try {
            const errorData = await response.json();
            errorDetails = errorData.details || errorData.error || '';
            console.error(`Failed to sync ${key} to cloud - Status: ${response.status}, Error: ${errorDetails}`);
            
            // If it's a size issue, log that specifically
            if (response.status === 413 || errorDetails.includes('too large')) {
              console.error(`Data too large for ${key}: ${(dataSize / 1024).toFixed(2)} KB`);
            }
          } catch (e) {
            console.error(`Failed to sync ${key} to cloud - Status: ${response.status}`);
          }
          
          // Re-queue for retry only if not a permanent error
          if (response.status !== 413 && response.status !== 400) {
            this.pendingWrites.set(cacheKey, { userId, key, value });
          }
        } else {
          console.log(`Successfully synced ${key} to cloud`);
        }
      } catch (error) {
        console.error(`Error syncing ${key} to cloud:`, error);
        // Re-queue for retry
        this.pendingWrites.set(cacheKey, { userId, key, value });
      }
    }

    // If there are still pending writes, retry after 5 seconds
    if (this.pendingWrites.size > 0) {
      console.log(`Retrying ${this.pendingWrites.size} pending writes in 5 seconds...`);
      setTimeout(() => {
        this.syncPendingWrites();
      }, 5000);
    }
  }

  // Delete data from KV storage
  async delete(userId, key) {
    if (!userId) {
      console.warn('No userId provided for KV delete');
      return false;
    }

    const cacheKey = `${userId}:${key}`;
    const localKey = `${userId}_${key}`;

    // Remove from localStorage
    localStorage.removeItem(localKey);

    // Remove from cache
    this.cache.delete(cacheKey);

    // Remove from pending writes if present
    this.pendingWrites.delete(cacheKey);

    try {
      const response = await fetch(`${this.getApiBase()}/kv?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error(`Error deleting ${key} from KV:`, error);
      return false;
    }
  }

  // Clear all data for a user
  async clearAll(userId) {
    if (!userId) return false;

    // Clear localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`${userId}_`)) {
        localStorage.removeItem(key);
      }
    });

    // Clear cache
    const cacheKeys = Array.from(this.cache.keys());
    cacheKeys.forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    });

    // Clear pending writes
    const pendingKeys = Array.from(this.pendingWrites.keys());
    pendingKeys.forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        this.pendingWrites.delete(key);
      }
    });

    // Note: We don't have a bulk delete endpoint yet
    // For now, just return true after clearing local data
    return true;
  }

  // Clear all cache for a specific user
  clearUserCache(userId) {
    if (!userId) return;
    
    console.log('Clearing all cache for user:', userId);
    
    // Clear cache
    const cacheKeys = Array.from(this.cache.keys());
    cacheKeys.forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key);
      }
    });
    
    // Clear pending writes
    const pendingKeys = Array.from(this.pendingWrites.keys());
    pendingKeys.forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        this.pendingWrites.delete(key);
      }
    });
    
    // Also clear localStorage to force fresh data
    const localKeys = Object.keys(localStorage);
    localKeys.forEach(key => {
      if (key.startsWith(`${userId}_`)) {
        localStorage.removeItem(key);
        console.log('Removed localStorage key:', key);
      }
    });
  }

  // Load all user data from cloud on login
  async loadUserData(userId) {
    if (!userId) return {};

    const keys = [
      'profile',
      'currentMealPlan',
      'currentShoppingList',
      'pantryItems',
      'recipeFavorites',
      'recipeDislikes',
      'mealPlanHistory',
      'cookingHistory',
      'recipesCache'
    ];

    const data = {};
    
    // Load all keys in parallel
    const promises = keys.map(async (key) => {
      const value = await this.get(userId, key);
      if (value !== null) {
        data[key] = value;
      }
    });

    await Promise.all(promises);
    return data;
  }

  // Force sync all local data to cloud
  async forceSyncToCloud(userId) {
    if (!userId) return false;

    const keys = Object.keys(localStorage);
    const userKeys = keys.filter(k => k.startsWith(`${userId}_`));

    for (const localKey of userKeys) {
      const key = localKey.replace(`${userId}_`, '');
      const value = localStorage.getItem(localKey);
      
      if (value) {
        try {
          await this.set(userId, key, JSON.parse(value));
        } catch (e) {
          console.error(`Failed to sync ${key}:`, e);
        }
      }
    }

    return true;
  }
}

// Create a singleton instance
const kvService = new KVStorageService();

// Export for use in components
export default kvService;