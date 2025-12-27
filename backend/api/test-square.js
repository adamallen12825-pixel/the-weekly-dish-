// Test Square SDK import
try {
  const { SquareClient } = require('square');
  
  const squareClient = new SquareClient({
    accessToken: 'EAAAl_gjswwijO3w7XKHmIXQrb0fzioVw9lhpnQepe_NKScpq1Ex9K5n7rDitfj9',
    environment: 'sandbox'
  });
  
  console.log('✅ Square client initialized successfully!');
  console.log('Client APIs available:', Object.keys(squareClient));
} catch (error) {
  console.error('❌ Error initializing Square:', error.message);
}