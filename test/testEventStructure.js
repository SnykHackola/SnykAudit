// Test script to examine the structure of real security events
require('dotenv').config();
const SnykAuditService = require('../src/api/service');

async function main() {
  console.log('Initializing Snyk Audit Service...');
  const auditService = new SnykAuditService();
  console.log('Snyk Audit Service initialized');

  try {
    // Get real security events
    console.log('\n--- Examining real security events structure ---');
    const realEvents = await auditService.getSecurityEvents(7);
    console.log(`Retrieved ${realEvents.length} real security events`);
    
    if (realEvents.length > 0) {
      // Output the first event structure
      console.log('\nFirst event structure:');
      console.log(JSON.stringify(realEvents[0], null, 2));
      
      // Output the user ID fields specifically
      console.log('\nUser ID fields:');
      console.log('event.user_id:', realEvents[0].user_id);
      console.log('event.content.user_id:', realEvents[0].content?.user_id);
      console.log('event.content.performed_by:', realEvents[0].content?.performed_by);
      
      // Test user info retrieval for this event
      const userId = realEvents[0].content?.user_id || realEvents[0].content?.performed_by || realEvents[0].user_id;
      if (userId) {
        console.log('\nTesting user info retrieval for user ID:', userId);
        const userInfo = await auditService.getUserInfo(userId);
        console.log('User info:', JSON.stringify(userInfo, null, 2));
      } else {
        console.log('\nNo user ID found in the event');
      }
    }
  } catch (error) {
    console.error('Error examining events:', error);
  }
}

main().catch(console.error);
