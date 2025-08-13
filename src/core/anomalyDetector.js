// src/core/anomalyDetector.js

class AnomalyDetector {
  constructor() {
    // Define security-critical events
    this.securityCriticalEvents = [
      'org.policy.create', 'org.policy.edit', 'org.policy.delete',
      'org.ignore_policy.edit',
      'org.integration.create', 'org.integration.delete', 'org.integration.edit',
      'org.service_account.create', 'org.service_account.delete', 'org.service_account.edit',
      'org.settings.feature_flag.edit',
      'org.project.ignore.create', 'org.project.ignore.delete', 'org.project.ignore.edit',
      'org.sast_settings.edit',
      'org.webhook.add', 'org.webhook.delete'
    ];
    
    // Define user activity events
    this.userActivityEvents = [
      'org.user.add', 'org.user.remove',
      'org.user.role.edit', 'org.user.role.create', 'org.user.role.delete',
      'org.user.invite', 'org.user.invite.accept', 'org.user.invite.revoke',
      'org.user.leave',
      'api.access'
    ];
    
    // Define business hours (8 AM to 6 PM by default)
    this.businessHoursStart = 8;
    this.businessHoursEnd = 18;
  }

  /**
   * Set business hours
   * @param {number} start - Start hour (0-23)
   * @param {number} end - End hour (0-23)
   */
  setBusinessHours(start, end) {
    this.businessHoursStart = start;
    this.businessHoursEnd = end;
  }

  /**
   * Detect anomalous or suspicious activities
   * @param {Array} events - List of audit log events
   * @returns {Array} - List of suspicious activities
   */
  detectAnomalies(events) {
    const suspiciousActivities = [];
    
    // 1. Check for unusual volume of similar actions by the same user
    const userEventCounts = this._countUserEventTypes(events);
    
    // Look for users with high counts of security-sensitive events
    Object.keys(userEventCounts).forEach(user => {
      Object.keys(userEventCounts[user]).forEach(eventType => {
        const count = userEventCounts[user][eventType];
        
        // If a user performs the same security-critical action many times
        if (count > 5 && this.securityCriticalEvents.includes(eventType)) {
          suspiciousActivities.push({
            type: 'high_volume_sensitive_actions',
            user,
            eventType,
            count,
            severity: 'medium',
            description: `User ${user} performed ${eventType} ${count} times`
          });
        }
      });
    });
    
    // 2. Check for after-hours activity
    events.forEach(event => {
      const eventTime = new Date(event.created);
      const hour = eventTime.getUTCHours();
      
      // Check if event occurred outside business hours
      if ((hour < this.businessHoursStart || hour > this.businessHoursEnd) && 
          this.securityCriticalEvents.includes(event.event)) {
        const user = event.content?.user_id || event.content?.performed_by || 'unknown';
        
        suspiciousActivities.push({
          type: 'after_hours_activity',
          user,
          eventType: event.event,
          time: event.created,
          severity: 'medium',
          description: `After-hours security-critical activity: ${event.event} by ${user} at ${eventTime.toISOString()}`
        });
      }
    });
    
    // 3. Check for service account unusual activity
    events.forEach(event => {
      const user = event.content?.user_id || event.content?.performed_by || 'unknown';
      
      // If user name contains service, bot, or automation
      if (
        (user.toLowerCase().includes('service') ||
         user.toLowerCase().includes('bot') ||
         user.toLowerCase().includes('auto') ||
         user.toLowerCase().includes('jenkins')) &&
        !event.event.startsWith('org.project.test') &&  // Filter out normal CI activities
        this.securityCriticalEvents.includes(event.event)
      ) {
        suspiciousActivities.push({
          type: 'service_account_unusual_activity',
          user,
          eventType: event.event,
          time: event.created,
          severity: 'high',
          description: `Service account ${user} performed security-critical action ${event.event}`
        });
      }
    });
    
    return suspiciousActivities;
  }

  /**
   * Generate a summary message for suspicious activities
   * @param {Array} suspiciousActivities - List of suspicious activities
   * @param {number} days - Number of days analyzed
   * @returns {string} - Summary message
   */
  generateSuspiciousActivitySummary(suspiciousActivities, days = 2) {
    let message = '';
    
    if (suspiciousActivities.length > 0) {
      message = `I've detected these potentially suspicious activities in the last ${days} days:\n\n`;
      
      // Group by type
      const groupedActivities = {};
      suspiciousActivities.forEach(activity => {
        if (!groupedActivities[activity.type]) {
          groupedActivities[activity.type] = [];
        }
        groupedActivities[activity.type].push(activity);
      });
      
      // Format each type of suspicious activity
      Object.keys(groupedActivities).forEach(type => {
        const activities = groupedActivities[type];
        
        switch (type) {
          case 'high_volume_sensitive_actions':
            activities.forEach(activity => {
              message += `⚠️ User ${activity.user} performed ${activity.count} ${this._formatEventType(activity.eventType)} actions\n`;
            });
            break;
            
          case 'after_hours_activity':
            activities.forEach(activity => {
              const time = new Date(activity.time).toLocaleTimeString();
              message += `⚠️ After-hours activity: ${this._formatEventType(activity.eventType)} by ${activity.user} at ${time}\n`;
            });
            break;
            
          case 'service_account_unusual_activity':
            activities.forEach(activity => {
              message += `⚠️ Service account "${activity.user}" performed unusual action: ${this._formatEventType(activity.eventType)}\n`;
            });
            break;
            
          default:
            activities.forEach(activity => {
              message += `⚠️ ${activity.description}\n`;
            });
        }
        
        message += '\n';
      });
    } else {
      message = `Good news! I didn't detect any suspicious activities in the last ${days} days.`;
    }
    
    return message;
  }

  /**
   * Count event types per user
   * @param {Array} events - List of audit log events
   * @returns {Object} - Counts of event types by user
   * @private
   */
  _countUserEventTypes(events) {
    const userEventCounts = {};
    
    events.forEach(event => {
      const user = event.content?.user_id || event.content?.performed_by || 'unknown';
      const eventType = event.event;
      
      if (!userEventCounts[user]) {
        userEventCounts[user] = {};
      }
      
      userEventCounts[user][eventType] = (userEventCounts[user][eventType] || 0) + 1;
    });
    
    return userEventCounts;
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
}

module.exports = AnomalyDetector;