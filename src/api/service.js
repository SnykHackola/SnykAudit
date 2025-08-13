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
   * @param {string} userId - User ID (optional)
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
      let events;
      
      if (userId) {
        // Get activity for specific user
        events = await this.client.getUserAuditLogs(orgId, userId, fromDate);
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
      throw error;
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