// src/core/userActivityAnalyzer.js

class UserActivityAnalyzer {
  constructor() {
    // Define user activity events
    this.userActivityEvents = [
      'org.user.add', 'org.user.remove',
      'org.user.role.edit', 'org.user.role.create', 'org.user.role.delete',
      'org.user.invite', 'org.user.invite.accept', 'org.user.invite.revoke',
      'org.user.leave',
      'api.access'
    ];
  }

  /**
   * Analyze user activity
   * @param {Array} events - List of audit log events
   * @param {string} userId - User ID to analyze (optional)
   * @returns {Object} - User activity analysis
   */
  analyzeUserActivity(events, userId = null) {
    // Group events by user
    const userEventMap = {};
    
    events.forEach(event => {
      const user = event.content?.user_id || event.content?.performed_by || 'unknown';
      
      if (!userEventMap[user]) {
        userEventMap[user] = [];
      }
      
      userEventMap[user].push(event);
    });
    
    // If specific user requested, return detailed analysis for that user
    if (userId && userEventMap[userId]) {
      return this.analyzeSpecificUserActivity(userEventMap[userId]);
    }
    
    // Otherwise return summary of all user activity
    return {
      userSummaries: Object.keys(userEventMap).map(user => ({
        userId: user,
        eventCount: userEventMap[user].length,
        lastActive: userEventMap[user][0]?.created || null,
        eventTypes: this.summarizeEventTypes(userEventMap[user])
      })),
      allEvents: events
    };
  }

  /**
   * Analyze activity for a specific user
   * @param {Array} userEvents - Events for the user
   * @returns {Object} - Detailed user activity analysis
   */
  analyzeSpecificUserActivity(userEvents) {
    // Sort events by timestamp
    const sortedEvents = [...userEvents].sort((a, b) => 
      new Date(b.created) - new Date(a.created)
    );
    
    // Get event type frequency
    const eventTypes = this.summarizeEventTypes(userEvents);
    
    // Get recent actions
    const recentActions = sortedEvents.slice(0, 5).map(event => ({
      event: event.event,
      time: event.created,
      content: event.content
    }));
    
    return {
      totalActions: userEvents.length,
      mostFrequentActivities: eventTypes.slice(0, 5),
      recentActions,
      allEvents: sortedEvents
    };
  }

  /**
   * Generate a user activity summary message
   * @param {Object} userActivity - User activity analysis
   * @param {string} userId - User ID (optional)
   * @param {number} days - Number of days analyzed
   * @returns {string} - Summary message
   */
  generateUserActivitySummary(userActivity, userId = null, days = 7) {
    let message = '';
    
    // Format response based on whether a specific user was queried
    if (userId) {
      // Specific user activity
      message = `Activity for ${userId} in the last ${days} days:\n\n`;
      message += `Total Actions: ${userActivity.totalActions}\n\n`;
      
      // Most frequent activities
      if (userActivity.mostFrequentActivities.length > 0) {
        message += 'Most frequent activities:\n';
        userActivity.mostFrequentActivities.forEach(activity => {
          message += `• ${this._formatEventType(activity.type)} (${activity.count} events)\n`;
        });
        message += '\n';
      }
      
      // Recent actions
      if (userActivity.recentActions.length > 0) {
        message += 'Recent actions:\n';
        userActivity.recentActions.forEach(action => {
          const time = this._formatTimeAgo(action.time);
          let actionMessage = `- ${this._formatEventType(action.event)} (${time})`;
          
          // Add warning icon for security-critical events
          if (this._isSecurityCriticalEvent(action.event)) {
            actionMessage += ' ⚠️';
          }
          
          message += actionMessage + '\n';
        });
      }
    } else {
      // Summary of all user activity
      message = `User activity summary for the last ${days} days:\n\n`;
      message += `Active users: ${userActivity.userSummaries.length}\n\n`;
      
      // Most active users
      message += 'Most active users:\n';
      userActivity.userSummaries
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 5)
        .forEach(user => {
          const lastActive = user.lastActive ? this._formatTimeAgo(user.lastActive) : 'unknown';
          message += `• ${user.userId}: ${user.eventCount} actions (last active: ${lastActive})\n`;
        });
    }
    
    return message;
  }

  /**
   * Summarize event types from a list of events
   * @param {Array} events - List of audit log events
   * @returns {Array} - Summary of event types by frequency
   */
  summarizeEventTypes(events) {
    const eventTypeCounts = {};
    
    events.forEach(event => {
      const type = event.event;
      eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
    });
    
    return Object.entries(eventTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Check if an event is security-critical
   * @param {string} eventType - Event type
   * @returns {boolean} - Whether the event is security-critical
   */
  _isSecurityCriticalEvent(eventType) {
    const securityCriticalEvents = [
      'org.policy.create', 'org.policy.edit', 'org.policy.delete',
      'org.ignore_policy.edit',
      'org.integration.create', 'org.integration.delete', 'org.integration.edit',
      'org.service_account.create', 'org.service_account.delete', 'org.service_account.edit',
      'org.settings.feature_flag.edit',
      'org.project.ignore.create', 'org.project.ignore.delete', 'org.project.ignore.edit'
    ];
    
    return securityCriticalEvents.includes(eventType);
  }

  /**
   * Format event type for display
   * @param {string} eventType - Raw event type
   * @returns {string} - Formatted event type
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
   * Format time ago
   * @param {string} timestamp - ISO timestamp
   * @returns {string} - Human readable time ago
   */
  _formatTimeAgo(timestamp) {
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diffMs = now - eventTime;
    
    // Convert to minutes, hours, days
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  }
}

module.exports = UserActivityAnalyzer;