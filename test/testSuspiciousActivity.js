// test/testSuspiciousActivity.js
require('dotenv').config();
const { SnykAuditService } = require('../src/api');
const AnomalyDetector = require('../src/core/anomalyDetector');

async function testSuspiciousActivity() {
  console.log('Initializing Snyk Audit Service...');
  const apiKey = process.env.SNYK_API_KEY;
  const orgId = process.env.SNYK_ORG_ID;
  
  if (!apiKey || !orgId) {
    console.error('Error: SNYK_API_KEY and SNYK_ORG_ID must be set in .env file');
    process.exit(1);
  }
  
  const auditService = new SnykAuditService(apiKey, { orgId });
  console.log('Snyk Audit Service initialized');
  
  // Initialize anomaly detector with audit service for user lookups
  const anomalyDetector = new AnomalyDetector(auditService);
  
  // Set business hours to make sure we detect after-hours activity
  // Setting business hours to 9 AM - 5 PM
  anomalyDetector.setBusinessHours(9, 17);
  
  console.log('\n--- Testing suspicious activity detection ---');
  
  // Fetch events from the last 7 days
  const days = 7;
  console.log(`Fetching events from ${days} days ago...`);
  const events = await auditService.getAllEvents(days);
  console.log(`Retrieved ${events.length} events`);
  
  // Detect suspicious activities
  console.log('Detecting suspicious activities...');
  const suspiciousActivities = anomalyDetector.detectAnomalies(events);
  console.log(`Detected ${suspiciousActivities.length} suspicious activities`);
  
  // Generate summary
  console.log('\nGenerating suspicious activity summary...');
  const summary = await anomalyDetector.generateSuspiciousActivitySummary(suspiciousActivities, days);
  
  console.log('\nSuspicious Activity Summary:');
  console.log(summary);
  
  // Output the first suspicious activity for inspection
  if (suspiciousActivities.length > 0) {
    console.log('\nFirst suspicious activity details:');
    console.log(JSON.stringify(suspiciousActivities[0], null, 2));
    
    // Test user info retrieval for the user in the first suspicious activity
    const userId = suspiciousActivities[0].user;
    console.log(`\nTesting user info retrieval for user ID: ${userId}`);
    const userInfo = await auditService.getUserInfo(userId);
    console.log('User info:', userInfo);
  }
}

testSuspiciousActivity().catch(error => {
  console.error('Error in test:', error);
});
