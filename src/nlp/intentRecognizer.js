// src/nlp/intentRecognizer.js

/**
 * Intent Recognizer for SnykAudit Chatbot
 * * This component identifies the user's intent from natural language messages
 * using pattern matching and keyword detection.
 */
class IntentRecognizer {
  constructor() {
    this.intentPatterns = {
      event_by_user_query: [
        /who (modified|changed|updated|created|deleted|added|removed)/i,
        /show me users who/i,
        /which users/i,
        /list users that/i
      ],

      security_events_query: [
        /security (events|incidents)/i,
        /recent (\w+ )?security/i,
        /show me security/i,
        /(any|recent) (security )?(issues|events|incidents)/i,
        /security (concerns|problems)/i,
        /policy changes/i,
        /integration (changes|updates)/i,
        /webhook (changes|updates)/i,
        /service account changes/i,
        /project changes/i, // Added
        /sast settings changes/i // Added
      ],
      
      user_activity_query: [
        // General user activity patterns
        /^user activity$/i,
        /all user activity/i,
        /show me user activity/i,
        /list user activity/i,
        /user actions/i,
        /user behavior/i,
        /who (has been active|did what)/i,
        /active users/i,
        /most active users/i,
        /show me (a list of )?users/i,
        /list (all )?users/i,
        /get users/i,
        /user list/i,
        
        // Specific user activity patterns
        /what (has|did) (\w+) (do|done)/i,
        /show me what (\w+) (did|has done)/i,
        /(\w+)'s activity/i,
        /activity by (\w+)/i,
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
    
    this.confidenceThresholds = {
      high: 0.8,
      medium: 0.5,
      low: 0.3
    };
  }

  recognizeIntent(message) {
    if (!message || typeof message !== 'string') {
      return { intent: 'help_request', confidence: 1.0, message: 'Empty or invalid message' };
    }
    
    const normalizedMessage = message.trim().toLowerCase();
    
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          return { intent, confidence: this._calculateConfidence(normalizedMessage, pattern, intent), message };
        }
      }
    }
    
    const scoredIntents = this._scoreIntentsByKeywords(normalizedMessage);
    scoredIntents.sort((a, b) => b.score - a.score);
    
    if (scoredIntents.length > 0 && scoredIntents[0].score >= this.confidenceThresholds.low) {
      return { intent: scoredIntents[0].intent, confidence: scoredIntents[0].score, message };
    }
    
    return { intent: 'help_request', confidence: 1.0, message };
  }

  _calculateConfidence(message, pattern, intent) {
    const patternStr = pattern.toString();
    const groupCount = (patternStr.match(/\([^?]/g) || []).length;
    const optionalCount = (patternStr.match(/\?/g) || []).length;
    
    let confidence = 0.85;
    confidence += groupCount * 0.03;
    confidence -= optionalCount * 0.02;
    
    if (pattern.toString().includes(message)) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.99);
  }

  _scoreIntentsByKeywords(message) {
    const scores = [];
    
    const intentKeywords = {
      event_by_user_query: ['who', 'users', 'which user', 'list users'],
      // UPDATED: Added more keywords to improve intent detection
      security_events_query: [
        'security', 'policy', 'event', 'incident', 'issue', 'changes', 
        'integration', 'webhook', 'service account', 'project', 'sast'
      ],
      user_activity_query: ['user', 'activity', 'actions', 'behavior', 'did', 'done', 'doing', 'perform', 'active', 'users', 'all users', 'most active', 'list users', 'user list', 'show users'],
      suspicious_activity_query: ['suspicious', 'unusual', 'anomaly', 'strange', 'unexpected', 'abnormal', 'after hours'],
      time_based_query: ['when', 'time', 'yesterday', 'today', 'last night', 'weekend', 'morning', 'afternoon', 'evening', 'night', 'hour', 'day', 'week', 'month'],
      help_request: ['help', 'assist', 'how', 'what', 'guide', 'explain', 'show me', 'instructions', 'commands', 'options']
    };
    
    Object.entries(intentKeywords).forEach(([intent, keywords]) => {
      let score = 0;
      let matchCount = 0;
      
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b|${keyword}`, 'i');
        if (regex.test(message)) {
          score += 0.2;
          matchCount++;
          if (keyword.includes(' ')) score += 0.1;
        }
      });
      
      if (matchCount > 0) {
        const wordCount = message.split(/\s+/).length;
        const coverageBonus = Math.min(0.3, matchCount / wordCount * 0.5);
        score += coverageBonus;
        scores.push({ intent, score: Math.min(score, 0.95) });
      }
    });
    
    return scores;
  }
}

module.exports = IntentRecognizer;
