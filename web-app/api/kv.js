// Production-ready Vercel Blob Storage API endpoint for cross-device sync
// This enables users to access their data from any device

module.exports = async (req, res) => {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse query parameters
  const { userId, key } = req.query;

  // Validate required parameters
  if (!userId || !key) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      details: 'Both userId and key are required'
    });
  }

  // Create a namespaced path for the blob
  const blobPath = `users/${userId}/${key}.json`;

  try {
    // Check if Vercel Blob is configured
    const isBlobConfigured = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!isBlobConfigured) {
      // Development mode - use in-memory storage
      console.log('[DEV MODE] Using in-memory storage fallback');
      
      // Initialize global storage if needed
      if (!global.devStorage) {
        global.devStorage = new Map();
      }
      
      switch (req.method) {
        case 'GET': {
          const data = global.devStorage.get(blobPath);
          if (!data) {
            return res.status(404).json({ error: 'Key not found' });
          }
          return res.status(200).json(data);
        }
        
        case 'POST': {
          const { value } = req.body;
          if (value === undefined) {
            return res.status(400).json({ error: 'Missing value in request body' });
          }
          global.devStorage.set(blobPath, value);
          return res.status(200).json({ success: true, message: 'Data saved (dev mode)' });
        }
        
        case 'DELETE': {
          global.devStorage.delete(blobPath);
          return res.status(200).json({ success: true, message: 'Data deleted (dev mode)' });
        }
        
        default:
          res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
          return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
      }
    }

    // Production mode - use Vercel Blob Storage
    const { put, del, list } = require('@vercel/blob');
    
    switch (req.method) {
      case 'GET': {
        try {
          console.log(`[GET] Looking for blob: ${blobPath}`);
          // Check if the blob exists
          const { blobs } = await list({ 
            prefix: blobPath,
            limit: 10  // Get more to see if there are duplicates
          });
          
          console.log(`[GET] Found ${blobs?.length || 0} blobs for ${blobPath}`);
          
          // If no blobs found with exact path, try to find any profile blobs for this user
          if ((!blobs || blobs.length === 0) && key === 'profile') {
            console.log(`[GET] No profile found at ${blobPath}, searching for any profile blobs...`);
            const userPrefix = `users/${userId}/`;
            const { blobs: allUserBlobs } = await list({ 
              prefix: userPrefix,
              limit: 100
            });
            
            if (allUserBlobs && allUserBlobs.length > 0) {
              console.log(`[GET] Found ${allUserBlobs.length} total blobs for user ${userId}:`);
              // Look for any profile-related blobs
              const profileBlobs = allUserBlobs.filter(b => 
                b.pathname.includes('profile') || 
                b.pathname.endsWith('.json')
              );
              
              if (profileBlobs.length > 0) {
                console.log(`[GET] Found ${profileBlobs.length} profile-related blobs:`);
                profileBlobs.forEach(blob => {
                  console.log(`  - ${blob.pathname} (uploaded: ${blob.uploadedAt})`);
                });
                
                // Use the most recent profile blob
                profileBlobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
                const recoveredBlob = profileBlobs[0];
                console.log(`[GET] Attempting to recover from: ${recoveredBlob.pathname}`);
                
                // Fetch and return the recovered blob
                const response = await fetch(recoveredBlob.url);
                if (response.ok) {
                  const data = await response.json();
                  console.log(`[GET] Successfully recovered profile data from ${recoveredBlob.pathname}`);
                  
                  // Also save it to the correct path for future use
                  try {
                    await put(blobPath, JSON.stringify(data), {
                      access: 'public',
                      contentType: 'application/json'
                    });
                    console.log(`[GET] Re-saved profile to correct path: ${blobPath}`);
                  } catch (saveError) {
                    console.log(`[GET] Could not re-save to correct path: ${saveError.message}`);
                  }
                  
                  return res.status(200).json(data);
                }
              }
            }
            
            // No profile data found anywhere
            return res.status(404).json({ error: 'Key not found' });
          }
          
          if (!blobs || blobs.length === 0) {
            return res.status(404).json({ error: 'Key not found' });
          }
          
          // If multiple blobs, log them
          if (blobs.length > 1) {
            console.log(`[GET] Multiple blobs found for ${blobPath}:`);
            blobs.forEach(blob => {
              console.log(`  - ${blob.pathname} (uploaded: ${blob.uploadedAt})`);
            });
            // Use the most recent one
            blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
          }
          
          const blobToUse = blobs[0];
          console.log(`[GET] Using blob: ${blobToUse.pathname}`);
          
          // Fetch the blob content
          const response = await fetch(blobToUse.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.statusText}`);
          }
          
          const data = await response.json();
          return res.status(200).json(data);
        } catch (error) {
          console.error(`[GET] Error retrieving ${blobPath}:`, error);
          console.error(`[GET] Error stack:`, error.stack);
          return res.status(500).json({ 
            error: 'Failed to retrieve data',
            details: error.message 
          });
        }
      }
      
      case 'POST': {
        const { value } = req.body;
        if (value === undefined) {
          return res.status(400).json({ error: 'Missing value in request body' });
        }
        
        try {
          // Check data size before attempting to save
          const dataString = JSON.stringify(value);
          const dataSizeKB = Buffer.byteLength(dataString) / 1024;
          const dataSizeMB = dataSizeKB / 1024;
          
          console.log(`[POST] Attempting to save ${blobPath} - Size: ${dataSizeKB.toFixed(2)} KB (${dataSizeMB.toFixed(3)} MB)`);
          
          // Vercel Blob has a 4.5MB limit per blob
          if (dataSizeMB > 4.5) {
            console.error(`[POST] Data too large for ${blobPath}: ${dataSizeMB.toFixed(3)} MB (max 4.5 MB)`);
            return res.status(413).json({ 
              error: 'Data too large',
              details: `Data size ${dataSizeMB.toFixed(3)} MB exceeds 4.5 MB limit`,
              size: dataSizeMB
            });
          }
          
          // Check for specific key patterns that might be causing issues
          if (key === 'profile') {
            console.log('[POST] Profile data keys:', Object.keys(value));
            console.log('[POST] Profile dietType:', value.dietType);
          }
          
          // Delete any existing blob before saving to avoid conflicts
          try {
            // Check if blob exists first
            const { blobs } = await list({ 
              prefix: blobPath,
              limit: 10
            });
            
            if (blobs && blobs.length > 0) {
              console.log(`[POST] Found ${blobs.length} existing blob(s) for ${blobPath}, deleting all`);
              // Delete all existing blobs with this path
              for (const blob of blobs) {
                console.log(`[POST] Deleting blob: ${blob.pathname}`);
                await del(blob.url);
              }
            }
          } catch (listError) {
            console.log(`[POST] Error checking for existing blobs (continuing): ${listError.message}`);
          }
          
          // Now save the new blob
          const blob = await put(blobPath, dataString, {
            access: 'public',
            contentType: 'application/json'
          });
          
          console.log(`[POST] Successfully saved ${blobPath} (${dataSizeKB.toFixed(2)} KB)`);
          return res.status(200).json({ 
            success: true, 
            url: blob.url,
            message: 'Data saved to cloud',
            sizeKB: dataSizeKB
          });
        } catch (error) {
          console.error(`[POST] Error saving ${blobPath}:`, error);
          console.error('[POST] Error stack:', error.stack);
          
          // Check for specific error types
          if (error.message?.includes('Invalid blob pathname')) {
            return res.status(400).json({ 
              error: 'Invalid blob pathname',
              details: 'The storage path contains invalid characters',
              path: blobPath
            });
          }
          
          if (error.message?.includes('quota') || error.message?.includes('limit')) {
            return res.status(507).json({ 
              error: 'Storage quota exceeded',
              details: 'Vercel Blob storage quota may be exceeded'
            });
          }
          
          return res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message,
            type: error.name
          });
        }
      }
      
      case 'DELETE': {
        try {
          // Delete the blob
          await del(blobPath);
          console.log(`[DELETE] Successfully deleted ${blobPath}`);
          return res.status(200).json({ 
            success: true,
            message: 'Data deleted from cloud'
          });
        } catch (error) {
          // It's ok if the blob doesn't exist when deleting
          console.log(`[DELETE] Blob ${blobPath} may not exist:`, error.message);
          return res.status(200).json({ 
            success: true,
            message: 'Data deleted or did not exist'
          });
        }
      }
      
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};