// Utility functions for user-specific localStorage

export const getUserStorageKey = (baseKey, user) => {
  // Use user ID if available, otherwise use email
  const userId = user?.id || user?.primaryEmailAddress?.emailAddress || 'guest';
  return `${userId}_${baseKey}`;
};

export const getUserStorage = (key, user) => {
  const userKey = getUserStorageKey(key, user);
  const data = localStorage.getItem(userKey);
  return data ? JSON.parse(data) : null;
};

export const setUserStorage = (key, value, user) => {
  const userKey = getUserStorageKey(key, user);
  localStorage.setItem(userKey, JSON.stringify(value));
};

export const removeUserStorage = (key, user) => {
  const userKey = getUserStorageKey(key, user);
  localStorage.removeItem(userKey);
};

export const clearUserStorage = (user) => {
  // Get all keys for this user
  const userId = user?.id || user?.primaryEmailAddress?.emailAddress || 'guest';
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${userId}_`)) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all user-specific keys
  keysToRemove.forEach(key => localStorage.removeItem(key));
};