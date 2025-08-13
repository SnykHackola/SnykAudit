// src/core/snykChatbotWrapper.js
const { SnykAuditService } = require('../api'); // Corrected require
const SecurityEventAnalyzer = require('./securityEventAnalyzer');
const UserActivityAnalyzer = require('./userActivityAnalyzer');
const AnomalyDetector = require('./anomalyDetector');
const ResponseFormatter = require('./responseFormatter');

class SnykChatbotWrapper {
  constructor() {
    this.auditService = null;
    this.securityEventAnalyzer = new SecurityEventAnalyzer(null); // Will be updated in init
    this.userActivityAnalyzer = new UserActivityAnalyzer();
    this.anomalyDetector = new AnomalyDetector();
    this.responseFormatter = new ResponseFormatter();
    this.initialized = false;
  }

  async init(apiKey, config = {}) {
    try {
      this.auditService = new SnykAuditService(apiKey, config);
      // Update the security event analyzer with the audit service for user lookups
      this.securityEventAnalyzer = new SecurityEventAnalyzer(this.auditService);
      this.userActivityAnalyzer = new UserActivityAnalyzer(this.auditService);
      // Update the anomaly detector with the audit service for user lookups
      this.anomalyDetector = new AnomalyDetector(this.auditService);
      
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

  isInitialized() {
    return this.initialized;
  }

  async handleRequest(intent, entities, context) {
    if (!this.initialized) {
      return this.responseFormatter.formatApiResponse({
        message: 'I\'m having trouble connecting to Snyk. Please check the API configuration.',
        success: false
      });
    }
    
    try {
      switch (intent) {
        case 'event_by_user_query':
          return await this._handleEventByUserQuery(entities, context);

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

  // UPDATED: This function is now more robust.
  async _handleEventByUserQuery(entities, context) {
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 7;
    let eventType = entities.event_type || null;
    const originalMessage = context.nlp?.originalMessage || '';

    // Fallback: If the entity extractor fails, do a simple keyword search.
    if (!eventType) {
        if (originalMessage.includes('integration')) eventType = 'integration';
        else if (originalMessage.includes('policy')) eventType = 'policy';
        else if (originalMessage.includes('webhook')) eventType = 'webhook';
        else if (originalMessage.includes('user')) eventType = 'user';
        // NEW: Added more fallbacks for specific queries
        else if (originalMessage.includes('service account')) eventType = 'service account';
        else if (originalMessage.includes('sast settings')) eventType = 'sast settings';
        else if (originalMessage.includes('project')) eventType = 'project';
    }

    if (!eventType) {
        return this.responseFormatter.formatApiResponse({
            message: "I can search for who performed an action, but I need to know what kind of action to look for. For example, 'who modified integrations' or 'who changed policies'.",
            success: true
        });
    }

    // UPDATED: Expanded the vocabulary of the chatbot
    const eventMap = {
        'integration': 'org.integration.',
        'policy': 'org.policy.',
        'webhook': 'org.webhook.',
        'user': 'org.user.role.',
        'service account': 'org.service_account.',
        'sast settings': 'org.sast_settings.',
        'project': 'org.project.',
        'target': 'org.target.',
        'app': 'org.app.',
        'collection': 'org.collection.'
    };

    const snykEventPattern = Object.keys(eventMap).find(key => eventType.includes(key));

    if (!snykEventPattern) {
        return this.responseFormatter.formatApiResponse({
            message: `I'm not sure how to search for events related to "${eventType}". Try asking about integrations, policies, or users.`,
            success: true
        });
    }

    // Get all events and filter them here, as the service layer doesn't support filtering this way.
    const allEvents = await this.auditService.getAllEvents(days);
    const filteredEvents = allEvents.filter(event => event.event.startsWith(eventMap[snykEventPattern]));
    
    if (filteredEvents.length === 0) {
        return this.responseFormatter.formatApiResponse({
            message: `I didn't find any users who performed '${eventType}' actions in the last ${days} days.`,
            success: true
        });
    }

    const users = [...new Set(filteredEvents.map(event => event.content?.user_id || event.content?.performed_by).filter(Boolean))];

    let message = `Here are the users who performed '${eventType}' actions in the last ${days} days:\n\n`;
    users.forEach(user => {
        message += `• ${user}\n`;
    });

    return this.responseFormatter.formatApiResponse({
        message,
        data: { users, events: filteredEvents },
        success: true
    });
  }

  async _handleSecurityEventsQuery(entities, context) {
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 7;
    try {
      const events = await this.auditService.getSecurityEvents(days);
      const categorizedEvents = await this.securityEventAnalyzer.categorizeSecurityEvents(events);
      const message = await this.securityEventAnalyzer.generateSecuritySummary(categorizedEvents, days);
      return this.responseFormatter.formatApiResponse({
        message,
        data: categorizedEvents,
        success: true
      });
    } catch (error) {
      console.error('Error handling security events query:', error);
      return this.responseFormatter.formatApiResponse({
        message: `I encountered an error analyzing security events: ${error.message}`,
        success: false
      });
    }
  }

  async _handleUserActivityQuery(entities, context) {
    // Special case: if user_id is "activity", it's likely a misinterpretation
    let userId = entities.user_id || null;
    if (userId === "activity") {
      userId = null; // Treat as a request for all user activity
    }
  
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 7;
    
    try {
      // Add debug logging
      console.log(`Fetching user activity for ${userId || 'all users'} over ${days} days`);
      
      const events = await this.auditService.getUserActivity(userId, days);
      console.log(`Retrieved ${events.length} events from API`);
      
      // Debug: Log the first few events if available
      if (events.length > 0) {
        console.log('Sample event:', JSON.stringify(events[0]));
      } else {
        console.log('No events returned from API');
      }
      
      // Use await for async methods
      const userActivity = await this.userActivityAnalyzer.analyzeUserActivity(events, userId);
      console.log('User activity analysis completed');
      
      // Log if we have no users in the organization
      if (userActivity && userActivity.orgUsersAvailable === false) {
        console.log('No users found in the organization');
      }
      
      // Use await for async methods
      const message = await this.userActivityAnalyzer.generateUserActivitySummary(userActivity, userId, days);
      console.log('User activity summary generated');
    
      return this.responseFormatter.formatApiResponse({
        message,
        data: userActivity,
        success: true
      });
    } catch (error) {
      console.error('Error handling user activity query:', error);
      return this.responseFormatter.formatApiResponse({
        message: `Error retrieving user activity: ${error.message}`,
        success: false
      });
    }
  }

  async _handleSuspiciousActivityQuery(entities, context) {
    const days = entities.time_period ? this._parseDaysFromTimePeriod(entities.time_period) : 2;
    const events = await this.auditService.getAllEvents(days);
    const suspiciousActivities = this.anomalyDetector.detectAnomalies(events);
    const message = await this.anomalyDetector.generateSuspiciousActivitySummary(suspiciousActivities, days);
    
    return this.responseFormatter.formatApiResponse({
      message,
      data: suspiciousActivities,
      success: true
    });
  }

  async _handleTimeBasedQuery(entities, context) {
    let start, end;
    
    if (entities.time_range) {
      const range = this._parseTimeRange(entities.time_range);
      start = range.start;
      end = range.end;
    } else {
      end = new Date();
      start = new Date(end);
      start.setDate(start.getDate() - 1);
    }
    
    const events = await this.auditService.getEventsByTimeRange(
      start.toISOString(),
      end.toISOString()
    );
    
    const eventSummary = await this.auditService.summarizeTimeRangeEvents(events, start, end);
    const formattedStart = start.toLocaleString();
    const formattedEnd = end.toLocaleString();
    
    let message = `Audit log summary for ${formattedStart} - ${formattedEnd}:\n\n`;
    message += `Total events: ${eventSummary.totalEvents}\n`;
    message += `Active users: ${eventSummary.uniqueUserCount}\n\n`;
    message += 'Notable activities:\n';
    
    eventSummary.eventTypeSummary.slice(0, 5).forEach(eventType => {
      message += `• ${eventType.count} ${this._formatEventType(eventType.type)} events\n`;
    });
    
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

  _formatEventType(eventType) {
    const parts = eventType.split('.');
    const action = parts.pop();
    const entityType = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    
    switch (action) {
      case 'create': return `${entityType} created`;
      case 'delete': return `${entityType} deleted`;
      case 'edit': return `${entityType} modified`;
      case 'add': return `${entityType} added`;
      case 'remove': return `${entityType} removed`;
      default: return eventType.replace(/\./g, ' ').replace(/org |group /, '');
    }
  }

  _parseDaysFromTimePeriod(timePeriod) {
    const lowerTimePeriod = timePeriod.toLowerCase();
    
    if (lowerTimePeriod.includes('hour') || lowerTimePeriod.includes('today')) return 1;
    if (lowerTimePeriod.includes('yesterday') || lowerTimePeriod.includes('24 hour')) return 1;
    if (lowerTimePeriod.includes('week')) return 7;
    if (lowerTimePeriod.includes('month')) return 30;
    if (lowerTimePeriod.includes('quarter') || lowerTimePeriod.includes('3 month')) return 90;
    if (lowerTimePeriod.includes('year')) return 365;
    
    const matches = lowerTimePeriod.match(/(\d+)/);
    if (matches && matches[1]) {
      const num = parseInt(matches[1], 10);
      if (lowerTimePeriod.includes('day')) return num;
      if (lowerTimePeriod.includes('week')) return num * 7;
      if (lowerTimePeriod.includes('month')) return num * 30;
      if (lowerTimePeriod.includes('year')) return num * 365;
      return num;
    }
    return 7;
  }

  _parseTimeRange(timeRange) {
    const now = new Date();
    let start, end = now;
    const lowerTimeRange = timeRange.toLowerCase();
    
    if (lowerTimeRange.includes('last night') || lowerTimeRange.includes('overnight')) {
      end = new Date();
      end.setHours(6, 0, 0, 0);
      start = new Date(end);
      start.setDate(start.getDate() - 1);
      start.setHours(18, 0, 0, 0);
    } else if (lowerTimeRange.includes('weekend')) {
      const dayOfWeek = now.getDay();
      end = new Date();
      if (dayOfWeek === 0) {
        end.setHours(23, 59, 59, 999);
      } else if (dayOfWeek === 1) {
        end.setHours(9, 0, 0, 0);
      } else {
        end = new Date();
        end.setDate(end.getDate() - dayOfWeek + 1);
        end.setHours(9, 0, 0, 0);
      }
      start = new Date(end);
      start.setDate(start.getDate() - 2 - (dayOfWeek === 0 ? 0 : 1));
      start.setHours(17, 0, 0, 0);
    } else {
      end = new Date();
      start = new Date(end);
      start.setDate(start.getDate() - 1);
    }
    
    return { start, end };
  }
}

module.exports = SnykChatbotWrapper;
