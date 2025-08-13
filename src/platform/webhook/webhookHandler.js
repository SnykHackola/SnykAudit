// src/platforms/webhook/webhookHandler.js

const express = require('express');
const { ChatbotNlpIntegration } = require('../../nlp');

/**
 * Webhook Handler for SnykAudit Chatbot
 * 
 * This component provides an HTTP webhook interface to interact with the chatbot.
 * It handles incoming webhook requests, validates them, and processes messages
 * using the NLP integration.
 */
class WebhookHandler {
  /**
   * Create a webhook handler
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.router = express.Router();
    this.nlpIntegration = new ChatbotNlpIntegration(config);
    this.apiKey = config.apiKey;
    this.authToken = config.authToken;
    this.requireAuth = !!this.authToken;
    
    this._setupRoutes();
  }

  /**
   * Initialize the webhook handler
   * @param {string} apiKey - Snyk API key
   * @param {Object} config - Additional configuration
   * @returns {Promise<boolean>} - Success status
   */
  async init(apiKey, config = {}) {
    try {
      this.apiKey = apiKey || this.apiKey;
      
      if (!this.apiKey) {
        console.error('Webhook handler initialization failed: No API key provided');
        return false;
      }
      
      const success = await this.nlpIntegration.init(this.apiKey, config);
      return success;
    } catch (error) {
      console.error('Webhook handler initialization failed:', error);
      return false;
    }
  }

  /**
   * Get the Express router for this webhook handler
   * @returns {express.Router} - Express router
   */
  getRouter() {
    return this.router;
  }

  /**
   * Set up webhook routes
   * @private
   */
  _setupRoutes() {
    // Main webhook endpoint
    this.router.post('/', async (req, res) => {
      try {
        // Check authentication if required
        if (this.requireAuth) {
          const authHeader = req.headers.authorization;
          
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
              error: 'Unauthorized: Missing or invalid authorization header',
              success: false
            });
          }
          
          const token = authHeader.split(' ')[1];
          
          if (token !== this.authToken) {
            return res.status(403).json({
              error: 'Forbidden: Invalid authentication token',
              success: false
            });
          }
        }
        
        // Validate request body
        const { message, context } = req.body;
        
        if (!message || typeof message !== 'string') {
          return res.status(400).json({
            error: 'Bad request: Message is required and must be a string',
            success: false
          });
        }
        
        // Process the message
        const response = await this.nlpIntegration.processMessage(
          message,
          context || {}
        );
        
        // Return response
        res.status(200).json(response);
      } catch (error) {
        console.error('Error processing webhook request:', error);
        
        res.status(500).json({
          error: 'Internal server error: ' + error.message,
          message: 'Sorry, I encountered an error while processing your request.',
          success: false
        });
      }
    });
    
    // Health check endpoint
    this.router.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        initialized: !!this.nlpIntegration.initialized
      });
    });
  }
}

module.exports = WebhookHandler;