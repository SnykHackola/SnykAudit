// test/testChatbotUserLookup.js
require('dotenv').config();
const SnykChatbotWrapper = require('../src/core/snykChatbotWrapper');
const EntityExtractor = require('../src/nlp/entityExtractor');
const { SnykAuditService } = require('../src/api');

async function testChatbotUserLookup() {
  console.log('Initializing Snyk Chatbot...');
  const apiKey = process.env.SNYK_API_KEY;
  const orgId = process.env.SNYK_ORG_ID;
  
  if (!apiKey || !orgId) {
    console.error('Error: SNYK_API_KEY and SNYK_ORG_ID must be set in .env file');
    process.exit(1);
  }
  
  // Initialize services
  const auditService = new SnykAuditService(apiKey, { orgId });
  const chatbot = new SnykChatbotWrapper();
  await chatbot.init(apiKey, { orgId });
  const entityExtractor = new EntityExtractor();
  
  console.log('Chatbot initialized successfully');
  
  // First, let's get all organization users to see what we're working with
  console.log('\n--- Fetching organization users ---');
  try {
    const orgUsers = await auditService.getAllOrgUsers();
    console.log(`Retrieved ${orgUsers.length} users from the organization`);
    
    if (orgUsers.length > 0) {
      console.log('Available users for testing:');
      orgUsers.forEach(user => {
        console.log(`- ${user.name || 'Unnamed'} (${user.email || 'No email'})`);
      });
      
      // Pick a valid user from the list for testing
      const validUser = orgUsers[0].name || 'Cesar';
      console.log(`\nWill use "${validUser}" as a valid user for testing`);
      
      // Test queries for different user lookup scenarios
      const testQueries = [
        `What has ${validUser} been doing?`,
        "Show me activity for NonExistentUser",
        `What did ${validUser} do yesterday?`
      ];
      
      for (const query of testQueries) {
        console.log(`\n\n========================================`);
        console.log(`Testing query: "${query}"`);
        console.log(`========================================`);
        
        // Extract entities from the query
        const entities = entityExtractor.extractEntities(query);
        console.log('Extracted entities:', JSON.stringify(entities, null, 2));
        
        // Determine intent based on entities and query
        let intent = 'user_activity_query';
        if (query.toLowerCase().includes('suspicious') || query.toLowerCase().includes('unusual')) {
          intent = 'suspicious_activity_query';
        } else if (query.toLowerCase().includes('security')) {
          intent = 'security_events_query';
        }
        
        console.log(`Detected intent: ${intent}`);
        
        // Create context with original message
        const context = {
          nlp: {
            originalMessage: query
          }
        };
        
        // Handle the request
        console.log('Sending request to chatbot...');
        const response = await chatbot.handleRequest(intent, entities, context);
        
        // Display the response
        console.log('\nChatbot Response:');
        console.log('------------------');
        console.log(response.message);
        console.log('------------------');
        
        // Check if the response includes user list for invalid user
        if (query.includes('NonExistentUser')) {
          if (response.message.includes('I didn\'t find any user named')) {
            console.log('\n✅ SUCCESS: Chatbot correctly identified invalid user and provided helpful response');
          } else {
            console.log('\n❌ FAILURE: Chatbot did not properly handle invalid user name');
          }
        }
        
        // For time-specific queries, check if the response includes the correct time period
        if (query.includes('yesterday')) {
          if (response.message.includes('1 day')) {
            console.log('\n✅ SUCCESS: Chatbot correctly processed time period');
          } else {
            console.log('\n❌ FAILURE: Chatbot did not properly handle time period');
          }
        }
      }
    } else {
      console.log('No users found in the organization. Using default test queries.');
      runDefaultTests();
    }
  } catch (error) {
    console.error('Error fetching organization users:', error);
    console.log('Falling back to default test queries.');
    await runDefaultTests();
  }
  
  async function runDefaultTests() {
    // Default test queries if we can't get org users
    const testQueries = [
      "What has Cesar been doing?",
      "Show me activity for NonExistentUser",
      "What did Cesar do yesterday?"
    ];
    
    for (const query of testQueries) {
      console.log(`\n\n========================================`);
      console.log(`Testing query: "${query}"`);
      console.log(`========================================`);
      
      const entities = entityExtractor.extractEntities(query);
      console.log('Extracted entities:', JSON.stringify(entities, null, 2));
      
      let intent = 'user_activity_query';
      const context = { nlp: { originalMessage: query } };
      
      console.log('Sending request to chatbot...');
      const response = await chatbot.handleRequest(intent, entities, context);
      
      console.log('\nChatbot Response:');
      console.log('------------------');
      console.log(response.message);
      console.log('------------------');
    }
  }
}

testChatbotUserLookup().catch(error => {
  console.error('Error in test:', error);
});
