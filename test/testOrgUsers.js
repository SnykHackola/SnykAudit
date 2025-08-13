// test/testOrgUsers.js
require('dotenv').config();
const { SnykAuditService } = require('../src/api');
const UserActivityAnalyzer = require('../src/core/userActivityAnalyzer');

async function testOrgUsers() {
  console.log('Initializing Snyk Audit Service...');
  const apiKey = process.env.SNYK_API_KEY;
  const orgId = process.env.SNYK_ORG_ID;
  
  if (!apiKey || !orgId) {
    console.error('Error: SNYK_API_KEY and SNYK_ORG_ID must be set in .env file');
    process.exit(1);
  }
  
  const auditService = new SnykAuditService(apiKey, { orgId });
  console.log('Snyk Audit Service initialized');
  
  // Initialize user activity analyzer with audit service
  const userActivityAnalyzer = new UserActivityAnalyzer(auditService);
  
  // Test 1: Get all organization users
  console.log('\n--- Test 1: Getting all organization users ---');
  try {
    const orgUsers = await auditService.getAllOrgUsers();
    console.log(`Retrieved ${orgUsers.length} users from the organization`);
    
    // Display the first 5 users (or all if less than 5)
    const usersToShow = Math.min(5, orgUsers.length);
    console.log(`\nShowing ${usersToShow} users:`);
    for (let i = 0; i < usersToShow; i++) {
      console.log(`- ${orgUsers[i].displayName} (ID: ${orgUsers[i].id})`);
    }
  } catch (error) {
    console.error('Error getting organization users:', error);
  }
  
  // Test 2: Test user activity lookup for a valid user
  console.log('\n--- Test 2: Testing user activity lookup for a valid user ---');
  const validUserName = "Cesar"; // Replace with a known user in your organization
  let events = [];
  
  try {
    // Fetch events from the last 7 days
    const days = 7;
    console.log(`Fetching events from ${days} days ago...`);
    events = await auditService.getUserActivity(null, days);
    console.log(`Retrieved ${events.length} events`);
    
    console.log(`\nLooking up user activity for name: ${validUserName}`);
    const userActivity = await userActivityAnalyzer.analyzeUserActivity(events, validUserName);
    
    if (userActivity) {
      // Generate summary
      const summary = await userActivityAnalyzer.generateUserActivitySummary(userActivity, validUserName, days);
      console.log('\nUser Activity Summary:');
      console.log(summary);
    } else {
      console.log('\nNo user activity data returned');
    }
  } catch (error) {
    console.error(`Error looking up activity for ${validUserName}:`, error);
  }
  
  // Test 3: Test user activity lookup for an invalid user
  console.log('\n--- Test 3: Testing user activity lookup for an invalid user ---');
  const invalidUserName = "NonExistentUser";
  try {
    // Use the events we already fetched
    const days = 7;
    console.log(`\nLooking up user activity for name: ${invalidUserName}`);
    
    if (events.length === 0) {
      console.log('No events available for testing. Skipping this test.');
      return;
    }
    
    const userActivity = await userActivityAnalyzer.analyzeUserActivity(events, invalidUserName);
    
    if (userActivity) {
      // Generate summary
      const summary = await userActivityAnalyzer.generateUserActivitySummary(userActivity, invalidUserName, days);
      console.log('\nUser Activity Summary:');
      console.log(summary);
    } else {
      console.log('\nNo user activity data returned');
    }
  } catch (error) {
    console.error(`Error looking up activity for ${invalidUserName}:`, error);
  }
}

testOrgUsers().catch(error => {
  console.error('Error in test:', error);
});
