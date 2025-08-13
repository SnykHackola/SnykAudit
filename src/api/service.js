// src/api/service.js

/**
 * Snyk Audit API Service
 * 
 * This service provides higher-level functions for accessing Snyk audit data,
 * wrapping the lower-level API client with business logic and data transformation.
 */

const SnykApiClient = require('./client');
const { defaultLogger, daysAgo, isBusinessHours } = require('../utils');

// Create a logger for this module
const logger = defaultLogger.child('SnykAuditService');

class SnykAuditService {
  /**
   * Create a new Snyk Audit Service
   * @param {string} apiKey - Snyk API key
   * @param {Object} config - Service configuration
   */
  constructor(apiKey, config = {}) {
    this.client = new SnykApiClient(apiKey, config);
    this.config = {
      orgId: config.orgId,
      groupId: config.groupId,
      defaultDays: config.defaultDays || 7,
      businessHoursStart: config.businessHoursStart || 9,
      businessHoursEnd: config.businessHoursEnd || 17,
      ...config
    };
    
    // User cache to avoid repeated API calls for the same user
    this.userCache = new Map();
    
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
    
    logger.info('Snyk Audit Service initialized');
  }

  /**
   * Get all events from the specified number of days ago
   * @param {number} days - Number of days to look back
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @returns {Promise<Array>} - List of audit log events
   */
  async getAllEvents(days = this.config.defaultDays, orgId = this.config.orgId) {
    this._validateOrgId(orgId);
    
    const fromDate = daysAgo(days);
    const toDate = new Date();
    
    logger.info(`Fetching all events from ${days} days ago`, { fromDate, orgId });
    
    try {
      const events = await this.client.getAllOrgAuditLogs(orgId, fromDate, toDate);
      logger.info(`Retrieved ${events.length} events`);
      return events;
    } catch (error) {
      logger.error('Failed to fetch all events', error);
      throw error;
    }
  }

  /**
   * Get security events from the specified number of days ago
   * @param {number} days - Number of days to look back
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @returns {Promise<Array>} - List of security-related audit log events
   */
  async getSecurityEvents(days = this.config.defaultDays, orgId = this.config.orgId) {
    this._validateOrgId(orgId);
    
    const fromDate = daysAgo(days);
    
    logger.info(`Fetching security events from ${days} days ago`, { fromDate, orgId });
    
    try {
      const events = await this.client.getSecurityAuditLogs(orgId, fromDate);
      logger.info(`Retrieved ${events.length} security events`);
      return events;
    } catch (error) {
      logger.error('Failed to fetch security events', error);
      throw error;
    }
  }

  /**
   * Get user activity from the specified number of days ago
   * @param {string} userId - User ID or name (optional)
   * @param {number} days - Number of days to look back
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @returns {Promise<Array>} - List of user activity audit log events
   */
  async getUserActivity(userId = null, days = this.config.defaultDays, orgId = this.config.orgId) {
    this._validateOrgId(orgId);
    
    const fromDate = daysAgo(days);
    
    logger.info(`Fetching user activity from ${days} days ago`, { 
      userId: userId || 'all users', 
      fromDate, 
      orgId 
    });
    
    try {
      let events = [];
      
      if (userId) {
        // Check if userId is a UUID (Snyk API requires UUIDs for audit log filtering)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        
        if (isUuid) {
          // If it's a UUID, use it directly
          events = await this.client.getUserAuditLogs(orgId, userId, fromDate);
        } else {
          // If it's not a UUID, it's likely a name - try to find the user in the org
          logger.info(`Looking up user ID for name: ${userId}`);
          
          // Get all organization users
          const orgUsers = await this.getAllOrgUsers(orgId);
          
          // Try to find a matching user
          const matchingUser = orgUsers.find(user => 
            (user.name && user.name.toLowerCase() === userId.toLowerCase()) || 
            (user.username && user.username.toLowerCase() === userId.toLowerCase()) || 
            (user.email && user.email.toLowerCase() === userId.toLowerCase())
          );
          
          if (matchingUser && matchingUser.id) {
            logger.info(`Found matching user ID: ${matchingUser.id} for name: ${userId}`);
            // Use the UUID to fetch audit logs
            events = await this.client.getUserAuditLogs(orgId, matchingUser.id, fromDate);
          } else {
            // No matching user found, return empty array
            logger.info(`No matching user found for name: ${userId}`);
            return [];
          }
        }
      } else {
        // Get activity for all users focusing on user-related events
        events = await this.client.getAllOrgAuditLogs(
          orgId, 
          fromDate, 
          new Date(),
          { events: this.userActivityEvents }
        );
      }
      
      logger.info(`Retrieved ${events.length} user activity events`);
      return events;
    } catch (error) {
      logger.error('Failed to fetch user activity', error);
      // Return empty array instead of throwing to make the function more resilient
      return [];
    }
  }

