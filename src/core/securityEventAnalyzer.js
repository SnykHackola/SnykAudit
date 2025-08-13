// src/core/securityEventAnalyzer.js

class SecurityEventAnalyzer {
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
    
    // Define high priority events
    this.highPriorityEvents = [
      'org.policy.create', 'org.policy.delete',
      'org.service_account.create',
      'org.webhook.add'
    ];
    
    // Define medium priority events
    this.mediumPriorityEvents = [
      'org.policy.edit',
      'org.integration.create', 'org.integration.edit',
      'org.settings.feature_flag.edit',
      'org.project.ignore.create'
    ];
  }

  /**
   * Categorize security events by severity
   * @param {Array} events - List of audit log events
   * @returns {Object} - Events categorized by severity
   */
  categorizeSecurityEvents(events) {
    const result = {
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
      all: events
    };
    
    // Categorize each event
    events.forEach(event => {
      if (this.highPriorityEvents.includes(event.event)) {
        result.highPriority.push(event);
      } else if (this.mediumPriorityEvents.includes(event.event)) {
        result.mediumPriority.push(event);
      } else {
        result.lowPriority.push(event);
      }
    });
    
    return result;
  }

  /**
   * Summarize security events
   * @param {Object} categorizedEvents - Events categorized by severity
   * @returns {string} - Summary message
   */
  generateSecuritySummary(categorizedEvents, days = 7) {
    let message = `I've checked the last ${days} days of audit logs for security events.\n\n`;
    
    // Add high priority events
    if (categorizedEvents.highPriority.length > 0) {
      message += `🔴 High Priority (${categorizedEvents.highPriority.length} events):\n`;
      categorizedEvents.highPriority.slice(0, 5).forEach(event => {
        const user = event.content?.user_id || event.content?.performed_by || 'unknown';
        const time = this._formatTimeAgo(event.created);
        message += `- ${this._formatEventType(event.event)} by ${user} (${time})\n`;
      });
      message += '\n';
    }
    
    // Add medium priority events
    if (categorizedEvents.mediumPriority.length > 0) {
      message += `🟠 Medium Priority (${categorizedEvents.mediumPriority.length} events):\n`;
      categorizedEvents.mediumPriority.slice(0, 5).forEach(event => {
        const user = event.content?.user_id || event.content?.performed_by || 'unknown';
        const time = this._formatTimeAgo(event.created);
        message += `- ${this._formatEventType(event.event)} by ${user} (${time})\n`;
      });
      message += '\n';
    }
    
    // Add summary of low priority events
    if (categorizedEvents.lowPriority.length > 0) {
      message += `🟢 Low Priority: ${categorizedEvents.lowPriority.length} events\n\n`;
    }
    
    // If no events found
    if (categorizedEvents.all.length === 0) {
      message = `Good news! I didn't find any security events in the last ${days} days.`;
    }
    
    return message;
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

module.exports = SecurityEventAnalyzer;