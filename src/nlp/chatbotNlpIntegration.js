// src/nlp/chatbotNlpIntegration.js

const IntentRecognizer = require('./intentRecognizer');
const EntityExtractor = require('./entityExtractor');
const { SnykChatbotWrapper } = require('../core');

/**
 * NLP Integration for SnykAudit Chatbot
 * 
 * This component integrates the NLP capabilities (intent recognition and
 * entity extraction) with the core chatbot wrapper.
 */
class ChatbotNlpIntegration {
  constructor(config = {}) {
    this.intentRecognizer = new IntentRecognizer();
    this.entityExtractor = new EntityExtractor();
    this.chatbotWrapper = new SnykChatbotWrapper();
    this.config = config;
    this.initialized = false;
    
    // Confidence threshold for accepting intents
    this.confidenceThreshold = config.confidenceThreshold || 0.3;
    
    // Define fallback responses for low confidence or failed processing
    this.fallbackResponses = [
      "I'm not sure I understand. Could you rephrase your question about Snyk audit logs?",
      "I'm having trouble understanding that. Try asking about security events, user activity, or suspicious behavior.",
      "I didn't quite catch that. You can ask me things like 'Show me recent security events' or 'Any suspicious activity lately?'",
      "I'm not sure how to help with that. You can ask about security events, user activity, or type 'help' for more options."
    ];
  }

  /**
   * Initialize the NLP integration
   * @param {string} apiKey - Snyk API key
   * @param {Object} config - Configuration options
   * @returns {Promise<boolean>} - Success status
   */
  async init(apiKey, config = {}) {
    try {
      // Initialize the chatbot wrapper
      const success = await this.chatbotWrapper.init(apiKey, {
        ...this.config,
        ...config
      });
      
      this.initialized = success;
      return success;
    } catch (error) {
      console.error('Failed to initialize NLP integration:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Process a user message
   * @param {string} message - User message text
   * @param {Object} context - Conversation context (optional)
   * @returns {Promise<Object>} - Chatbot response
   */
  async processMessage(message, context = {}) {
    // Ensure we're initialized
    if (!this.initialized) {
      try {
        const success = await this.init(this.config.apiKey, this.config);
        if (!success) {
          return this._createErrorResponse("I'm having trouble connecting to Snyk. Please check the API configuration.");
        }
      } catch (error) {
        return this._createErrorResponse(`Initialization error: ${error.message}`);
      }
    }
    
    try {
      // Recognize intent from message
      const intentResult = this.intentRecognizer.recognizeIntent(message);
      
      // Extract entities from message
      const entities = this.entityExtractor.extractEntities(message);
      
      // Enhance context with NLP information
      const enhancedContext = {
        ...context,
        nlp: {
          originalMessage: message,
          confidence: intentResult.confidence,
          rawEntities: { ...entities }
        }
      };
      
      // If confidence is too low, use fallback handling
      if (intentResult.confidence < this.confidenceThreshold) {
        return this._handleLowConfidence(message, intentResult, enhancedContext);
      }
      
      // Process with the chatbot wrapper
      const response = await this.chatbotWrapper.handleRequest(
        intentResult.intent,
        entities,
        enhancedContext
      );
      
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return this._createErrorResponse(`Sorry, I encountered an error: ${error.message}`);
    }
  }

  /**
   * Handle low confidence intents
   * @param {string} message - Original user message
   * @param {Object} intentResult - Intent recognition result
   * @param {Object} context - Enhanced context
   * @returns {Promise<Object>} - Response with clarification or fallback
   * @private
   */
  async _handleLowConfidence(message, intentResult, context) {
    // Check if message contains keywords that might indicate a question
    const questionIndicators = ['what', 'how', 'when', 'who', 'why', 'where', 'which', 'show', 'tell', 'find'];
    const hasQuestionIndicator = questionIndicators.some(indicator => 
      message.toLowerCase().includes(indicator)
    );
    
    // If it seems like a question, try the best guess intent with a caveat
    if (hasQuestionIndicator && intentResult.confidence >= 0.2) {
      // Try processing with best guess intent but lower confidence threshold
      try {
        const response = await this.chatbotWrapper.handleRequest(
          intentResult.intent,
          context.nlp.rawEntities,
          context
        );
        
        // Add a clarification note to the response
        response.message = `I'm not entirely sure, but here's what I found:\n\n${response.message}`;
        response.clarification = true;
        
        return response;
      } catch (error) {
        // Fall back to default handling if this fails
        console.warn('Failed to process low confidence intent:', error);
      }
    }
    
    // Return a fallback response
    return this._createFallbackResponse();
  }

  /**
   * Create an error response
   * @param {string} message - Error message
   * @returns {Object} - Formatted error response
   * @private
   */
  _createErrorResponse(message) {
    return {
      message,
      success: false,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a fallback response
   * @returns {Object} - Formatted fallback response
   * @private
   */
  _createFallbackResponse() {
    // Pick a random fallback response
    const randomIndex = Math.floor(Math.random() * this.fallbackResponses.length);
    const message = this.fallbackResponses[randomIndex];
    
    return {
      message,
      success: true,
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ChatbotNlpIntegration;