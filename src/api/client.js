// src/api/client.js

/**
 * Snyk Audit API Client
 * * This client handles the low-level communication with the Snyk Audit API,
 * including authentication, request formatting, and error handling.
 */

const { requestWithRetry, parseHttpError, defaultLogger } = require('../utils');
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
    this.baseUrl = config.baseUrl || 'https://api.snyk.io'; // CORRECTED: Base URL for REST API
    this.apiVersion = '2024-10-15'; // CORRECTED: Using the version from the documentation
    this.timeout = config.timeout || 15000;
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
        'Authorization': `token ${this.apiKey}`,
        'Accept': 'application/vnd.api+json',
      }
    });
  }

  /**
   * Make a request to the Snyk API with retry logic.
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} - API response data
   * @private
   */
  async _request(config) {
    const client = this._createClient();
    const retryConfig = this.retryConfig;
    let lastError = null;

    for (let attempt = 0; attempt <= retryConfig.retries; attempt++) {
      try {
        // Add the API version to the params for each request
        const requestConfig = {
            ...config,
            params: {
                ...config.params,
                version: this.apiVersion
            }
        };
        logger.debug(`Making ${requestConfig.method.toUpperCase()} request to ${requestConfig.url}`, { params: requestConfig.params });
        const response = await client(requestConfig);
        logger.debug(`Received response from ${requestConfig.url}`, { 
          status: response.status,
          dataSize: response.data ? JSON.stringify(response.data).length : 0
        });
        return response.data;

      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        if (attempt < retryConfig.retries && retryConfig.retryStatusCodes.includes(status)) {
          const delay = retryConfig.retryDelay * Math.pow(2, attempt);
          logger.warn(`API request failed with status ${status}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          const httpError = parseHttpError(error);
          logger.error(`API request failed: ${httpError.message}`, {
            url: config.url,
            method: config.method,
            status: httpError.status,
          });
          throw httpError;
        }
      }
    }
    throw lastError;
  }

  /**
   * Search organization audit logs using the REST API.
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
      method: 'get', // REST endpoint uses GET
      params: this._formatAuditParamsRest(params)
    });
  }
  
  /**
   * Search group audit logs using the REST API.
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
        method: 'get', // REST endpoint uses GET
        params: this._formatAuditParamsRest(params)
    });
  }

  /**
   * Format audit log search parameters for the REST API.
   * @param {Object} params - Raw search parameters
   * @returns {Object} - Formatted query parameters
   * @private
   */
  _formatAuditParamsRest(params) {
    const queryParams = {};
    if (params.from_date) {
        queryParams.from = params.from_date instanceof Date ? params.from_date.toISOString() : params.from_date;
    }
    if (params.to_date) {
        queryParams.to = params.to_date instanceof Date ? params.to_date.toISOString() : params.to_date;
    }
    if (params.user_id) {
        queryParams['user_ids'] = params.user_id;
    }
    if (params.project_id) {
        queryParams['project_ids'] = params.project_id;
    }
    if (params.events) {
        queryParams['events'] = params.events;
    }
    if(params.starting_after) {
        queryParams.starting_after = params.starting_after;
    }

    return queryParams;
  }

  /**
   * Fetch all pages of audit logs from the REST API.
   * @param {Function} searchFunction - The search function to use (searchOrgAuditLogs or searchGroupAuditLogs)
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
      const searchParams = nextCursor 
        ? { ...params, starting_after: nextCursor } 
        : params;
      
      const response = await searchFunction.call(this, id, searchParams);
      
      logger.debug(`Fetched page ${page} with ${response.data?.length || 0} items`);
      
      // CORRECTED: Check for response.data and ensure it's an array before spreading
      if (response.data && Array.isArray(response.data)) {
        allItems = [...allItems, ...response.data];
      }
      
      if (response.links && response.links.next) {
        try {
          // The 'next' link is a relative path, extract the cursor from it.
          const nextUrl = new URL(response.links.next, this.baseUrl);
          nextCursor = nextUrl.searchParams.get('starting_after');
          hasMorePages = !!nextCursor;
          page++;
        } catch (error) {
          logger.error('Failed to parse next link URL', error);
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }
      
      if (page > 100) {
        logger.warn('Reached maximum page limit (100), stopping pagination');
        hasMorePages = false;
      }
    }
    
    logger.info(`Completed fetching all pages. Total items: ${allItems.length}`);
    // The v1 API returned {logs: [...]}, the REST API returns {data: [...]}, so we need to transform the shape
    // to match what the rest of the application expects.
    return allItems.map(item => ({
        created: item.attributes.created,
        event: item.attributes.event,
        content: item.attributes.content,
    }));
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
      events: securityEvents.join(','),
      ...options
    };
    
    return this.fetchAllPages(this.searchOrgAuditLogs, orgId, params);
  }
}

module.exports = SnykApiClient;