  /**
   * Get events from a specific time range
   * @param {Date|string} fromDate - Start date
   * @param {Date|string} toDate - End date
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @returns {Promise<Array>} - List of audit log events
   */
  async getEventsByTimeRange(fromDate, toDate, orgId = this.config.orgId) {
    this._validateOrgId(orgId);
    
    logger.info(`Fetching events from time range`, { fromDate, toDate, orgId });
    
    try {
      const events = await this.client.getAllOrgAuditLogs(orgId, fromDate, toDate);
      logger.info(`Retrieved ${events.length} events for time range`);
      return events;
    } catch (error) {
      logger.error('Failed to fetch events by time range', error);
      throw error;
    }
  }

  /**
   * Summarize events in a time range
   * @param {Array} events - List of audit log events
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Object} - Summary of events
   */
  async summarizeTimeRangeEvents(events, startDate, endDate) {
    // Count unique users
    const uniqueUsers = new Set();
    events.forEach(event => {
      const user = event.content?.user_id || event.content?.performed_by;
      if (user) uniqueUsers.add(user);
    });
    
    // Group events by type
    const eventTypeCount = {};
    events.forEach(event => {
      const type = event.event;
      eventTypeCount[type] = (eventTypeCount[type] || 0) + 1;
    });
    
    // Sort event types by frequency
    const sortedEventTypes = Object.entries(eventTypeCount)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
    
    // Identify security-critical events
    const securityEvents = events.filter(event => 
      this.securityCriticalEvents.includes(event.event)
    );
    
    // Identify after-hours events
    const afterHoursEvents = events.filter(event => {
      const eventTime = new Date(event.created);
      return !isBusinessHours(
        eventTime, 
        this.config.businessHoursStart, 
        this.config.businessHoursEnd
      );
    });
    
    return {
      totalEvents: events.length,
      uniqueUserCount: uniqueUsers.size,
      uniqueUsers: Array.from(uniqueUsers),
      eventTypeSummary: sortedEventTypes,
      securityEvents,
      afterHoursEvents,
      allEvents: events,
      timeRange: { startDate, endDate }
    };
  }

  /**
   * Get project-related events
   * @param {string} projectId - Project ID
   * @param {number} days - Number of days to look back
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @returns {Promise<Array>} - List of project-related audit log events
   */
  async getProjectEvents(projectId, days = this.config.defaultDays, orgId = this.config.orgId) {
    this._validateOrgId(orgId);
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    const fromDate = daysAgo(days);
    
    logger.info(`Fetching project events from ${days} days ago`, { 
      projectId, 
      fromDate, 
      orgId 
    });
    
    try {
      const events = await this.client.getProjectAuditLogs(orgId, projectId, fromDate);
      logger.info(`Retrieved ${events.length} project events`);
      return events;
    } catch (error) {
      logger.error('Failed to fetch project events', error);
      throw error;
    }
  }

  /**
   * Get after-hours activity
   * @param {number} days - Number of days to look back
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @returns {Promise<Array>} - List of after-hours audit log events
   */
  /**
   * Get user information by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User information
   */
  async getUserInfo(userId) {
    if (!userId) {
      return { id: null, name: 'unknown user', username: null, email: null, displayName: 'unknown user' };
    }
    
    // Check if we have this user in cache
    if (this.userCache.has(userId)) {
      logger.debug(`Using cached user info for ${userId}`);
      return this.userCache.get(userId);
    }
    
    // Create a basic user info object from the ID
    // This ensures we always have something to return even if the API call fails
    const shortId = userId.substring(0, 8);
    const basicUserInfo = {
      id: userId,
      name: shortId,
      username: null,
      email: null,
      displayName: `user ${shortId}`
    };
    
    try {
      // Only attempt to call the API if we have a valid client
      if (this.client && typeof this.client.getUserById === 'function') {
        logger.debug(`Fetching user info for ${userId}`);
        
        try {
          const userData = await this.client.getUserById(userId);
          
          // If we got valid data back, enhance our user info
          if (userData) {
            // Extract user information from the response
            // The API returns data in a nested structure: data.attributes.name, etc.
            const name = userData.data?.attributes?.name || null;
            const email = userData.data?.attributes?.email || null;
            const username = userData.data?.attributes?.username || null;
            
            // Create a user-friendly display name
            let displayName;
            if (name && email) {
              displayName = `${name} (${email})`;
            } else if (name) {
              displayName = name;
            } else if (email) {
              displayName = email;
            } else {
              displayName = `user ${shortId}`;
            }
            
            // Update the user info object
            basicUserInfo.name = name || shortId;
            basicUserInfo.username = username;
            basicUserInfo.email = email;
            basicUserInfo.displayName = displayName;
            
            logger.debug(`Successfully retrieved user info for ${userId}: ${displayName}`);
          }
        } catch (apiError) {
          // Log the error but continue with basic info
          logger.error(`API error fetching user info: ${apiError.message}`, { userId });
        }
      }
      
      // Cache the user information (either enhanced or basic)
      this.userCache.set(userId, basicUserInfo);
      return basicUserInfo;
    } catch (error) {
      logger.error(`Error in getUserInfo: ${error.message}`, { userId });
      // Return the basic info and cache it to avoid repeated failed calls
      this.userCache.set(userId, basicUserInfo);
      return basicUserInfo;
    }
  }
  
