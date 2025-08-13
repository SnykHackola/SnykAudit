// test/testUserInfo.js
require('dotenv').config();
const { SnykAuditService } = require('../src/api');
const SecurityEventAnalyzer = require('../src/core/securityEventAnalyzer');
const UserActivityAnalyzer = require('../src/core/userActivityAnalyzer');

// Get API key from environment
const apiKey = process.env.SNYK_API_KEY;
const orgId = process.env.SNYK_ORG_ID;

if (!apiKey) {
  console.error('Error: SNYK_API_KEY environment variable is required');
  process.exit(1);
}

if (!orgId) {
  console.error('Error: SNYK_ORG_ID environment variable is required');
  process.exit(1);
}

async function testUserInfo() {
  try {
    console.log('Initializing Snyk Audit Service...');
    const auditService = new SnykAuditService(apiKey, { orgId });
    
    // Test user lookup directly
    console.log('\n--- Testing direct user lookup with updated endpoint ---');
    
    // Try with a few different user IDs from your audit logs
    const testUserIds = [
      '302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86', // Sample ID from previous tests
      // Add more real user IDs from your audit logs if available
    ];
    
    for (const userId of testUserIds) {
      console.log(`\nLooking up user with ID: ${userId}`);
      
      try {
        const userInfo = await auditService.getUserInfo(userId);
        console.log('User info:', JSON.stringify(userInfo, null, 2));
        console.log(`Display name: ${userInfo.displayName}`);
      } catch (error) {
        console.error(`Error looking up user ${userId}:`, error.message);
      }
    }
    
    // Test with mock data to verify formatting logic
    console.log('\n--- Testing user display formatting with mock data ---');
    
    // Mock the client's getUserById method to return test data
    const originalGetUserById = auditService.client.getUserById;
    auditService.client.getUserById = async (userId) => {
      // Return different mock data based on the userId to test different scenarios
      if (userId === 'user-with-name-email') {
        return { id: userId, name: 'John Doe', email: 'john@example.com' };
      } else if (userId === 'user-with-name-only') {
        return { id: userId, name: 'Jane Smith' };
      } else if (userId === 'user-with-email-only') {
        return { id: userId, email: 'anonymous@example.com' };
      } else {
        return { id: userId };
      }
    };
    
    // Test different scenarios
    const testScenarios = [
      { id: 'user-with-name-email', expected: 'John Doe (john@example.com)' },
      { id: 'user-with-name-only', expected: 'Jane Smith' },
      { id: 'user-with-email-only', expected: 'anonymous@example.com' },
      { id: 'user-with-nothing', expected: `user ${('user-with-nothing').substring(0, 8)}` }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\nTesting scenario: ${scenario.id}`);
      const userInfo = await auditService.getUserInfo(scenario.id);
      console.log('User info:', JSON.stringify(userInfo, null, 2));
      
      const formattedUser = await auditService.formatUserDisplay(scenario.id);
      console.log(`Formatted user display: ${formattedUser}`);
      console.log(`Expected: ${scenario.expected}`);
      console.log(`Match: ${formattedUser === scenario.expected ? 'YES ✅' : 'NO ❌'}`);
    }
    
    // Restore original method
    auditService.client.getUserById = originalGetUserById;
    
    // Test security event analyzer with user info
    console.log('\n--- Testing security event analyzer with user info ---');
    const securityEventAnalyzer = new SecurityEventAnalyzer(auditService);
    
    // Get some security events
    console.log('Fetching security events...');
    const events = await auditService.getSecurityEvents(7); // Last 7 days
    console.log(`Found ${events.length} security events`);
    
    if (events.length > 0) {
      // Test a single event's user formatting
      const sampleEvent = events[0];
      const userId = sampleEvent.content?.user_id || sampleEvent.content?.performed_by;
      
      if (userId) {
        console.log(`\nSample event user ID: ${userId}`);
        const formattedEventUser = await securityEventAnalyzer._formatUser(userId);
        console.log(`Formatted event user: ${formattedEventUser}`);
      } else {
        console.log('No user ID found in the sample event');
      }
      
      // Test full security event analysis
      console.log('\n--- Testing full security event analysis ---');
      const categorizedEvents = await securityEventAnalyzer.categorizeSecurityEvents(events);
      const summary = await securityEventAnalyzer.generateSecuritySummary(categorizedEvents, 7);
      
      console.log('\nSecurity Events Summary:');
      console.log(summary);
    }
    
    // Test user activity analyzer
    console.log('\n--- Testing user activity analyzer with enhanced user info ---');
    const userActivityAnalyzer = new UserActivityAnalyzer(auditService);
    
    // Get user activity
    console.log('Fetching user activity...');
    const userActivity = await auditService.getUserActivity(null, 7); // Last 7 days
    console.log(`Found ${userActivity.length} user activity events`);
    
    if (userActivity.length > 0) {
      const analysis = await userActivityAnalyzer.analyzeUserActivity(userActivity);
      const summary = await userActivityAnalyzer.generateUserActivitySummary(analysis, null, 7);
      
      console.log('\nUser Activity Summary:');
      console.log(summary);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testUserInfo().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
