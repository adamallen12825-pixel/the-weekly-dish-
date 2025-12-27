// Cloud storage service that uses Clerk's publicMetadata for cross-device sync
// This ensures all user data is stored in the cloud, not on the device

export const getCloudStorage = (key, user) => {
  if (!user || !user.publicMetadata) return null;
  return user.publicMetadata[key] || null;
};

export const setCloudStorage = async (key, value, user) => {
  if (!user) {
    console.error('No user provided to setCloudStorage');
    return false;
  }
  
  try {
    console.log(`Saving ${key} to Clerk:`, value);
    const result = await user.update({
      publicMetadata: {
        ...user.publicMetadata,
        [key]: value,
        lastUpdated: new Date().toISOString()
      }
    });
    console.log(`Successfully saved ${key} to Clerk`, result.publicMetadata);
    return true;
  } catch (error) {
    console.error(`Error saving ${key} to cloud:`, error);
    return false;
  }
};

export const setMultipleCloudStorage = async (updates, user) => {
  if (!user) return;
  
  try {
    const newMetadata = {
      ...user.publicMetadata,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    await user.update({
      publicMetadata: newMetadata
    });
    return true;
  } catch (error) {
    console.error('Error saving to cloud:', error);
    return false;
  }
};

export const removeCloudStorage = async (key, user) => {
  if (!user) return;
  
  try {
    const newMetadata = { ...user.publicMetadata };
    delete newMetadata[key];
    
    await user.update({
      publicMetadata: {
        ...newMetadata,
        lastUpdated: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.error(`Error removing ${key} from cloud:`, error);
    return false;
  }
};

export const clearAllCloudStorage = async (user) => {
  if (!user) return;
  
  try {
    await user.update({
      publicMetadata: {
        profileCompleted: false,
        lastUpdated: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.error('Error clearing cloud storage:', error);
    return false;
  }
};