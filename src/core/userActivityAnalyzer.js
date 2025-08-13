// src/core/userActivityAnalyzer.js

class UserActivityAnalyzer {
  /**
   * Constructor for UserActivityAnalyzer
   * @param {Object} auditService - Optional SnykAuditService instance for user lookups
   * @param {string} orgId - Optional organization ID for API calls
   */
  constructor(auditService = null, orgId = null) {
    this.auditService = auditService;
    this.orgId = orgId || (auditService && auditService.config && auditService.config.orgId);
    
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
   * @returns {Promise<Object>} - User activity analysis
   */
  async analyzeUserActivity(events, userId = null) {
    // Initialize API error type and org users available flag
    this.lastApiErrorType = null;
    let orgUsersAvailable = false; // Initialize here to avoid reference errors
    
    // Group events by user
    const userEventMap = {};
    
    events.forEach(event => {
      const user = event.user_id || event.content?.user_id || event.content?.performed_by || 'unknown';
      
      if (!userEventMap[user]) {
        userEventMap[user] = [];
      }
      
      userEventMap[user].push(event);
    });
    
    // If specific user requested by name or ID, try to find them
    if (userId) {
      // First check if we have direct match by ID
      if (userEventMap[userId]) {
        return await this.analyzeSpecificUserActivity(userEventMap[userId]);
      }
      
      // If no direct match and we have an audit service, try to find by name
      if (this.auditService) {
        console.log(`Searching for user by name: ${userId}`);
        
        // Get all organization users first
        let orgUsers = [];
        let orgUsersAvailable = true;
        try {
          // Use the organization ID from the class property
          console.log(`Using organization ID: ${this.orgId}`);
          
          // Pass the organization ID explicitly
          if (this.orgId) {
            try {
              orgUsers = await this.auditService.getAllOrgUsers(this.orgId);
            } catch (error) {
              // If there's an error type from the API client, capture it
              if (error.errorType) {
                this.lastApiErrorType = error.errorType;
                console.log(`API error captured: ${error.errorType}`);
              }
              orgUsers = [];
            }
          } else {
            throw new Error('No organization ID available');
          }
          console.log(`Retrieved ${orgUsers.length} organization users`);
          
          // Check if we actually got any users
          if (orgUsers.length === 0) {
            console.log('No users found in the organization');
            orgUsersAvailable = false;
          }
        } catch (error) {
          console.error('Error getting organization users:', error);
          orgUsersAvailable = false;
          
          // Check for specific error types and store the error type
          let apiErrorType = 'Unknown API error';
          
          if (error.message) {
            if (error.message.includes('401')) {
              apiErrorType = 'Authentication error: API key may be invalid or expired';
              console.log(apiErrorType);
            } else if (error.message.includes('403')) {
              apiErrorType = 'Permission error: API key may not have sufficient permissions';
              console.log(apiErrorType);
            } else if (error.message.includes('404')) {
              apiErrorType = 'Not found error: Organization ID may be invalid';
              console.log(apiErrorType);
            } else if (error.response && error.response.status) {
              apiErrorType = `API error: Status ${error.response.status}`;
              console.log(apiErrorType);
            }
          }
          
          // Store the error type for later use
          this.lastApiErrorType = apiErrorType;
          
          // Continue with the fallback approach if we can't get org users
        }
        
        // First try to find a match in the organization users
        if (orgUsers.length > 0) {
          const matchingUser = orgUsers.find(user => 
            user.name && user.name.toLowerCase() === userId.toLowerCase());
          
          if (matchingUser) {
            console.log(`Found matching user in org users: ${matchingUser.id} (${matchingUser.name})`);
            
            // Check if we have events for this user
            if (userEventMap[matchingUser.id]) {
              return await this.analyzeSpecificUserActivity(userEventMap[matchingUser.id]);
            } else {
              // We found the user in the org but they have no events
              return {
                userId: matchingUser.id,
                userName: matchingUser.name,
                userEmail: matchingUser.email,
                totalActions: 0,
                mostFrequentActivities: [],
                recentActions: [],
                knownUser: true,  // Flag to indicate this is a known user with no activity
                allOrgUsers: orgUsers,  // Include all org users for reference
                orgUsersAvailable: orgUsersAvailable,  // Flag to indicate if org users list was available
                apiErrorType: this.lastApiErrorType  // Include any API error type that occurred
              };
            }
          } else {
            // User name not found in the organization
            return {
              userId: userId,
              totalActions: 0,
              mostFrequentActivities: [],
              recentActions: [],
              knownUser: false,  // Flag to indicate this is not a known user
              allOrgUsers: orgUsers,  // Include all org users for reference
              orgUsersAvailable: orgUsersAvailable,  // Flag to indicate if org users list was available
              apiErrorType: this.lastApiErrorType  // Include any API error type that occurred
            };
          }
        }
        
        // Fallback: Try to find a user whose name matches in the event data
        const allUserIds = Object.keys(userEventMap).filter(id => id !== 'unknown');
        
        for (const id of allUserIds) {
          try {
            const userInfo = await this.auditService.getUserInfo(id);
            console.log(`Checking user: ${JSON.stringify(userInfo)}`);
            
            // Check if the user's name matches (case insensitive)
            if (userInfo.name && userInfo.name.toLowerCase() === userId.toLowerCase()) {
              console.log(`Found matching user: ${id} (${userInfo.name})`);
              return await this.analyzeSpecificUserActivity(userEventMap[id]);
            }
          } catch (error) {
            console.error(`Error checking user ${id}:`, error);
          }
        }
        
        console.log(`No user found with name: ${userId}`);
      }
    }
    
    // Otherwise return summary of all user activity (or an empty summary if no events)
    return {
      userSummaries: Object.keys(userEventMap).map(user => ({
        userId: user,
        eventCount: userEventMap[user].length,
        lastActive: userEventMap[user][0]?.created || null,
        eventTypes: this.summarizeEventTypes(userEventMap[user])
      })),
      allEvents: events,
      orgUsersAvailable: orgUsersAvailable,
      apiErrorType: this.lastApiErrorType  // Include any API error type that occurred
    };
  }

  /**
   * Analyze activity for a specific user
   * @param {Array} userEvents - Events for the user
   * @returns {Promise<Object>} - Detailed user activity analysis
   */
  async analyzeSpecificUserActivity(userEvents) {
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
      allEvents: sortedEvents,
      knownUser: true,  // This is a known user with activity
      apiErrorType: this.lastApiErrorType  // Include any API error type that occurred
    };
  }

