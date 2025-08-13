// src/index.js

// Load environment variables FIRST. This MUST be the very first line.
require('dotenv').config();

// --- Sanity Check: Add this block to debug ---
console.log('--- Checking Environment Variables ---');
console.log(`SNYK_API_KEY: ${process.env.SNYK_API_KEY}`);
console.log(`SNYK_ORG_ID: ${process.env.SNYK_ORG_ID}`);
console.log('------------------------------------');
// --- End of Sanity Check ---

/**
 * SnykAudit - Main Application Entry Point
 * * This file initializes and starts the SnykAudit chatbot, connecting all components
 * and providing the main application lifecycle management.
 */

// Import dependencies
const express = require('express');
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
    
    // Check for required configuration
    if (!config.apiKey) {
      logger.warn('No API key configured. Some features may not work properly.');
    }
    
    if (!config.orgId) {
      logger.warn('No organization ID configured. Some features may not work properly.');
    }
    
    // Create Express application
    const app = express();
    
    // Set up basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Add health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        version: process.env.npm_package_version || '0.1.0'
      });
    });
    
    // Add configuration endpoint
    app.post('/config', authenticateConfigEndpoint, async (req, res) => {
      try {
        const updates = req.body;
        
        logger.info('Updating configuration', { 
          updates: Object.keys(updates)
        });
        
        await configManager.update(updates);
        
        res.status(200).json({ 
          message: 'Configuration updated successfully',
          updatedFields: Object.keys(updates)
        });
      } catch (error) {
        logger.error('Error updating configuration', error);
        res.status(500).json({ 
          error: 'Failed to update configuration',
          message: error.message
        });
      }
    });
    
    // Initialize components based on configuration
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
    
    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
    
    // Initialize Slack if enabled
    if (ENABLE_SLACK) {
      try {
        logger.info('Initializing Slack integration...');
        
        // Check for required Slack credentials
        if (!process.env.SLACK_BOT_TOKEN) {
          throw new Error('SLACK_BOT_TOKEN is required for Slack integration');
        }
        
        const slackIntegration = new SlackIntegration({
          apiKey: config.apiKey,
          slackToken: process.env.SLACK_BOT_TOKEN,
          slackSigningSecret: process.env.SLACK_SIGNING_SECRET,
          slackAppToken: process.env.SLACK_APP_TOKEN
        });
        
        const slackInitialized = await slackIntegration.init(config.apiKey, {
          orgId: config.orgId,
          defaultDays: config.defaultDays,
          businessHoursStart: config.businessHoursStart,
          businessHoursEnd: config.businessHoursEnd
        });
        
        if (slackInitialized) {
          logger.info('Slack integration initialized successfully');
          await slackIntegration.start(PORT);
        } else {
          logger.error('Failed to initialize Slack integration');
        }
      } catch (error) {
        logger.error('Error initializing Slack integration', error);
      }
    }
    
    // Handle application shutdown
    setupGracefulShutdown(server);
    
    logger.info('SnykAudit application started successfully');
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

/**
 * Authenticate requests to the configuration endpoint
 */
function authenticateConfigEndpoint(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (token !== process.env.CONFIG_API_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
  
  next();
}

/**
 * Set up graceful shutdown
 */
function setupGracefulShutdown(server) {
  // Handle SIGTERM (e.g., from Docker, Kubernetes)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    gracefulShutdown(server);
  });
  
  // Handle SIGINT (e.g., Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    gracefulShutdown(server);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    gracefulShutdown(server);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason });
    gracefulShutdown(server);
  });
}

/**
 * Perform graceful shutdown
 */
function gracefulShutdown(server) {
  logger.info('Closing HTTP server...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Allow some time for final operations to complete
    setTimeout(() => {
      logger.info('Exiting process');
      process.exit(0);
    }, 1000);
  });
  
  // Force shutdown after timeout if server doesn't close quickly
  setTimeout(() => {
    logger.warn('Forcing process exit after timeout');
    process.exit(1);
  }, 10000);
}

// Start the application if this file is run directly
if (require.main === module) {
  startApp().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

// Export for testing or programmatic usage
module.exports = { startApp };