const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('Testing Claude API endpoint...');

    const response = await fetch('https://weekly-dish-api.vercel.app/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Say hello in one word' }
        ],
        max_tokens: 100
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();
