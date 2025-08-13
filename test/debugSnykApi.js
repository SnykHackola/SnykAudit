/**
 * Debug script for testing Snyk API endpoints
 * This script attempts to access different Snyk API endpoints to identify
 * which ones are accessible with the current API key and organization ID
 */

require('dotenv').config();
const axios = require('axios');

// Get API key and org ID from environment variables
const SNYK_API_KEY = process.env.SNYK_API_KEY;
const SNYK_ORG_ID = process.env.SNYK_ORG_ID;

if (!SNYK_API_KEY || !SNYK_ORG_ID) {
  console.error('Error: SNYK_API_KEY and SNYK_ORG_ID environment variables must be set');
  process.exit(1);
}

// Create axios instance with common configuration
const api = axios.create({
  baseURL: 'https://api.snyk.io',
  timeout: 15000,
  headers: {
    'Authorization': `token ${SNYK_API_KEY}`,
    'Content-Type': 'application/vnd.api+json'
  }
});

/**
 * Test different API endpoints to find which ones work
 */
async function testApiEndpoints() {
  console.log('Testing Snyk API endpoints...\n');
  console.log(`Using Organization ID: ${SNYK_ORG_ID}\n`);

  const endpoints = [
    // REST API endpoints with different versions
    { url: `/rest/orgs/${SNYK_ORG_ID}/users`, params: { version: '2024-10-15' }, description: 'REST API - Get org users (2024-10-15)' },
    { url: `/rest/orgs/${SNYK_ORG_ID}/users`, params: { version: '2023-08-31' }, description: 'REST API - Get org users (2023-08-31)' },
    { url: `/rest/orgs/${SNYK_ORG_ID}/users`, params: {}, description: 'REST API - Get org users (no version)' },
    
    // V1 API endpoints
    { url: `/api/v1/org/${SNYK_ORG_ID}/members`, params: {}, description: 'V1 API - Get org members' },
    { url: `/api/v1/user`, params: {}, description: 'V1 API - Get current user' },
    
    // Other endpoints that might be useful
    { url: `/rest/orgs/${SNYK_ORG_ID}`, params: { version: '2023-08-31' }, description: 'REST API - Get org details' },
    { url: `/rest/orgs/${SNYK_ORG_ID}/audit_logs`, params: { version: '2023-08-31' }, description: 'REST API - Get audit logs' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint.description}`);
      console.log(`URL: ${endpoint.url}`);
      
      const response = await api.get(endpoint.url, { params: endpoint.params });
      
      console.log(`✅ SUCCESS (${response.status})`);
      console.log('Response data structure:');
      
      if (response.data) {
        if (Array.isArray(response.data.data)) {
          console.log(`Array with ${response.data.data.length} items`);
          if (response.data.data.length > 0) {
            console.log('First item sample:', JSON.stringify(response.data.data[0], null, 2).substring(0, 500) + '...');
          }
        } else if (typeof response.data === 'object') {
          console.log('Object keys:', Object.keys(response.data));
          if (response.data.data) {
            console.log('Data sample:', JSON.stringify(response.data.data, null, 2).substring(0, 500) + '...');
          }
        } else {
          console.log('Unknown data format:', typeof response.data);
        }
      } else {
        console.log('No data returned');
      }
    } catch (error) {
      console.log(`❌ ERROR (${error.response?.status || 'unknown'})`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(`Message: ${error.response.statusText}`);
        if (error.response.data) {
          console.log('Error data:', error.response.data);
        }
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
    console.log('-'.repeat(80) + '\n');
  }
}

// Run the tests
testApiEndpoints().catch(error => {
  console.error('Error running tests:', error);
});
