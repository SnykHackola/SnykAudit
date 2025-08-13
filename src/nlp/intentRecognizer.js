// src/nlp/intentRecognizer.js

/**
 * Intent Recognizer for SnykAudit Chatbot
 * 
 * This component identifies the user's intent from natural language messages
 * using pattern matching and keyword detection.
 */
class IntentRecognizer {
  constructor() {
    // Define intent patterns for matching user queries
    this.intentPatterns = {
      security_events_query: [
        /security (events|incidents)/i,
        /recent (\w+ )?security/i,
        /show me security/i,
        /(any|recent) (security )?(issues|events|incidents)/i,
        /security (concerns|problems)/i,
        /policy changes/i,
        /integration (changes|updates)/i,
        /webhook (changes|updates)/i,
        /service account changes/i
      ],
      
      user_activity_query: [
        /user activity/i,
        /what (has|did) (\w+) (do|done)/i,
        /show me what (\w+) (did|has done)/i,
        /(\w+)'s activity/i,
        /user actions/i,
        /who (has been active|did what)/i,
        /activity by (\w+)/i,
        /user behavior/i,
        /actions (by|from) (\w+)/i
      ],
      
      suspicious_activity_query: [
        /suspicious activity/i,
        /unusual (behavior|activity)/i,
        /detect anomalies/i,
        /any suspicious/i,
        /strange patterns/i,
        /security anomalies/i,
        /after hours activity/i,
        /unexpected changes/i,
        /potential security (issues|breaches)/i,
        /anomalous behavior/i
      ],
      
      time_based_query: [
        /what happened (last night|yesterday|over the weekend)/i,
        /show me (activity|events|logs) (from|during|in) (.*)/i,
        /(last night|weekend|after hours) activity/i,
        /activity (between|from|during)/i,
        /logs from (.*)/i,
        /events in the last (.*)/i,
        /(morning|afternoon|evening|night) activity/i
      ],
      
      help_request: [
        /help/i,
        /what can you (do|tell me)/i,
        /how (do|can) I use/i,
        /what (questions|commands)/i,
        /available commands/i,
        /show options/i,
        /commands/i,
        /capabilities/i,
        /examples/i,
        /how does this work/i
      ]
    };
    
    // Confidence thresholds for intent detection
    this.confidenceThresholds = {
      high: 0.8,
      medium: 0.5,
      low: 0.3
    };
  }

  /**
   * Recognize intent from a user message
   * @param {string} message - User message text
   * @returns {Object} - Recognized intent with confidence score
   */
  recognizeIntent(message) {
    if (!message || typeof message !== 'string') {
      return {
        intent: 'help_request',
        confidence: 1.0,
        message: 'Empty or invalid message'
      };
    }
    
    const normalizedMessage = message.trim().toLowerCase();
    
    // Check for exact matches first (highest confidence)
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          return {
            intent,
            confidence: this._calculateConfidence(normalizedMessage, pattern, intent),
            message
          };
        }
      }
    }
    
    // If no exact matches, use keyword scoring to determine most likely intent
    const scoredIntents = this._scoreIntentsByKeywords(normalizedMessage);
    
    // Sort by score descending
    scoredIntents.sort((a, b) => b.score - a.score);
    
    // If highest score is above minimum threshold, return that intent
    if (scoredIntents.length > 0 && scoredIntents[0].score >= this.confidenceThresholds.low) {
      return {
        intent: scoredIntents[0].intent,
        confidence: scoredIntents[0].score,
        message
      };
    }
    
    // Default to help request if we can't determine intent
    return {
      intent: 'help_request',
      confidence: 1.0,
      message
    };
  }

  /**
   * Calculate confidence score for a pattern match
   * @param {string} message - Normalized message
   * @param {RegExp} pattern - Matching pattern
   * @param {string} intent - Intent being checked
   * @returns {number} - Confidence score between 0-1
   * @private
   */
  _calculateConfidence(message, pattern, intent) {
    // Patterns with more specific keywords get higher confidence
    const patternStr = pattern.toString();
    
    // Count groups and optional parts in the pattern
    const groupCount = (patternStr.match(/\([^?]/g) || []).length;
    const optionalCount = (patternStr.match(/\?/g) || []).length;
    
    // Base confidence starts high for a regex match
    let confidence = 0.85;
    
    // Adjust based on pattern complexity
    confidence += groupCount * 0.03;  // More complex patterns are more specific
    confidence -= optionalCount * 0.02;  // Optional parts make pattern less specific
    
    // Boost confidence for exact phrase matches
    if (pattern.toString().includes(message)) {
      confidence += 0.1;
    }
    
    // Cap at 0.99 to allow for some uncertainty
    return Math.min(confidence, 0.99);
  }

  /**
   * Score intents based on keyword presence
   * @param {string} message - Normalized message
   * @returns {Array} - Scored intents
   * @private
   */
  _scoreIntentsByKeywords(message) {
    const scores = [];
    
    // Keywords associated with each intent
    const intentKeywords = {
      security_events_query: [
        'security', 'policy', 'policies', 'event', 'events', 'incident', 
        'incidents', 'issue', 'issues', 'changes', 'integration', 'webhook'
      ],
      user_activity_query: [
        'user', 'activity', 'actions', 'behavior', 'did', 'done', 'doing',
        'who', 'perform', 'performed'
      ],
      suspicious_activity_query: [
        'suspicious', 'unusual', 'anomaly', 'anomalies', 'strange', 'unexpected',
        'weird', 'odd', 'abnormal', 'detection', 'after hours'
      ],
      time_based_query: [
        'when', 'time', 'yesterday', 'today', 'last night', 'weekend', 'morning',
        'afternoon', 'evening', 'night', 'hour', 'day', 'week', 'month'
      ],
      help_request: [
        'help', 'assist', 'how', 'what', 'guide', 'explain', 'show me', 
        'instructions', 'commands', 'options'
      ]
    };
    
    // Score each intent based on keyword matches
    Object.entries(intentKeywords).forEach(([intent, keywords]) => {
      let score = 0;
      let matchCount = 0;
      
      keywords.forEach(keyword => {
        // Check for whole word or phrase matches
        const regex = new RegExp(`\\b${keyword}\\b|${keyword}`, 'i');
        if (regex.test(message)) {
          score += 0.2;  // Base score for each keyword
          matchCount++;
          
          // Bonus for multi-word phrases (stronger signal)
          if (keyword.includes(' ')) {
            score += 0.1;
          }
        }
      });
      
      // Adjust final score based on number of matches and message length
      if (matchCount > 0) {
        // Normalize by message length - shorter messages with same match count score higher
        const wordCount = message.split(/\s+/).length;
        const coverageBonus = Math.min(0.3, matchCount / wordCount * 0.5);
        
        // Apply coverage bonus
        score += coverageBonus;
        
        scores.push({
          intent,
          score: Math.min(score, 0.95)  // Cap at 0.95
        });
      }
    });
    
    return scores;
  }
}

module.exports = IntentRecognizer;