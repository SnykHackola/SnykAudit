// src/api/client.js

/**
 * Snyk Audit API Client
 * This client handles the low-level communication with the Snyk Audit API,
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
    this.baseUrl = config.baseUrl || 'https://api.snyk.io';
    this.apiVersion = config.apiVersion || '2024-10-15'; // Using the version from the documentation
    this.timeout = config.timeout || 15000;
    this.retryConfig = {
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      retryStatusCodes: [408, 429, 500, 502, 503, 504]
    };
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `token ${this.apiKey}`
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(config => {
      // For REST API endpoints, add version as query parameter
      if (config.url.startsWith('/rest/')) {
        config.params = config.params || {};
        config.params.version = this.apiVersion;
      } else {
        // For legacy API endpoints, add version to headers
        config.headers['snyk-version'] = this.apiVersion;
      }
      
      console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
      console.log('Request params:', config.params);
      return config;
    });
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        console.log(`API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      error => {
        if (error.response) {
          console.error(`API Error: ${error.response.status} ${error.response.statusText}`);
          console.error('Error data:', error.response.data);
        } else {
          console.error('API Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
    
    console.log(`Initialized Snyk API client with base URL: ${this.baseUrl} and API version: ${this.apiVersion}`);
  }

  /**
   * Make a request to the Snyk API with retry logic.
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} - API response data
   * @private
   */
  async _request(config) {
    // Use the class retry config
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryConfig.retries; attempt++) {
      try {
        // The client already has the proper headers set in the constructor
        // and the interceptors will handle adding version parameters
        const response = await this.client(config);
        return response.data;
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        if (attempt < this.retryConfig.retries && this.retryConfig.retryStatusCodes.includes(status)) {
          const delay = this.retryConfig.retryDelay * Math.pow(2, attempt);
          logger.warn(`API request failed with status ${status}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          const httpError = parseHttpError(error);
          logger.error(`API request failed: ${httpError.message}`, {
            url: config.url,
            method: config.method,
            status: httpError.status,
          });
          break;
        }
      }
    }
    
    // If we've exhausted all retries and still have an error, throw it
    if (lastError) {
      throw lastError;
    }
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
    
    // Updated to match the API endpoint from the documentation
    const url = `/rest/orgs/${orgId}/audit_logs/search`; 
    
    console.log(`Calling Snyk Audit API: ${url} with params:`, params);
    
    return this._request({
      url,
      method: 'get',
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
    
    // Format date parameters according to the API documentation
    if (params.from_date) {
        queryParams.from = params.from_date instanceof Date ? params.from_date.toISOString() : params.from_date;
    }
    if (params.to_date) {
        queryParams.to = params.to_date instanceof Date ? params.to_date.toISOString() : params.to_date;
    }
    
    // Format user_id parameter
    if (params.user_id) {
        queryParams['user_id'] = params.user_id;
    }
    
    // Format project_id parameter
    if (params.project_id) {
        queryParams['project_id'] = params.project_id;
    }
    
    // Format event types parameter
    if (params.events) {
        queryParams['events'] = Array.isArray(params.events) ? params.events.join(',') : params.events;
    }
    
    // Pagination parameter
    if(params.starting_after) {
        queryParams.next_page = params.starting_after;
    }
    
    // Add limit parameter if provided
    if(params.limit) {
        queryParams.limit = params.limit;
    } else {
        // Default to 100 items per page
        queryParams.limit = 100;
    }
    
    // Add sort order parameter
    queryParams.order = 'DESC';
    
    console.log('Formatted API parameters:', queryParams);
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
      
      try {
        const response = await searchFunction.call(this, id, searchParams);
        
        logger.debug(`Fetched page ${page} with ${response.data?.length || 0} items`);
        
        // Check for response.data structure - it could be either an array directly or have an items array inside
        if (response.data) {
          if (Array.isArray(response.data)) {
            allItems = [...allItems, ...response.data];
          } else if (response.data.items && Array.isArray(response.data.items)) {
            allItems = [...allItems, ...response.data.items];
          }
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
      } catch (error) {
        logger.error(`Error fetching page ${page}:`, error);
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
    return allItems.map(item => {
      // Handle both direct item structure and items with attributes
      if (item.attributes) {
        return {
          created: item.attributes.created,
          event: item.attributes.event,
          content: item.attributes.content,
          user_id: item.attributes.user_id,
          org_id: item.attributes.org_id
        };
      } else {
        // Direct structure
        return {
          created: item.created,
          event: item.event,
          content: item.content,
          user_id: item.user_id,
          org_id: item.org_id
        };
      }
    });
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
   * Get user information by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User information
   */
  async getUserById(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      // Format the request parameters
      const params = {
        version: this.apiVersion
      };
      
      // Construct the correct endpoint URL
      // According to Snyk API docs: https://docs.snyk.io/snyk-api/reference/users
      // The endpoint requires organization ID: /rest/orgs/{org_id}/users/{id}
      const orgId = process.env.SNYK_ORG_ID;
      const endpoint = `/rest/orgs/${orgId}/users/${userId}`;
      
      // Log the API request
      console.log(`API Request: GET ${endpoint}`);
      console.log('Request params:', params);
      
      // Make the API request
      const response = await this.client.get(endpoint, { params });
      
      // Log the API response status
      console.log(`API Response: ${response.status} ${response.statusText}`);
      
      // Return the user data
      return response.data;
    } catch (error) {
      // Enhanced error logging
      const errorMessage = error.response ? 
        `Error fetching user information: ${error.message}, Status: ${error.response.status}` : 
        `Error fetching user information: ${error.message}`;
      
      logger.error(errorMessage, { userId });
      console.error(errorMessage);
      
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      
      // Return a minimal object with the ID if the API call fails
      return { id: userId, name: null, username: null, email: null };
    }
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
  
  /**
   * Get all users in an organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} - List of users in the organization
   */
  async getAllOrgUsers(orgId) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }
    
    try {
      // Use the V1 API endpoint for members which we confirmed is working
      const endpoint = `/api/v1/org/${orgId}/members`;
      
      // Log the API request
      console.log(`API Request: GET ${endpoint}`);
      
      // Make the API request
      const response = await this.client.get(endpoint);
      
      // Log the API response status
      console.log(`API Response: ${response.status} ${response.statusText}`);
      
      // Transform the response to a consistent format
      // The V1 API returns an array directly
      if (Array.isArray(response.data)) {
        // Map the response to match our expected format
        return response.data.map(member => ({
          id: member.id,
          name: member.name,
          username: member.username,
          email: member.email,
          role: member.role
        }));
      }
      
      // Return empty array if no data or unexpected format
      return [];
    } catch (error) {
      let errorMessage;
      let errorType;
      
      if (error.response) {
        const status = error.response.status;
        errorMessage = `Error fetching organization users: ${error.message}, Status: ${status}`;
        
        // Categorize error by status code
        if (status === 401) {
          errorType = 'Authentication error: API key may be invalid or expired';
        } else if (status === 403) {
          errorType = 'Permission error: API key may not have sufficient permissions';
        } else if (status === 404) {
          errorType = 'Not found error: Organization ID may be invalid';
        } else {
          errorType = `API error: Status ${status}`;
        }
      } else {
        errorMessage = `Error fetching organization users: ${error.message}`;
        errorType = 'Network or connection error';
      }
      
      // Add error type to the error object for propagation
      error.errorType = errorType;
      
      logger.error(errorMessage, { orgId, errorType });
      console.error(errorMessage);
      
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      
      // Return empty array instead of throwing to make the function more resilient
      return [];
    }
  }
}

module.exports = SnykApiClient;
