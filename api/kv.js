// KV Storage API endpoint for cross-device sync
// URL format: /api/kv?userId=XXX&key=YYY

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get userId and key from query params
  const { userId, key } = req.query;

  if (!userId || !key) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      details: 'Both userId and key are required as query parameters'
    });
  }

  // Create blob path
  const blobPath = `users/${userId}/${key}.json`;

  try {
    const isBlobConfigured = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!isBlobConfigured) {
      // Dev mode - in-memory storage
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
          return res.status(200).json({ success: true });
        }
        
        case 'DELETE': {
          global.devStorage.delete(blobPath);
          return res.status(200).json({ success: true });
        }
        
        default:
          res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
          return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
      }
    }

    // Production - Vercel Blob
    const { put, del, list } = require('@vercel/blob');
    
    switch (req.method) {
      case 'GET': {
        try {
          const { blobs } = await list({ 
            prefix: blobPath,
            limit: 1 
          });
          
          if (!blobs || blobs.length === 0) {
            return res.status(404).json({ error: 'Key not found' });
          }
          
          const response = await fetch(blobs[0].url);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.statusText}`);
          }
          
          const data = await response.json();
          return res.status(200).json(data);
        } catch (error) {
          console.error(`[GET] Error retrieving ${blobPath}:`, error);
          return res.status(404).json({ error: 'Key not found' });
        }
      }
      
      case 'POST': {
        const { value } = req.body;
        if (value === undefined) {
          return res.status(400).json({ error: 'Missing value in request body' });
        }
        
        try {
          const blob = await put(blobPath, JSON.stringify(value), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
          });
          
          console.log(`[POST] Successfully saved ${blobPath}`);
          return res.status(200).json({ 
            success: true, 
            url: blob.url
          });
        } catch (error) {
          console.error(`[POST] Error saving ${blobPath}:`, error);
          return res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message 
          });
        }
      }
      
      case 'DELETE': {
        try {
          await del(blobPath);
          console.log(`[DELETE] Successfully deleted ${blobPath}`);
          return res.status(200).json({ success: true });
        } catch (error) {
          console.log(`[DELETE] Blob ${blobPath} may not exist:`, error.message);
          return res.status(200).json({ success: true });
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