  /**
   * Generate a user activity summary message
   * @param {Object} userActivity - User activity analysis
   * @param {string} userId - User ID (optional)
   * @param {number} days - Number of days analyzed
   * @returns {Promise<string>} - Summary message
   */
  async generateUserActivitySummary(userActivity, userId = null, days = 7) {
    let message = '';
    
    // Handle specific user activity
    if (userId) {
      // Check if this is an unknown user
      if (userActivity && userActivity.knownUser === false) {
        message = `I didn't find any user named "${userId}" in your organization.`;
        
        // Add list of valid users as suggestions
        if (userActivity.allOrgUsers && userActivity.allOrgUsers.length > 0) {
          const orgUsers = userActivity.allOrgUsers
            .filter(user => user.name) // Only include users with names
            .slice(0, 10); // Limit to 10 users
          
          if (orgUsers.length > 0) {
            message += '\n\nHere are some users you can ask about:\n';
            orgUsers.forEach(user => {
              message += `• ${user.name}\n`;
            });
            message += '\nPlease try your query again with one of these user names.';
          } else {
            message += '\n\nI found no users with names in your organization. This could be due to API limitations or permissions.';
          }
        } else if (userActivity.orgUsersAvailable === false) {
          // We know specifically that org users list is empty
          message = `I couldn't find any users in your organization. This could be due to one of the following reasons:\n\n`;
          message += `• Your API key doesn't have sufficient permissions to list organization members\n`;
          message += `• The organization ID may be incorrect\n`;
          message += `• There might be no users in this organization\n`;
          
          // Add specific error message if available
          if (userActivity.apiErrorType) {
            message += `\nDetected issue: ${userActivity.apiErrorType}\n`;
            
            // Add specific recommendations based on error type
            if (userActivity.apiErrorType.includes('Authentication error')) {
              message += `\nRecommendation: Please check your API key or generate a new one in your Snyk account settings.\n`;
            } else if (userActivity.apiErrorType.includes('Permission error')) {
              message += `\nRecommendation: Ensure your API key has the necessary permissions to view organization members.\n`;
            } else if (userActivity.apiErrorType.includes('Not found error')) {
              message += `\nRecommendation: Verify that the organization ID is correct in your configuration.\n`;
            }
          }
          
          message += `\nPlease verify your API key permissions and organization settings.`;
        } else {
          message += '\nI couldn\'t retrieve the list of users in your organization. Please try again with a valid user name or ID.';
        }
        
        return message;
      }
      
      // Handle case where user exists but has no activity
      if (userActivity && userActivity.knownUser === true && userActivity.totalActions === 0) {
        const userDisplay = userActivity.userName ? 
          (userActivity.userEmail ? `${userActivity.userName} (${userActivity.userEmail})` : userActivity.userName) :
          await this._formatUser(userActivity.userId);
          
        message = `${userDisplay} is a known user in your organization, but I didn't find any activity for them in the last ${days} days.`;
        return message;
      }
      
      const userDisplay = await this._formatUser(userId);
      
      if (userActivity.totalActions && userActivity.totalActions > 0) {
        message = `Activity summary for ${userDisplay} over the last ${days} days:\n\n`;
        message += `Total actions: ${userActivity.totalActions}\n`;
        
        if (userActivity.eventTypeSummary && userActivity.eventTypeSummary.length > 0) {
          message += '\nMost frequent activities:\n';
          userActivity.eventTypeSummary.slice(0, 5).forEach(activity => {
            message += `• ${this._formatEventType(activity.type)} (${activity.count} events)\n`;
          });
          message += '\n';
        }
        
        if (userActivity.recentActions && userActivity.recentActions.length > 0) {
          message += 'Recent actions:\n';
          
          // Process actions one by one to allow async user formatting
          for (const action of userActivity.recentActions) {
            // Handle different field naming conventions in the event data
            const eventType = action.event_type || action.event;
            const timestamp = action.created || action.time;
            
            const time = this._formatTimeAgo(timestamp);
            let actionMessage = `- ${this._formatEventType(eventType)} (${time})`;
            
            if (this._isSecurityCriticalEvent(eventType)) {
              actionMessage += ' ⚠️';
            }
            
            message += actionMessage + '\n';
            
            // Add details for specific event types
            if (action.content) {
              if (eventType === 'org.user.role.edit') {
                message += `  Changed role to: ${action.content.role_name || 'unknown role'}\n`;
              } else if (eventType === 'org.user.invite') {
                message += `  Invited user: ${action.content.email || 'unknown email'}\n`;
              }
            }
          }
        }
      } else if (userActivity.knownUser === true) {
        // Known user but no activity
        message = `${userDisplay} is a known user in the organization but hasn't performed any actions in the last ${days} days.`;
      } else {
        // Generic message for when no activity is found for a user
        message = `I didn't find any activity for user ${userDisplay} in the last ${days} days.`;
      }
    } else {
      if (userActivity && userActivity.userSummaries && userActivity.userSummaries.length > 0) {
        message = `User activity summary for the last ${days} days:\n\n`;
        message += `Active users: ${userActivity.userSummaries.length}\n\n`;
        
        message += 'Most active users:\n';
        
        // Process user summaries one by one to allow async user formatting
        const sortedUsers = [...userActivity.userSummaries]
          .sort((a, b) => b.eventCount - a.eventCount)
          .slice(0, 5);
          
        for (const user of sortedUsers) {
          const lastActive = user.lastActive ? this._formatTimeAgo(user.lastActive) : 'unknown';
          const userDisplay = await this._formatUser(user.userId);
          message += `• ${userDisplay}: ${user.eventCount} actions (last active: ${lastActive})\n`;
        }
        
        // Add a list of all users if there are more than shown in the top 5
        if (userActivity.userSummaries.length > 5) {
          message += '\nAll users who performed actions:\n';
          
          // Format each user ID and join them
          const userDisplays = [];
          for (const user of userActivity.userSummaries) {
            const userDisplay = await this._formatUser(user.userId);
            userDisplays.push(userDisplay);
          }
          
          message += userDisplays.join(', ');
        }
      } else {
        message = `I didn't find any user activity in the last ${days} days.`;
      }
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
    // Handle null or undefined event types
    if (!eventType) {
      return 'unknown event';
    }
    
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
   * Format user ID into a user-friendly display name
   * @param {string} userId - User ID
   * @returns {Promise<string>} - User display name
   */
  async _formatUser(userId) {
    if (!userId || userId === 'unknown') return 'unknown user';
    
    if (this.auditService) {
      try {
        // If userId looks like a name (not a UUID), return it directly with proper formatting
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          // This appears to be a name, not an ID
          return userId; // Return the name as is
        }
        
        return await this.auditService.formatUserDisplay(userId);
      } catch (error) {
        console.error(`Error formatting user: ${error.message}`);
      }
    }
    
    // Fallback if no audit service or error occurs
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return userId; // If it's not a UUID, return as is
    }
    
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

module.exports = UserActivityAnalyzer;
