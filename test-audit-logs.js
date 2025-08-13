// test-audit-logs.js
require('dotenv').config();
const SnykApiClient = require('./src/api/client');

// Get API key and org ID from environment variables
const apiKey = process.env.SNYK_API_KEY;
const orgId = process.env.SNYK_ORG_ID;

// Create a new client instance
const client = new SnykApiClient(apiKey);

// Function to test audit logs with minimal filtering
async function testAllAuditLogs() {
  try {
    console.log(`Testing all audit logs for organization: ${orgId}`);
    
    // Calculate date 30 days ago (to get a broader timeframe)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Format date as ISO string
    const fromDate = thirtyDaysAgo.toISOString();
    console.log(`Looking for events from: ${fromDate}`);
    
    // Call the API directly with minimal parameters
    const response = await client.searchOrgAuditLogs(orgId, {
      from_date: fromDate
      // No event filters, no other parameters
    });
    
    // Log the structure of the response to understand its format
    console.log('API Response structure:', Object.keys(response));
    
    // Check if the data is in the expected format
    if (response.data && Array.isArray(response.data.data)) {
      console.log(`Found ${response.data.data.length} audit log entries`);
      
      if (response.data.data.length > 0) {
        console.log('\nSample audit log entries:');
        response.data.data.slice(0, 5).forEach((entry, index) => {
          console.log(`\n--- Entry ${index + 1} ---`);
          console.log(`Event: ${entry.attributes?.event || 'Unknown event'}`);
          console.log(`Created: ${entry.attributes?.created || 'Unknown date'}`);
          console.log(`Content: ${JSON.stringify(entry.attributes?.content || {})}`);
        });
      }
    } else {
      // Log the full response to debug
      console.log('Full API Response:', JSON.stringify(response, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing audit logs:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAllAuditLogs();
