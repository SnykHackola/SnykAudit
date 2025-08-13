// src/core/snykChatbotWrapper.js
const { SnykAuditService } = require('../api');
const SecurityEventAnalyzer = require('./securityEventAnalyzer');
const UserActivityAnalyzer = require('./userActivityAnalyzer');
const AnomalyDetector = require('./anomalyDetector');
const ResponseFormatter = require('./responseFormatter');

class SnykChatbotWrapper {
  constructor() {
    this.auditService = null;
    this.securityEventAnalyzer = new SecurityEventAnalyzer();
    this.userActivityAnalyzer = new UserActivityAnalyzer();
    this.anomalyDetector = new AnomalyDetector();
    this.responseFormatter = new ResponseFormatter();
    this.initialized = false;
  }

  /**
   * Initialize the chatbot wrapper with configuration
   * @param {string} apiKey - Snyk API key
   * @param {Object} config - Configuration options
   * @returns {Promise<boolean>} - Success status
   */
  async init(apiKey, config = {}) {
    try {
      // Initialize audit service
      this.auditService = new SnykAuditService(apiKey, config);
      
      // Set business hours for anomaly detection if provided
      if (config.businessHoursStart && config.businessHoursEnd) {
        this.anomalyDetector.setBusinessHours(
          config.businessHoursStart,
          config.businessHoursEnd
        );
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Snyk chatbot wrapper:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if wrapper is initialized
   * @returns {boolean} - Initialization status
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Handle a chatbot request
   * @param {string} intent - Detected intent from NLP
   * @param {Object} entities - Extracted entities from NLP
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - Response for chatbot
   */
  async handleRequest(intent, entities, context) {
    // Ensure we're initialized
    if (!this.initialized) {
      return this.responseFormatter.formatApiResponse({
        message: 'I\'m having trouble connecting to Snyk. Please check the API configuration.',
        success: false
      });
    }
    
    try {
      // Route to appropriate handler based on intent
      switch (intent) {
        case 'security_events_query':
          return await this._handleSecurityEventsQuery(entities, context);
          
        case 'user_activity_query':
          return await this._handleUserActivityQuery(entities, context);
          
        case 'suspicious_activity_query':
          return await this._handleSuspiciousActivityQuery(entities, context);
          
        case 'time_based_query':
          return await this._handleTimeBasedQuery(entities, context);
          
        case 'help_request':
          return this._handleHelpRequest();
          
        default:
          return this.responseFormatter.formatApiResponse({
            message: 'I\'m not sure how to help with that. Try asking about security events, user activity, or suspicious behavior.',
            success: true
          });
      }
    } catch (error) {
      console.error('Error handling chatbot request:', error);
      return this.responseFormatter.formatApiResponse({
        message: `I encountered an error: ${error.message}`,
        success: false
      });
    }
  }

  /**
   * Handle security events query
   * @param {Object} entities - Extracted entities
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - Formatted response
   * @private
   */
  async _handleSecurityEventsQuery(entities, context) {
    // Extract time period from entities or use default
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 7;
    
    // Get security events from audit service
    const events = await this.auditService.getSecurityEvents(days);
    
    // Analyze and categorize the events
    const categorizedEvents = this.securityEventAnalyzer.categorizeSecurityEvents(events);
    
    // Generate summary message
    const message = this.securityEventAnalyzer.generateSecuritySummary(categorizedEvents, days);
    
    return this.responseFormatter.formatApiResponse({
      message,
      data: categorizedEvents,
      success: true
    });
  }

  /**
   * Handle user activity query
   * @param {Object} entities - Extracted entities
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - Formatted response
   * @private
   */
  async _handleUserActivityQuery(entities, context) {
    // Extract user ID and time period from entities
    const userId = entities.user_id || null;
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 7;
    
    // Get user activity from audit service
    const events = await this.auditService.getUserActivity(userId, days);
    
    // Analyze user activity
    const userActivity = this.userActivityAnalyzer.analyzeUserActivity(events, userId);
    
    // Generate summary message
    const message = this.userActivityAnalyzer.generateUserActivitySummary(userActivity, userId, days);
    
    return this.responseFormatter.formatApiResponse({
      message,
      data: userActivity,
      success: true
    });
  }

  /**
   * Handle suspicious activity query
   * @param {Object} entities - Extracted entities
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - Formatted response
   * @private
   */
  async _handleSuspiciousActivityQuery(entities, context) {
    // Extract time period from entities
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 2;
    
    // Get all events for the time period
    const events = await this.auditService.getAllEvents(days);
    
    // Detect suspicious activities
    const suspiciousActivities = this.anomalyDetector.detectAnomalies(events);
    
    // Generate summary message
    const message = this.anomalyDetector.generateSuspiciousActivitySummary(suspiciousActivities, days);
    
    return this.responseFormatter.formatApiResponse({
      message,
      data: suspiciousActivities,
      success: true
    });
  }

  /**
   * Handle time-based query
   * @param {Object} entities - Extracted entities
   * @param {Object} context - Conversation context
   * @returns {Promise<Object>} - Formatted response
   * @private
   */
  async _handleTimeBasedQuery(entities, context) {
    // Extract time range from entities
    let start, end;
    
    if (entities.time_range) {
      const range = this._parseTimeRange(entities.time_range);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 24 hours
      end = new Date();
      start = new Date(end);
      start.setDate(start.getDate() - 1);
    }
    
    // Get events in time range
    const events = await this.auditService.getEventsByTimeRange(
      start.toISOString(),
      end.toISOString()
    );
    
    // Summarize events
    const eventSummary = await this.auditService.summarizeTimeRangeEvents(events, start, end);
    
    // Format start and end for display
    const formattedStart = start.toLocaleString();
    const formattedEnd = end.toLocaleString();
    
    let message = `Audit log summary for ${formattedStart} - ${formattedEnd}:\n\n`;
    message += `Total events: ${eventSummary.totalEvents}\n`;
    message += `Active users: ${eventSummary.uniqueUserCount}\n\n`;
    
    // Notable activities
    message += 'Notable activities:\n';
    
    // Show top event types
    eventSummary.eventTypeSummary.slice(0, 5).forEach(eventType => {
      message += `• ${eventType.count} ${this._formatEventType(eventType.type)} events\n`;
    });
    
    // Highlight security events if any
    if (eventSummary.securityEvents.length > 0) {
      message += `\nSecurity-related events: ${eventSummary.securityEvents.length}\n`;
      eventSummary.securityEvents.slice(0, 3).forEach(event => {
        const user = event.content?.user_id || event.content?.performed_by || 'unknown';
        const time = new Date(event.created).toLocaleTimeString();
        message += `• ${this._formatEventType(event.event)} by ${user} at ${time} ⚠️\n`;
      });
    }
    
    return this.responseFormatter.formatApiResponse({
      message,
      data: eventSummary,
      success: true
    });
  }

  /**
   * Handle help request
   * @returns {Object} - Formatted response
   * @private
   */
  _handleHelpRequest() {
    const message = `I can help you monitor Snyk audit logs for security events and user activities. Try asking me:

• "Show me recent security events"
• "Any suspicious activity in the last 24 hours?"
• "What has [username] been doing?"
• "Were there any policy changes recently?"
• "Show me after-hours activity"
• "Who modified our integrations this week?"

I can search by time period, user, event type, or security priority. What would you like to know?`;
    
    return this.responseFormatter.formatApiResponse({
      message,
      success: true
    });
  }

  /**
   * Format event type for display
   * @param {string} eventType - Raw event type
   * @returns {string} - Formatted event type
   * @private
   */
  _formatEventType(eventType) {
    // Remove the prefix (org., group., etc.)
    const parts = eventType.split('.');
    const action = parts.pop();
    
    // Get the main entity type
    const entityType = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    
    // Format based on action type
    switch (action) {
      case 'create':
        return `${entityType} created`;
      case 'delete':
        return `${entityType} deleted`;
      case 'edit':
        return `${entityType} modified`;
      case 'add':
        return `${entityType} added`;
      case 'remove':
        return `${entityType} removed`;
      default:
        // Just clean up the raw event type
        return eventType.replace(/\./g, ' ').replace(/org |group /, '');
    }
  }

  /**
   * Parse days from time period entity
   * @param {string} timePeriod - Time period entity
   * @returns {number} - Number of days
   * @private
   */
  _parseDaysFromTimePeriod(timePeriod) {
    // Handle common time period phrases
    const lowerTimePeriod = timePeriod.toLowerCase();
    
    if (lowerTimePeriod.includes('hour') || lowerTimePeriod.includes('today')) {
      return 1;
    } else if (lowerTimePeriod.includes('yesterday') || lowerTimePeriod.includes('24 hour')) {
      return 1;
    } else if (lowerTimePeriod.includes('week')) {
      return 7;
    } else if (lowerTimePeriod.includes('month')) {
      return 30;
    } else if (lowerTimePeriod.includes('quarter') || lowerTimePeriod.includes('3 month')) {
      return 90;
    } else if (lowerTimePeriod.includes('year')) {
      return 365;
    }
    
    // Try to extract a number
    const matches = lowerTimePeriod.match(/(\d+)/);
    if (matches && matches[1]) {
      const num = parseInt(matches[1], 10);
      
      if (lowerTimePeriod.includes('day')) {
        return num;
      } else if (lowerTimePeriod.includes('week')) {
        return num * 7;
      } else if (lowerTimePeriod.includes('month')) {
        return num * 30;
      } else if (lowerTimePeriod.includes('year')) {
        return num * 365;
      } else {
        // Default to days if unit is not specified
        return num;
      }
    }
    
    // Default to 7 days if we couldn't parse
    return 7;
  }

  /**
   * Parse time range entity
   * @param {string} timeRange - Time range entity
   * @returns {Object} - Start and end dates
   * @private
   */
  _parseTimeRange(timeRange) {
    const now = new Date();
    let start, end = now;
    
    // Common time ranges
    const lowerTimeRange = timeRange.toLowerCase();
    
    if (lowerTimeRange.includes('last night') || lowerTimeRange.includes('overnight')) {
      // Last night (6 PM yesterday to 6 AM today)
      end = new Date();
      end.setHours(6, 0, 0, 0);
      
      start = new Date(end);
      start.setDate(start.getDate() - 1);
      start.setHours(18, 0, 0, 0);
    } else if (lowerTimeRange.includes('weekend')) {
      // Last weekend (Friday 5 PM to Monday 9 AM)
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      end = new Date();
      if (dayOfWeek === 0) { // Sunday
        end.setHours(23, 59, 59, 999);
      } else if (dayOfWeek === 1) { // Monday
        end.setHours(9, 0, 0, 0);
      } else {
        // If it's not Sunday or Monday, go back to the most recent Monday
        end = new Date();
        end.setDate(end.getDate() - dayOfWeek + 1);
        end.setHours(9, 0, 0, 0);
      }
      
      start = new Date(end);
      start.setDate(start.getDate() - 2 - (dayOfWeek === 0 ? 0 : 1));
      start.setHours(17, 0, 0, 0);
    } else {
      // Default to last 24 hours
      end = new Date();
      start = new Date(end);
      start.setDate(start.getDate() - 1);
    }
    
    return { start, end };
  }
}

module.exports = SnykChatbotWrapper;