// test-webhook.js
require('dotenv').config();
const axios = require('axios');

// Get the webhook auth token from environment variables
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN;

// Function to test the webhook with different queries
async function testWebhook(message) {
  try {
    console.log(`Testing webhook with message: "${message}"`);
    
    const response = await axios.post('http://localhost:3000/webhook', {
      message: message,
      sender: 'test-user',
      channel: 'test-channel'
    }, {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_AUTH_TOKEN}`
      }
    });

    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error testing webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests
async function runTests() {
  console.log('=== Testing SAST Settings Query ===');
  await testWebhook('Has anyone disabled SAST?');
  
  console.log('\n=== Testing User List Query ===');
  await testWebhook('Show me a list of users');
  
  console.log('\n=== Testing Security Events Query ===');
  await testWebhook('Show me recent security events');
}

// Run all tests
runTests();
