// test/testUserAPI.js

// Load environment variables
require('dotenv').config();

// Import dependencies
const SnykApiClient = require('../src/api/client');
const { defaultLogger } = require('../src/utils');

// Create logger
const logger = defaultLogger.child('UserAPITest');

// User ID to test (can be passed as command line argument)
const userId = process.argv[2] || '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86'; // Default test user ID

/**
 * Main function to test user API
 */
async function testUserAPI() {
  try {
    console.log('Initializing Snyk API client...');
    
    // Initialize API client
    const apiClient = new SnykApiClient(process.env.SNYK_API_KEY, {
      baseUrl: 'https://api.snyk.io',
      apiVersion: '2024-10-15'
    });
    
    console.log(`Testing user API endpoint for user ID: ${userId}`);
    console.log('API Endpoint: /orgs/{org_id}/users/{id}');
    
    // Call the user API endpoint
    const userData = await apiClient.getUserById(userId);
    
    console.log('\n=== User API Response ===');
    console.log(JSON.stringify(userData, null, 2));
    
    // Extract and display user information
    const name = userData.data?.attributes?.name || 'No name available';
    const email = userData.data?.attributes?.email || 'No email available';
    const active = userData.data?.attributes?.active || false;
    const username = userData.data?.attributes?.username || 'No username available';
    
    console.log('\n=== User Information ===');
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Active: ${active}`);
    
    // Display formatted user info as it would appear in the audit logs
    let displayName = name;
    if (email) {
      displayName = name ? `${name} (${email})` : email;
    }
    
    console.log('\n=== Formatted Display Name ===');
    console.log(displayName);
    
  } catch (error) {
    console.error('Error testing user API:', error.message);
    if (error.response) {
      console.error('API Error Status:', error.response.status);
      console.error('API Error Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testUserAPI().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
