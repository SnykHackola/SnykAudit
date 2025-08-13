// test/testEnhancedAudit.js
require('dotenv').config();
const SnykAuditService = require('../src/api/service');
const SecurityEventAnalyzer = require('../src/core/securityEventAnalyzer');
const UserActivityAnalyzer = require('../src/core/userActivityAnalyzer');

// Test the enhanced audit functionality
async function testEnhancedAudit() {
  console.log('Initializing Snyk Audit Service...');
  const auditService = new SnykAuditService(process.env.SNYK_API_KEY, {
    orgId: process.env.SNYK_ORG_ID
  });
  console.log('Snyk Audit Service initialized');
  
  // Create analyzers with audit service
  const securityEventAnalyzer = new SecurityEventAnalyzer(auditService);
  const userActivityAnalyzer = new UserActivityAnalyzer(auditService);
  
  // Test with sample SAST settings event
  const sampleSastEvent = {
    event: 'org.sast_settings.edit',
    created: new Date().toISOString(),
    user_id: '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86',
    content: {
      user_id: '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86',
      performed_by: '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86',
      changes: {
        sastEnabled: {
          from: false,
          to: true
        },
        sastPullRequestEnabled: {
          from: false,
          to: true
        },
        sastSeverityThreshold: {
          from: 'medium',
          to: 'high'
        }
      },
      before: {
        sastSettings: {
          sastEnabled: false,
          sastPullRequestEnabled: false,
          sastSeverityThreshold: 'medium'
        }
      },
      after: {
        sastSettings: {
          sastEnabled: true,
          sastPullRequestEnabled: true,
          sastSeverityThreshold: 'high'
        }
      }
    }
  };
  
  // Test SAST settings changes display
  console.log('\n--- Testing enhanced SAST settings changes display ---');
  const sastEvents = [sampleSastEvent];
  const securitySummary = await securityEventAnalyzer.generateSecuritySummary({ all: sastEvents, highPriority: [], mediumPriority: [], lowPriority: sastEvents }, 7);
  console.log('Security Events Summary:');
  console.log(securitySummary);
  
  // Test fetching real security events
  console.log('\n--- Testing with real security events ---');
  try {
    const realEvents = await auditService.getSecurityEvents(7);
    console.log(`Retrieved ${realEvents.length} real security events`);
    
    if (realEvents.length > 0) {
      // Examine the structure of the first event
      console.log('\nFirst security event structure:');
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
      
      // Continue with normal analysis
      const analysis = await securityEventAnalyzer.categorizeSecurityEvents(realEvents);
      const realSummary = await securityEventAnalyzer.generateSecuritySummary(analysis, 7);
      console.log('\nReal Security Events Summary:');
      console.log(realSummary);
    }
  } catch (error) {
    console.error('Error fetching real security events:', error.message);
  }
  
  // Test user activity with enhanced user info
  console.log('\n--- Testing user activity with enhanced user info ---');
  try {
    const userActivity = await auditService.getUserActivity(null, 7);
    console.log(`Retrieved ${userActivity.length} user activity events`);
    
    if (userActivity.length > 0) {
      const analysis = await userActivityAnalyzer.analyzeUserActivity(userActivity);
      const userSummary = await userActivityAnalyzer.generateUserActivitySummary(analysis, null, 7);
      console.log('User Activity Summary:');
      console.log(userSummary);
    }
  } catch (error) {
    console.error('Error fetching user activity:', error.message);
  }
}

// Run the test
testEnhancedAudit().catch(error => {
  console.error('Test failed:', error);
});
