// User count API endpoint
// URL format: /api/users?action=count

const { createClerkClient } = require('@clerk/clerk-sdk-node');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY
    });

    // Get user count from Clerk
    const { totalCount } = await clerkClient.users.getUserList({ limit: 1 });

    res.status(200).json({ count: totalCount });
  } catch (error) {
    console.error('Error getting user count:', error);
    res.status(500).json({ error: error.message, count: 0 });
  }
};
