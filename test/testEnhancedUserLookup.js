/**
 * Test script for enhanced user lookup functionality in the Snyk Audit chatbot
 * This script tests the improved user name lookup with better error messages
 */

require('dotenv').config();
const SnykAuditService = require('../src/api/service');
const UserActivityAnalyzer = require('../src/core/userActivityAnalyzer');
const EntityExtractor = require('../src/nlp/entityExtractor');

// Test the direct UserActivityAnalyzer functionality
async function testUserActivityAnalyzer() {
  console.log('\n=== Testing UserActivityAnalyzer with Enhanced User Lookup ===\n');
  
  // Create a service instance with the API key and org ID from environment variables
  const config = {
    apiKey: process.env.SNYK_API_KEY,
    orgId: process.env.SNYK_ORG_ID,
    defaultDays: 7
  };
  
  console.log(`Using organization ID: ${config.orgId}`);
  const service = new SnykAuditService(config);
  
  // Create an analyzer instance with the service and config
  const analyzer = new UserActivityAnalyzer(service);
  
  // Manually set the orgId in the analyzer for testing
  analyzer.orgId = config.orgId;
  
  // Test user names to look up
  const testUsers = ['Cesar', 'NonExistentUser', 'TestUser'];
  
  for (const userName of testUsers) {
    console.log(`\n--- Testing user lookup for: ${userName} ---`);
    
    try {
      // Empty events array to simulate no activity
      const events = [];
      
      // Analyze user activity
      console.log(`Analyzing user activity for: ${userName}`);
      const userActivity = await analyzer.analyzeUserActivity(events, userName);
      
      // Log the analysis results
      console.log('Analysis results:');
      console.log(`- Known user: ${userActivity.knownUser}`);
      console.log(`- Org users available: ${userActivity.orgUsersAvailable}`);
      console.log(`- Total actions: ${userActivity.totalActions || 0}`);
      console.log(`- All org users count: ${userActivity.allOrgUsers ? userActivity.allOrgUsers.length : 0}`);
      
      // Display API error type if available
      if (userActivity.apiErrorType) {
        console.log(`- API error: ${userActivity.apiErrorType}`);
      }
      
      // Generate a summary message
      console.log('\nGenerating user activity summary...');
      const message = await analyzer.generateUserActivitySummary(userActivity, userName);
      
      // Display the generated message
      console.log('Generated message:');
      console.log('------------------');
      console.log(message);
      console.log('------------------');
      
      // Check if the message includes API error information
      if (message.includes('Detected issue:')) {
        console.log('\nAPI error information detected in message ✓');
      }
    } catch (error) {
      console.error(`Error analyzing user activity for ${userName}:`, error);
    }
  }
}

// Direct test of the UserActivityAnalyzer with empty organization users list
async function testEmptyOrgUsersList() {
  console.log('\n========================================');
  console.log('Testing direct UserActivityAnalyzer with empty org users list');
  console.log('========================================');
  
  try {
    // Create a service instance
    const config = {
      apiKey: process.env.SNYK_API_KEY,
      orgId: process.env.SNYK_ORG_ID,
      defaultDays: 7
    };
    
    console.log(`Using organization ID: ${config.orgId}`);
    const service = new SnykAuditService(config);
    
    // Create an analyzer instance with the service and config
    const analyzer = new UserActivityAnalyzer(service);
    
    // Manually set the orgId in the analyzer for testing
    analyzer.orgId = config.orgId;
    
    // Test with an empty events array and a user name
    const events = [];
    const userId = 'TestUser';
    
    console.log(`Analyzing user activity for: ${userId} with empty events`);
    const userActivity = await analyzer.analyzeUserActivity(events, userId);
    
    console.log('User activity analysis result:');
    console.log('- Known user:', userActivity.knownUser);
    console.log('- Org users available:', userActivity.orgUsersAvailable);
    console.log('- Total actions:', userActivity.totalActions);
    
    // Display API error type if available
    if (userActivity.apiErrorType) {
      console.log('- API error:', userActivity.apiErrorType);
    }
    
    // Generate a summary message
    const message = await analyzer.generateUserActivitySummary(userActivity, userId);
    
    console.log('\nGenerated message:');
    console.log('------------------');
    console.log(message);
    console.log('------------------');
    
    // Check if the message includes API error information
    if (message.includes('Detected issue:')) {
      console.log('\nAPI error information detected in message ✓');
    }
    
    return message;
  } catch (error) {
    console.error('Error in direct analyzer test:', error);
    return null;
  }
}

// Run all tests
async function runTests() {
  try {
    // Test the UserActivityAnalyzer directly
    await testUserActivityAnalyzer();
    
    // Test with empty org users list
    await testEmptyOrgUsersList();
    
    console.log('\nAll tests completed');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();
