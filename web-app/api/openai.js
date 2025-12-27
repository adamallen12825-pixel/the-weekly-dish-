// OpenAI API Proxy - avoids CORS issues by proxying requests through backend
// This serverless function handles all OpenAI API calls from the frontend

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, max_tokens = 16000, temperature = 0.7, model = 'gpt-4o' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages:', messages);
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('CRITICAL: OPENAI_API_KEY is not set in environment variables!');
      return res.status(500).json({
        error: 'API key not configured. Please set OPENAI_API_KEY in Vercel environment variables.'
      });
    }

    console.log('Sending to OpenAI:', {
      messageCount: messages.length,
      model,
      hasVision: messages.some(m => Array.isArray(m.content))
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature,
        response_format: { type: "json_object" }
      })
    });

    console.log('OpenAI response status:', response.status);
    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API Error:', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    console.log('Success! Returning data to client');
    res.json(data);
  } catch (error) {
    console.error('OpenAI proxy error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
};
