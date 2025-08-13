// src/index.js

// Load environment variables FIRST.
require('dotenv').config();

// Import dependencies
const express = require('express');
const cors = require('cors'); // Import cors
const path = require('path'); // Import path
const { WebhookHandler, SlackIntegration } = require('./platform');
const { ConfigManager } = require('./config');
const { defaultLogger } = require('./utils');

// Create logger for main application
const logger = defaultLogger.child('App');

// Configuration constants
const PORT = process.env.PORT || 3000;
const ENABLE_WEBHOOK = process.env.ENABLE_WEBHOOK !== 'false';
const ENABLE_SLACK = process.env.ENABLE_SLACK === 'true';

/**
 * Initialize and start the application
 */
async function startApp() {
  try {
    logger.info('Starting SnykAudit application...');
    
    // Load configuration
    const configManager = new ConfigManager();
    const config = await configManager.getConfig();
    
    // Create Express application
    const app = express();
    
    // --- NEW: Add CORS middleware ---
    // This allows the frontend to make requests to the backend
    app.use(cors());
    
    // Set up basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // --- NEW: Serve static files from the 'public' directory ---
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        version: process.env.npm_package_version || '0.1.0'
      });
    });
    
    // Initialize webhook handler if enabled
    if (ENABLE_WEBHOOK) {
      logger.info('Initializing webhook handler...');
      
      const webhookHandler = new WebhookHandler({
        apiKey: config.apiKey,
        authToken: process.env.WEBHOOK_AUTH_TOKEN
      });
      
      const webhookInitialized = await webhookHandler.init(config.apiKey, {
        orgId: config.orgId,
        defaultDays: config.defaultDays,
        businessHoursStart: config.businessHoursStart,
        businessHoursEnd: config.businessHoursEnd
      });
      
      if (webhookInitialized) {
        logger.info('Webhook handler initialized successfully');
        app.use('/webhook', webhookHandler.getRouter());
      } else {
        logger.error('Failed to initialize webhook handler');
      }
    }

    // --- NEW: Route to serve the main HTML file ---
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });
    
    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Chatbot UI available at http://localhost:${PORT}`);
    });
    
    // (Slack and shutdown logic remains the same)
    // ...
    
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

// (Other functions remain the same)
// ...

// Start the application
if (require.main === module) {
  startApp().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = { startApp };
