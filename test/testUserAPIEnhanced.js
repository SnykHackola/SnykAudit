// test/testUserAPIEnhanced.js

// Load environment variables
require('dotenv').config();

// Import dependencies
const SnykApiClient = require('../src/api/client');
const { defaultLogger } = require('../src/utils');
const axios = require('axios');

// Create logger
const logger = defaultLogger.child('UserAPITest');

// Get command line arguments
const userId = process.argv[2] || '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86'; // Default test user ID
const orgId = process.env.SNYK_ORG_ID;
const apiKey = process.env.SNYK_API_KEY;

/**
 * Verify API key and environment variables
 */
function verifyEnvironment() {
  console.log('Verifying environment setup...');
  
  if (!apiKey) {
    console.error('❌ SNYK_API_KEY environment variable is not set');
    return false;
  }
  
  if (!orgId) {
    console.error('❌ SNYK_ORG_ID environment variable is not set');
    return false;
  }
  
  console.log('✅ Environment variables are set');
  console.log(`Organization ID: ${orgId}`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  
  return true;
}

/**
 * Test the user API directly with axios
 */
async function testUserAPIDirectly() {
  try {
    console.log('\n=== Testing User API Directly ===');
    console.log(`User ID: ${userId}`);
    
    const endpoint = `https://api.snyk.io/rest/orgs/${orgId}/users/${userId}`;
    console.log(`Endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `token ${apiKey}`,
        'Content-Type': 'application/vnd.api+json'
      },
      params: {
        version: '2024-10-15'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Extract user information
    const userData = response.data;
    const name = userData.data?.attributes?.name || 'No name available';
    const email = userData.data?.attributes?.email || 'No email available';
    const username = userData.data?.attributes?.username || 'No username available';
    const active = userData.data?.attributes?.active || false;
    
    console.log('\n=== User Information ===');
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Active: ${active}`);
    
    // Display formatted user info
    let displayName = name;
    if (email) {
      displayName = name ? `${name} (${email})` : email;
    }
    
    console.log('\n=== Formatted Display Name ===');
    console.log(displayName);
    
    return true;
  } catch (error) {
    console.error('Error testing user API directly:', error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status} ${error.response.statusText}`);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // Check for specific error types
      if (error.response.status === 401) {
        console.error('❌ Authentication failed. Please check your API key.');
      } else if (error.response.status === 403) {
        console.error('❌ Permission denied. Your API key may not have access to this organization.');
      } else if (error.response.status === 404) {
        console.error('❌ User not found. The user ID may be invalid or the user may not be in this organization.');
      }
    } else if (error.request) {
      console.error('❌ No response received from the server. Check your network connection.');
    } else {
      console.error('❌ Error setting up the request:', error.message);
    }
    
    return false;
  }
}

/**
 * Test using the SnykApiClient
 */
async function testWithApiClient() {
  try {
    console.log('\n=== Testing with SnykApiClient ===');
    
    // Initialize API client
    const apiClient = new SnykApiClient(apiKey, {
      baseUrl: 'https://api.snyk.io',
      apiVersion: '2024-10-15'
    });
    
    console.log(`Testing user API endpoint for user ID: ${userId}`);
    
    // Call the user API endpoint
    const userData = await apiClient.getUserById(userId);
    
    console.log('\n=== User API Response via Client ===');
    console.log(JSON.stringify(userData, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error using SnykApiClient:', error.message);
    return false;
  }
}

/**
 * Main function to run all tests
 */
async function runTests() {
  console.log('=== Snyk User API Test ===');
  
  // Verify environment
  if (!verifyEnvironment()) {
    console.error('Environment verification failed. Exiting...');
    process.exit(1);
  }
  
  // Test directly with axios
  const directTestSuccess = await testUserAPIDirectly();
  
  // Test with the API client
  if (directTestSuccess) {
    await testWithApiClient();
  }
}

// Run all tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
