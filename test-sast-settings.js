// test-sast-settings.js
require('dotenv').config();
const SnykApiClient = require('./src/api/client');

// Get API key and org ID from environment variables
const apiKey = process.env.SNYK_API_KEY;
const orgId = process.env.SNYK_ORG_ID;

// Create a new client instance
const client = new SnykApiClient(apiKey);

// Function to test specifically for SAST settings changes
async function testSastSettingsChanges() {
  try {
    console.log(`Testing for SAST settings changes in organization: ${orgId}`);
    
    // Calculate date 30 days ago (to get a broader timeframe)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Format date as ISO string
    const fromDate = thirtyDaysAgo.toISOString();
    console.log(`Looking for events from: ${fromDate}`);
    
    // Call the API directly with specific SAST settings event filter
    const response = await client.searchOrgAuditLogs(orgId, {
      from_date: fromDate,
      events: 'org.sast_settings.edit'
    });
    
    console.log('API Response structure:', Object.keys(response));
    
    // Process the response
    if (response.data && Array.isArray(response.data.data)) {
      const sastEvents = response.data.data;
      console.log(`Found ${sastEvents.length} SAST settings change events`);
      
      if (sastEvents.length > 0) {
        console.log('\nSAST settings change events:');
        sastEvents.forEach((entry, index) => {
          console.log(`\n--- Event ${index + 1} ---`);
          console.log(`Event: ${entry.attributes?.event || 'Unknown event'}`);
          console.log(`Created: ${entry.attributes?.created || 'Unknown date'}`);
          console.log(`User ID: ${entry.attributes?.user_id || 'Unknown user'}`);
          console.log(`Content: ${JSON.stringify(entry.attributes?.content || {})}`);
        });
        
        // Check the most recent SAST settings change
        const mostRecent = sastEvents[0];
        if (mostRecent && mostRecent.attributes && mostRecent.attributes.content) {
          console.log('\n--- Most Recent SAST Settings Change ---');
          console.log(`Date: ${mostRecent.attributes.created}`);
          console.log(`Changed by: ${mostRecent.attributes.user_id}`);
          
          // Try to determine if SAST was enabled or disabled
          const content = mostRecent.attributes.content;
          if (content.enabled !== undefined) {
            console.log(`SAST is currently: ${content.enabled ? 'ENABLED' : 'DISABLED'}`);
          } else {
            console.log('Could not determine current SAST status from event data');
          }
        }
      } else {
        console.log('No SAST settings changes found in the specified time period');
      }
    } else {
      console.log('Full API Response:', JSON.stringify(response, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing SAST settings changes:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSastSettingsChanges();
