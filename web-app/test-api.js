// Test script for API endpoints
const testUserId = 'test-user-123';
const testKey = 'profile';
const testData = { 
  name: 'Test User', 
  budget: 100,
  adults: 2,
  kids: 1 
};

const baseUrl = 'http://localhost:3000/api';

async function testAPI() {
  console.log('Testing API endpoints...\n');
  
  // Test POST (save data)
  console.log('1. Testing POST (save data)...');
  try {
    const postResponse = await fetch(`${baseUrl}/kv/${testUserId}/${testKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: testData })
    });
    
    const postResult = await postResponse.json();
    console.log('POST Response:', postResult);
    console.log('POST Status:', postResponse.status);
  } catch (error) {
    console.error('POST Error:', error.message);
  }
  
  // Test GET (retrieve data)
  console.log('\n2. Testing GET (retrieve data)...');
  try {
    const getResponse = await fetch(`${baseUrl}/kv/${testUserId}/${testKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const getData = await getResponse.json();
    console.log('GET Response:', getData);
    console.log('GET Status:', getResponse.status);
  } catch (error) {
    console.error('GET Error:', error.message);
  }
  
  // Test DELETE
  console.log('\n3. Testing DELETE...');
  try {
    const deleteResponse = await fetch(`${baseUrl}/kv/${testUserId}/${testKey}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const deleteResult = await deleteResponse.json();
    console.log('DELETE Response:', deleteResult);
    console.log('DELETE Status:', deleteResponse.status);
  } catch (error) {
    console.error('DELETE Error:', error.message);
  }
}

// Check if running in Node.js
if (typeof window === 'undefined') {
  // Running in Node.js - use node-fetch
  const fetch = require('node-fetch');
  global.fetch = fetch;
}

testAPI();