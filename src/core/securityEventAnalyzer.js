// src/core/securityEventAnalyzer.js

class SecurityEventAnalyzer {
  /**
   * Create a new SecurityEventAnalyzer
   * @param {SnykAuditService} auditService - The audit service to use for user information
   */
  constructor(auditService = null) {
    this.auditService = auditService;
    // Define security-critical events
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
  async categorizeSecurityEvents(events) {
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
  async generateSecuritySummary(categorizedEvents, days = 7) {
    let message = `I've checked the last ${days} days of audit logs for security events.\n\n`;
    
    // Add high priority events
    if (categorizedEvents.highPriority.length > 0) {
      message += `🔴 High Priority (${categorizedEvents.highPriority.length} events):\n`;
      for (const event of categorizedEvents.highPriority.slice(0, 5)) {
        const userDisplay = await this._formatUser(event.user_id || event.content?.user_id || event.content?.performed_by);
        const time = this._formatTimeAgo(event.created);
        message += `- ${this._formatEventType(event.event)} by ${userDisplay} (${time})\n`;
      }
      message += '\n';
    }
    
    // Add medium priority events
    if (categorizedEvents.mediumPriority.length > 0) {
      message += `🟠 Medium Priority (${categorizedEvents.mediumPriority.length} events):\n`;
      for (const event of categorizedEvents.mediumPriority.slice(0, 5)) {
        const userDisplay = await this._formatUser(event.user_id || event.content?.user_id || event.content?.performed_by);
        const time = this._formatTimeAgo(event.created);
        message += `- ${this._formatEventType(event.event)} by ${userDisplay} (${time})\n`;
      }
      message += '\n';
    }
    
    // Add low priority events with special handling for SAST settings
    if (categorizedEvents.lowPriority.length > 0) {
      message += `🟢 Low Priority: ${categorizedEvents.lowPriority.length} events\n`;
      
      // Check for SAST settings changes specifically
      const sastEvents = categorizedEvents.lowPriority.filter(event => event.event === 'org.sast_settings.edit');
      if (sastEvents.length > 0) {
        message += '\n📊 SAST Settings Changes:\n';
        for (const event of sastEvents) {
          const time = this._formatTimeAgo(event.created);
          const userDisplay = await this._formatUser(event.user_id || event.content?.user_id || event.content?.performed_by);
          
          // Extract changes from the event content
          const changes = event.content?.changes || {};
          const before = event.content?.before?.sastSettings || {};
          const after = event.content?.after?.sastSettings || {};
          
          // Check if SAST was enabled or disabled
          let sastAction = 'modified';
          let detailedChanges = [];
          
          // Check for enabled/disabled status change
          if (after.sastEnabled === true && before.sastEnabled !== true) {
            sastAction = 'enabled';
          } else if (before.sastEnabled === true && after.sastEnabled !== true) {
            sastAction = 'disabled';
          }
          
          // Check for specific setting changes
          if (changes) {
            // Check for changes in specific SAST settings
            if (changes.sastEnabled) {
              detailedChanges.push(`SAST scanning ${changes.sastEnabled.to ? 'enabled' : 'disabled'}`);
            }
            
            // Check for changes in PR checks
            if (changes.sastPullRequestEnabled) {
              detailedChanges.push(`PR checks ${changes.sastPullRequestEnabled.to ? 'enabled' : 'disabled'}`);
            }
            
            // Check for changes in severity threshold
            if (changes.sastSeverityThreshold) {
              detailedChanges.push(`severity threshold changed to ${changes.sastSeverityThreshold.to}`);
            }
          }
          
          // Create the message line
          if (detailedChanges.length > 0) {
            message += `- SAST settings modified by ${userDisplay} (${time}): ${detailedChanges.join(', ')}\n`;
          } else {
            message += `- SAST was ${sastAction} by ${userDisplay} (${time})\n`;
          }
        }
        message += '\n';
      }
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
   * Format user ID into a more readable format
   * @param {string} userId - User ID
   * @returns {string} - Formatted user display
   */
  async _formatUser(userId) {
    if (!userId) return 'unknown user';
    
    // If we have an audit service, use it to get user information
    if (this.auditService) {
      try {
        return await this.auditService.formatUserDisplay(userId);
      } catch (error) {
        console.error(`Error formatting user: ${error.message}`);
      }
    }
    
    // Fallback to simple formatting if no audit service or if there was an error
    const shortId = userId.substring(0, 8);
    return `user ${shortId}`;
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