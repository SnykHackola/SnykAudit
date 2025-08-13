// src/nlp/entityExtractor.js

/**
 * Entity Extractor for SnykAudit Chatbot
 * 
 * This component extracts named entities from user messages,
 * such as usernames, time periods, and event types.
 */
class EntityExtractor {
  constructor() {
    // Define entity extraction patterns
    this.entityPatterns = {
      user_id: [
        /@([\w.-]+)/,                // @username format
        /user ([\w.-]+)/i,           // "user username" format
        /what (has|did) ([\w.-]+)/i, // "what did username" format
        /([\w.-]+)'s activity/i,     // "username's activity" format
        /activity (by|for|of) ([\w.-]+)/i, // "activity by username" format
        /actions (by|from) ([\w.-]+)/i     // "actions by username" format
      ],
      
      time_period: [
        /last (\d+) (days|hours|weeks|months|years)/i,
        /past (\d+) (days|hours|weeks|months|years)/i,
        /(\d+) (days|hours|weeks|months|years) ago/i,
        /last (day|week|month|year|hour)/i,
        /yesterday/i,
        /today/i,
        /this (week|month|year)/i,
        /recent(ly)?/i,
        /since (yesterday|last week|last month)/i
      ],
      
      time_range: [
        /last night/i,
        /overnight/i,
        /weekend/i,
        /after hours/i,
        /between (.*) and (.*)/i,
        /from (.*) to (.*)/i,
        /during (morning|afternoon|evening|night)/i,
        /during (.*)/i
      ],
      
      event_type: [
        /policy changes/i,
        /policy (create|edit|delete)/i,
        /integration changes/i,
        /integration (create|edit|delete)/i,
        /webhook changes/i,
        /service account changes/i,
        /project changes/i,
        /user (add|remove|invite)/i,
        /role changes/i
      ],
      
      count_limit: [
        /top (\d+)/i,
        /first (\d+)/i,
        /last (\d+)/i,
        /(\d+) most/i,
        /limit (\d+)/i,
        /(\d+) results/i
      ]
    };
  }

  /**
   * Extract entities from a user message
   * @param {string} message - User message text
   * @returns {Object} - Extracted entities
   */
  extractEntities(message) {
    if (!message || typeof message !== 'string') {
      return {};
    }
    
    const entities = {};
    
    // Extract each entity type
    for (const [entityType, patterns] of Object.entries(this.entityPatterns)) {
      const extractedEntity = this._extractEntityWithPatterns(message, patterns, entityType);
      if (extractedEntity !== null) {
        entities[entityType] = extractedEntity;
      }
    }
    
    // Special handling for advanced time period extraction
    if (!entities.time_period && !entities.time_range) {
      const timeEntity = this._extractTimeEntity(message);
      if (timeEntity) {
        entities[timeEntity.type] = timeEntity.value;
      }
    }
    
    return entities;
  }

  /**
   * Extract entity using array of patterns
   * @param {string} message - User message
   * @param {Array<RegExp>} patterns - Patterns to match
   * @param {string} entityType - Type of entity being extracted
   * @returns {string|null} - Extracted entity or null if not found
   * @private
   */
  _extractEntityWithPatterns(message, patterns, entityType) {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        // Different entity types have different extraction logic
        switch (entityType) {
          case 'user_id':
            // For user_id, return the captured group, which is the username
            return match[match.length - 1]; // Last capture group contains the username
            
          case 'time_period':
            // For time_period, either return the full match or process it
            return this._processTimePeriod(match);
            
          case 'time_range':
            // For time_range, return the full match
            return match[0];
            
          case 'event_type':
            // For event_type, clean up the match
            return match[0].toLowerCase().replace(/changes/i, '').trim();
            
          case 'count_limit':
            // For count_limit, extract the number
            const num = parseInt(match[1], 10);
            return isNaN(num) ? null : num;
            
          default:
            // Default to returning the first capture group or full match
            return match[1] || match[0];
        }
      }
    }
    
    return null;
  }

  /**
   * Process time period matches into a standardized format
   * @param {Array} match - Regex match result
   * @returns {string} - Processed time period
   * @private
   */
  _processTimePeriod(match) {
    // For patterns like "last 5 days"
    if (match[1] && !isNaN(parseInt(match[1], 10))) {
      const count = match[1];
      const unit = match[2] || 'days';
      return `${count} ${unit}`;
    }
    
    // For patterns like "last week"
    if (match[0].toLowerCase().includes('last')) {
      const unit = match[1] || match[0].split(' ')[1] || 'day';
      return `last ${unit}`;
    }
    
    // For patterns like "yesterday"
    if (match[0].toLowerCase().includes('yesterday')) {
      return 'yesterday';
    }
    
    // For patterns like "today"
    if (match[0].toLowerCase().includes('today')) {
      return 'today';
    }
    
    // For patterns like "this week"
    if (match[0].toLowerCase().includes('this')) {
      const unit = match[0].split(' ')[1] || 'day';
      return `this ${unit}`;
    }
    
    // For patterns like "recently"
    if (match[0].toLowerCase().includes('recent')) {
      return 'recent';
    }
    
    // Default to returning the original match
    return match[0];
  }

  /**
   * Advanced time entity extraction for complex cases
   * @param {string} message - User message
   * @returns {Object|null} - Extracted time entity or null
   * @private
   */
  _extractTimeEntity(message) {
    // Look for date references
    const datePatterns = [
      { regex: /since (last|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, type: 'time_period' },
      { regex: /(january|february|march|april|may|june|july|august|september|october|november|december) (\d{1,2})(st|nd|rd|th)?/i, type: 'time_range' },
      { regex: /(\d{1,2})(st|nd|rd|th)? of (january|february|march|april|may|june|july|august|september|october|november|december)/i, type: 'time_range' },
      { regex: /from .* until .*/i, type: 'time_range' },
      { regex: /last quarter/i, type: 'time_period' },
      { regex: /Q[1-4]/i, type: 'time_range' },
      { regex: /first half of (the )?(day|week|month|year)/i, type: 'time_range' },
      { regex: /second half of (the )?(day|week|month|year)/i, type: 'time_range' }
    ];
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern.regex);
      if (match) {
        return {
          type: pattern.type,
          value: match[0]
        };
      }
    }
    
    return null;
  }
}

module.exports = EntityExtractor;