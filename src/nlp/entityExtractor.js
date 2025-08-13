// src/nlp/entityExtractor.js

/**
 * Entity Extractor for SnykAudit Chatbot
 * * This component extracts named entities from user messages,
 * such as usernames, time periods, and event types.
 */
class EntityExtractor {
  constructor() {
    this.entityPatterns = {
      user_id: [
        /@([\w.-]+)/,
        /user ([\w.-]+)/i,
        /what (has|did) ([A-Z][a-z]+)/i,  // Updated to match proper names (capitalized first letter)
        /([A-Z][a-z]+)'s activity/i,  // Updated to match proper names
        // Modified to prevent 'activity' from being extracted as a username
        /activity (by|for|of) ([A-Z][a-z]+)/i,  // Updated to match proper names
        // Added a negative lookahead to exclude the word 'activity' itself
        /activity (by|for|of) (?!activity)([A-Z][a-z]+)/i,  // Updated to match proper names
        /actions (by|from) ([A-Z][a-z]+)/i,  // Updated to match proper names
        // New patterns specifically for proper names
        /what ([A-Z][a-z]+) (has|did|was)/i,  // "What Cesar has been doing"
        /show ([A-Z][a-z]+)/i,  // "Show Cesar"
        /about ([A-Z][a-z]+)/i  // "Tell me about Cesar"
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
      
      // UPDATED: Added more specific event types to the main patterns
      event_type: [
        /policy changes/i,
        /integration changes/i,
        /webhook changes/i,
        /service account changes/i,
        /project changes/i,
        /user changes/i,
        /role changes/i,
        /sast settings changes/i,
        /target changes/i,
        /app changes/i,
        /collection changes/i,
        /(modified|changed|updated|created|deleted|added|removed) (integrations|policies|webhooks|users|roles|projects|service accounts|sast settings|targets|apps|collections)/i
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

  extractEntities(message) {
    if (!message || typeof message !== 'string') {
      return {};
    }
    
    const entities = {};
    
    for (const [entityType, patterns] of Object.entries(this.entityPatterns)) {
      const extractedEntity = this._extractEntityWithPatterns(message, patterns, entityType);
      if (extractedEntity !== null) {
        entities[entityType] = extractedEntity;
      }
    }
    
    if (!entities.time_period && !entities.time_range) {
      const timeEntity = this._extractTimeEntity(message);
      if (timeEntity) {
        entities[timeEntity.type] = timeEntity.value;
      }
    }
    
    return entities;
  }

  _extractEntityWithPatterns(message, patterns, entityType) {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        switch (entityType) {
          case 'user_id':
            return match[match.length - 1];
            
          case 'time_period':
            return this._processTimePeriod(match);
            
          case 'time_range':
            return match[0];
            
          case 'event_type':
            if (match[2]) {
                return `${match[2].replace(/s$/, '')} ${match[1]}`;
            }
            return match[0].toLowerCase().replace(/changes/i, '').trim();
            
          case 'count_limit':
            const num = parseInt(match[1], 10);
            return isNaN(num) ? null : num;
            
          default:
            return match[1] || match[0];
        }
      }
    }
    
    return null;
  }

  _processTimePeriod(match) {
    if (match[1] && !isNaN(parseInt(match[1], 10))) {
      const count = match[1];
      const unit = match[2] || 'days';
      return `${count} ${unit}`;
    }
    if (match[0].toLowerCase().includes('last')) {
      const unit = match[1] || match[0].split(' ')[1] || 'day';
      return `last ${unit}`;
    }
    if (match[0].toLowerCase().includes('yesterday')) return 'yesterday';
    if (match[0].toLowerCase().includes('today')) return 'today';
    if (match[0].toLowerCase().includes('this')) {
      const unit = match[0].split(' ')[1] || 'day';
      return `this ${unit}`;
    }
    if (match[0].toLowerCase().includes('recent')) return 'recent';
    return match[0];
  }

  _extractTimeEntity(message) {
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