  /**
   * Format user ID into a user-friendly display name
   * @param {string} userId - User ID
   * @returns {Promise<string>} - User display name
   */
  async formatUserDisplay(userId) {
    if (!userId) return 'unknown user';
    
    try {
      const userInfo = await this.getUserInfo(userId);
      // Use the displayName property if available, otherwise fall back to other properties
      return userInfo.displayName || userInfo.name || userInfo.username || `user ${userId.substring(0, 8)}`;
    } catch (error) {
      logger.error(`Error formatting user display: ${error.message}`, { userId });
      return `user ${userId.substring(0, 8)}`;
    }
  }
  
  async getAfterHoursActivity(days = this.config.defaultDays, orgId = this.config.orgId) {
    this._validateOrgId(orgId);
    
    const fromDate = daysAgo(days);
    
    logger.info(`Fetching after-hours activity from ${days} days ago`, { 
      fromDate, 
      orgId,
      businessHours: {
        start: this.config.businessHoursStart,
        end: this.config.businessHoursEnd
      }
    });
    
    try {
      // Get all events for the time period
      const allEvents = await this.client.getAllOrgAuditLogs(orgId, fromDate, new Date());
      
      // Filter for after-hours events
      const afterHoursEvents = allEvents.filter(event => {
        const eventTime = new Date(event.created);
        return !isBusinessHours(
          eventTime, 
          this.config.businessHoursStart, 
          this.config.businessHoursEnd
        );
      });
      
      logger.info(`Retrieved ${afterHoursEvents.length} after-hours events`);
      return afterHoursEvents;
    } catch (error) {
      logger.error('Failed to fetch after-hours activity', error);
      throw error;
    }
  }
  
  /**
   * Get all users in the organization
   * @param {string} orgId - Organization ID (optional, uses default if not provided)
   * @param {boolean} forceRefresh - Whether to force a refresh of the cached users
   * @returns {Promise<Array>} - List of users in the organization with their details
   */
  async getAllOrgUsers(orgId = this.config.orgId, forceRefresh = false) {
    this._validateOrgId(orgId);
    
    // Check if we have a cached list of users and it's not a forced refresh
    if (this._orgUsersCache && !forceRefresh) {
      logger.debug('Using cached organization users');
      return this._orgUsersCache;
    }
    
    logger.info(`Fetching all users in organization ${orgId}`);
    
    try {
      // Get all users from the API
      const users = await this.client.getAllOrgUsers(orgId);
      
      // Process the user data to match our internal format
      const processedUsers = users.map(user => {
        const userData = user.attributes || {};
        
        return {
          id: user.id,
          name: userData.name || null,
          username: userData.username || null,
          email: userData.email || null,
          displayName: userData.name ? 
            (userData.email ? `${userData.name} (${userData.email})` : userData.name) : 
            (userData.email || `user ${user.id.substring(0, 8)}`)
        };
      });
      
      // Cache the processed users
      this._orgUsersCache = processedUsers;
      
      // Also update the individual user cache for each user
      processedUsers.forEach(user => {
        this.userCache.set(user.id, user);
      });
      
      logger.info(`Retrieved ${processedUsers.length} users from organization ${orgId}`);
      return processedUsers;
    } catch (error) {
      // Get the error type from the client if available
      const errorType = error.errorType || 'Unknown error';
      
      logger.error(`Failed to fetch organization users: ${error.message}`, { orgId, errorType });
      
      // Return empty array instead of throwing to make the function more resilient
      return [];
    }
  }

  /**
   * Validate that an organization ID is provided
   * @param {string} orgId - Organization ID to validate
   * @throws {Error} - If no organization ID is provided
   * @private
   */
  _validateOrgId(orgId) {
    if (!orgId) {
      logger.error('No organization ID provided');
      throw new Error('Organization ID is required');
    }
  }
}

module.exports = SnykAuditService;