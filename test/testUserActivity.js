// test/testUserActivity.js
require('dotenv').config();
const SnykAuditService = require('../src/api/service');
const UserActivityAnalyzer = require('../src/core/userActivityAnalyzer');

// Test user activity with user info integration
async function testUserActivity() {
  console.log('Initializing Snyk Audit Service...');
  const auditService = new SnykAuditService(process.env.SNYK_API_KEY, {
    orgId: process.env.SNYK_ORG_ID
  });
  console.log('Snyk Audit Service initialized');
  
  // Create user activity analyzer with audit service
  const userActivityAnalyzer = new UserActivityAnalyzer(auditService);
  
  // Test with sample events
  const sampleEvents = [
    {
      event: 'org.sast_settings.edit',
      created: new Date().toISOString(),
      content: {
        user_id: '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86',
        performed_by: '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86',
        changes: {
          enabled: {
            from: false,
            to: true
          }
        }
      }
    },
    {
      event: 'org.user.add',
      created: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      content: {
        user_id: '12345678-1234-1234-1234-123456789012',
        performed_by: '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86'
      }
    }
  ];
  
  console.log('\n--- Testing user activity analysis with user info ---');
  const userActivity = await userActivityAnalyzer.analyzeUserActivity(sampleEvents);
  console.log(`Found ${userActivity.userSummaries.length} users in activity`);
  
  console.log('\n--- Testing user activity summary generation ---');
  const summary = await userActivityAnalyzer.generateUserActivitySummary(userActivity, null, 7);
  console.log('User Activity Summary:');
  console.log(summary);
  
  console.log('\n--- Testing specific user activity ---');
  const specificUserId = '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86';
  const specificUserActivity = await userActivityAnalyzer.analyzeUserActivity(sampleEvents, specificUserId);
  const specificSummary = await userActivityAnalyzer.generateUserActivitySummary(specificUserActivity, specificUserId, 7);
  console.log('Specific User Activity Summary:');
  console.log(specificSummary);
}

// Run the test
testUserActivity().catch(error => {
  console.error('Test failed:', error);
});
