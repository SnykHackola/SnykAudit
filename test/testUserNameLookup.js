// test/testUserNameLookup.js
require('dotenv').config();
const { SnykAuditService } = require('../src/api');
const UserActivityAnalyzer = require('../src/core/userActivityAnalyzer');
const EntityExtractor = require('../src/nlp/entityExtractor');

async function testUserNameLookup() {
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
  
  // Initialize entity extractor
  const entityExtractor = new EntityExtractor();
  
  // Test entity extraction for user names
  console.log('\n--- Testing entity extraction for user names ---');
  const testQueries = [
    "What has Cesar been doing?",
    "Show me Cesar's activity",
    "What did Cesar do yesterday?",
    "Show Cesar",
    "Tell me about Cesar"
  ];
  
  testQueries.forEach(query => {
    const entities = entityExtractor.extractEntities(query);
    console.log(`Query: "${query}"`);
    console.log(`Extracted entities:`, entities);
  });
  
  // Test user activity lookup by name
  console.log('\n--- Testing user activity lookup by name ---');
  
  // Fetch events from the last 7 days
  const days = 7;
  console.log(`Fetching events from ${days} days ago...`);
  const events = await auditService.getUserActivity(null, days);
  console.log(`Retrieved ${events.length} events`);
  
  // Test 1: Lookup with valid name "Cesar"
  const validUserName = "Cesar";
  console.log(`\nTest 1: Looking up user activity for valid name: ${validUserName}`);
  const userActivity = await userActivityAnalyzer.analyzeUserActivity(events, validUserName);
  
  if (userActivity.totalActions && userActivity.totalActions > 0) {
    console.log(`Found ${userActivity.totalActions} actions for user ${validUserName}`);
    
    // Generate summary
    const summary = await userActivityAnalyzer.generateUserActivitySummary(userActivity, validUserName, days);
    console.log('\nUser Activity Summary:');
    console.log(summary);
  } else if (userActivity.knownUser === true) {
    console.log(`User ${validUserName} is known but has no activity`);
    const summary = await userActivityAnalyzer.generateUserActivitySummary(userActivity, validUserName, days);
    console.log('\nUser Activity Summary:');
    console.log(summary);
  } else {
    console.log(`No activity found for user ${validUserName}`);
  }
  
  // Test 2: Lookup with invalid name "NonExistentUser"
  const invalidUserName = "NonExistentUser";
  console.log(`\nTest 2: Looking up user activity for invalid name: ${invalidUserName}`);
  const invalidUserActivity = await userActivityAnalyzer.analyzeUserActivity(events, invalidUserName);
  
  // Generate summary for invalid user
  const invalidSummary = await userActivityAnalyzer.generateUserActivitySummary(invalidUserActivity, invalidUserName, days);
  console.log('\nInvalid User Activity Summary:');
  console.log(invalidSummary);
  
  // Test 3: Test with a known user ID
  console.log('\n--- Test 3: Testing with known user ID ---');
  const knownUserId = "302ba9f1-b8a4-4a9a-9be4-a31b36ac5c86"; // Cesar's ID from previous tests
  const userInfo = await auditService.getUserInfo(knownUserId);
  console.log(`User info for ID ${knownUserId}:`, userInfo);
  
  // Test 4: Test getting all organization users
  console.log('\n--- Test 4: Getting all organization users ---');
  try {
    const orgUsers = await auditService.getAllOrgUsers();
    console.log(`Retrieved ${orgUsers.length} users from the organization`);
    
    // Display the first 5 users (or all if less than 5)
    const usersToShow = Math.min(5, orgUsers.length);
    console.log(`\nShowing ${usersToShow} users:`);
    for (let i = 0; i < usersToShow; i++) {
      console.log(`- ${orgUsers[i].name || 'Unnamed'} (ID: ${orgUsers[i].id})`);
    }
  } catch (error) {
    console.error('Error getting organization users:', error);
  }
}

testUserNameLookup().catch(error => {
  console.error('Error in test:', error);
});
