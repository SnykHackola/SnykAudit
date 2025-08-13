// src/api/client.js

/**
 * Snyk Audit API Client
 * 
 * This client handles the low-level communication with the Snyk Audit API,
 * including authentication, request formatting, and error handling.
 */

const { httpGet, requestWithRetry, parseHttpError, defaultLogger } = require('../utils');
const axios = require('axios');

// Create a logger for this module
const logger = defaultLogger.child('SnykApiClient');

class SnykApiClient {
  /**
   * Create a new Snyk API client
   * @param {string} apiKey - Snyk API key
   * @param {Object} config - Client configuration
   */
  constructor(apiKey, config = {}) {
    if (!apiKey) {
      throw new Error('Snyk API key is required');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl || 'https://api.snyk.io';
    this.apiVersion = config.apiVersion || '2021-06-04'; // API version from Snyk documentation
    this.timeout = config.timeout || 10000;
    this.retryConfig = {
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      retryStatusCodes: [408, 429, 500, 502, 503, 504]
    };
  }

  /**
   * Create HTTP client with proper authentication headers
   * @returns {Object} - Axios instance
   * @private
   */
  _createClient() {
    return axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Authorization': this.apiKey,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'snyk-version-requested': this.apiVersion
      }
    });
  }

  /**
   * Make a request to the Snyk API
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _request(config) {
    try {
      logger.debug(`Making ${config.method} request to ${config.url}`, config.params);
      
      const client = this._createClient();
      const response = await requestWithRetry(config, this.retryConfig);
      
      logger.debug(`Received response from ${config.url}`, { 
        status: response.status,
        dataSize: JSON.stringify(response.data).length
      });
      
      return response.data;
    } catch (error) {
      const httpError = parseHttpError(error);
      logger.error(`API request failed: ${httpError.message}`, {
        url: config.url,
        method: config.method,
        status: httpError.status
      });
      
      throw httpError;
    }
  }

  /**
   * Search organization audit logs
   * @param {string} orgId - Organization ID
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Audit log results
   */
  async searchOrgAuditLogs(orgId, params = {}) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }
    
    const url = `/rest/orgs/${orgId}/audit_logs/search`;
    return this._request({
      url,
      method: 'get',
      params: this._formatAuditParams(params)
    });
  }

  /**
   * Search group audit logs
   * @param {string} groupId - Group ID
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} - Audit log results
   */
  async searchGroupAuditLogs(groupId, params = {}) {
    if (!groupId) {
      throw new Error('Group ID is required');
    }
    
    const url = `/rest/groups/${groupId}/audit_logs/search`;
    return this._request({
      url,
      method: 'get',
      params: this._formatAuditParams(params)
    });
  }

  /**
   * Format audit log search parameters
   * @param {Object} params - Raw search parameters
   * @returns {Object} - Formatted parameters
   * @private
   */
  _formatAuditParams(params) {
    // Make a copy to avoid modifying the original
    const formattedParams = { ...params };
    
    // Format dates if provided
    if (formattedParams.from_date && !(formattedParams.from_date instanceof Date)) {
      formattedParams.from_date = new Date(formattedParams.from_date).toISOString();
    }
    
    if (formattedParams.to_date && !(formattedParams.to_date instanceof Date)) {
      formattedParams.to_date = new Date(formattedParams.to_date).toISOString();
    }
    
    // Format events array into comma-separated string
    if (Array.isArray(formattedParams.events)) {
      formattedParams.events = formattedParams.events.join(',');
    }
    
    // Format exclude_events array into comma-separated string
    if (Array.isArray(formattedParams.exclude_events)) {
      formattedParams.exclude_events = formattedParams.exclude_events.join(',');
    }
    
    return formattedParams;
  }

  /**
   * Fetch all pages of audit logs
   * @param {Function} searchFunction - The search function to use
   * @param {string} id - Organization or Group ID
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Complete list of audit log items
   */
  async fetchAllPages(searchFunction, id, params = {}) {
    let allItems = [];
    let nextCursor = null;
    let hasMorePages = true;
    let page = 1;
    
    logger.debug(`Starting paginated fetch for ${searchFunction.name} with ID ${id}`);
    
    while (hasMorePages) {
      // Add cursor to params if we have one
      const searchParams = nextCursor 
        ? { ...params, starting_after: nextCursor } 
        : params;
      
      // Call the search function (either searchOrgAuditLogs or searchGroupAuditLogs)
      const response = await searchFunction.call(this, id, searchParams);
      
      logger.debug(`Fetched page ${page} with ${response.data?.items?.length || 0} items`);
      
      // Add items to our collection
      if (response.data && response.data.items) {
        allItems = [...allItems, ...response.data.items];
      }
      
      // Check if there are more pages
      if (response.links && response.links.next) {
        // Extract cursor from next link
        try {
          const nextUrl = new URL(response.links.next);
          nextCursor = nextUrl.searchParams.get('starting_after');
          hasMorePages = true;
          page++;
        } catch (error) {
          logger.error('Failed to parse next link URL', error);
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }
      
      // Safety check to prevent infinite loops
      if (page > 100) {
        logger.warn('Reached maximum page limit (100), stopping pagination');
        hasMorePages = false;
      }
    }
    
    logger.info(`Completed fetching all pages. Total items: ${allItems.length}`);
    return allItems;
  }

  /**
   * Get all organization audit logs for a specific time period
   * @param {string} orgId - Organization ID
   * @param {Date|string} fromDate - Start date
   * @param {Date|string} toDate - End date
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Complete list of audit log items
   */
  async getAllOrgAuditLogs(orgId, fromDate, toDate, options = {}) {
    const params = {
      from_date: fromDate,
      to_date: toDate,
      ...options
    };
    
    return this.fetchAllPages(this.searchOrgAuditLogs, orgId, params);
  }

  /**
   * Get all group audit logs for a specific time period
   * @param {string} groupId - Group ID
   * @param {Date|string} fromDate - Start date
   * @param {Date|string} toDate - End date
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Complete list of audit log items
   */
  async getAllGroupAuditLogs(groupId, fromDate, toDate, options = {}) {
    const params = {
      from_date: fromDate,
      to_date: toDate,
      ...options
    };
    
    return this.fetchAllPages(this.searchGroupAuditLogs, groupId, params);
  }

  /**
   * Get user-specific audit logs
   * @param {string} orgId - Organization ID
   * @param {string} userId - User ID
   * @param {Date|string} fromDate - Start date
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - User audit log items
   */
  async getUserAuditLogs(orgId, userId, fromDate, options = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const params = {
      from_date: fromDate,
      user_id: userId,
      ...options
    };
    
    return this.fetchAllPages(this.searchOrgAuditLogs, orgId, params);
  }

  /**
   * Get project-specific audit logs
   * @param {string} orgId - Organization ID
   * @param {string} projectId - Project ID
   * @param {Date|string} fromDate - Start date
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Project audit log items
   */
  async getProjectAuditLogs(orgId, projectId, fromDate, options = {}) {
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    const params = {
      from_date: fromDate,
      project_id: projectId,
      ...options
    };
    
    return this.fetchAllPages(this.searchOrgAuditLogs, orgId, params);
  }

  /**
   * Get security-related audit logs
   * @param {string} orgId - Organization ID
   * @param {Date|string} fromDate - Start date
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Security audit log items
   */
  async getSecurityAuditLogs(orgId, fromDate, options = {}) {
    // Define security-related event types
    const securityEvents = [
      'org.policy.create', 'org.policy.edit', 'org.policy.delete',
      'org.ignore_policy.edit',
      'org.integration.create', 'org.integration.delete', 'org.integration.edit',
      'org.service_account.create', 'org.service_account.delete', 'org.service_account.edit',
      'org.settings.feature_flag.edit',
      'org.project.ignore.create', 'org.project.ignore.delete', 'org.project.ignore.edit',
      'org.sast_settings.edit',
      'org.webhook.add', 'org.webhook.delete'
    ];
    
    const params = {
      from_date: fromDate,
      events: securityEvents,
      ...options
    };
    
    return this.fetchAllPages(this.searchOrgAuditLogs, orgId, params);
  }
}

module.exports = SnykApiClient;