// src/utils/httpUtils.js

/**
 * HTTP utilities for SnykAudit
 * 
 * This utility provides functions for making HTTP requests,
 * handling responses, and managing errors with retry logic.
 */

const axios = require('axios');
const { defaultLogger } = require('./logger');

// Logger for this module
const logger = defaultLogger.child('httpUtils');

// Default request timeout in milliseconds
const DEFAULT_TIMEOUT = 10000;

// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
  retries: 3,           // Number of retry attempts
  retryDelay: 1000,     // Base delay between retries in milliseconds
  retryStatusCodes: [   // Status codes that should trigger a retry
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504  // Gateway Timeout
  ]
};

/**
 * Create an HTTP client with default configuration
 * @param {Object} config - Axios configuration
 * @returns {Object} - Configured axios instance
 */
function createClient(config = {}) {
  const client = axios.create({
    timeout: config.timeout || DEFAULT_TIMEOUT,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...config.headers
    },
    ...config
  });
  
  // Add request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      logger.debug(`${config.method.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      logger.error('Request error', error);
      return Promise.reject(error);
    }
  );
  
  // Add response interceptor for logging
  client.interceptors.response.use(
    (response) => {
      logger.debug(`${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.response) {
        logger.error(`${error.response.status} ${error.config.method.toUpperCase()} ${error.config.url}`, error.response.data);
      } else if (error.request) {
        logger.error(`No response received for ${error.config.method.toUpperCase()} ${error.config.url}`);
      } else {
        logger.error('Request configuration error', error);
      }
      return Promise.reject(error);
    }
  );
  
  return client;
}

/**
 * Make an HTTP request with retry logic
 * @param {Object} config - Request configuration
 * @param {Object} retryConfig - Retry configuration
 * @returns {Promise<Object>} - Response data
 */
async function requestWithRetry(config, retryConfig = {}) {
  const client = createClient(config);
  const { retries, retryDelay, retryStatusCodes } = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig
  };
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Make the request
      const response = await client(config);
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const shouldRetry =
        attempt < retries &&
        (
          // Retry on network errors
          !error.response ||
          // Retry on specific status codes
          (error.response && retryStatusCodes.includes(error.response.status))
        );
      
      if (shouldRetry) {
        // Calculate exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt);
        
        logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`, {
          url: config.url,
          method: config.method,
          status: error.response?.status
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // We've exhausted our retries or shouldn't retry
        break;
      }
    }
  }
  
  // If we get here, all retries failed
  logger.error('All retry attempts failed', {
    url: config.url,
    method: config.method,
    retries
  });
  
  throw lastError;
}

/**
 * Make a GET request
 * @param {string} url - Request URL
 * @param {Object} params - Query parameters
 * @param {Object} config - Additional request configuration
 * @returns {Promise<Object>} - Response data
 */
async function get(url, params = {}, config = {}) {
  return requestWithRetry({
    url,
    method: 'get',
    params,
    ...config
  });
}

/**
 * Make a POST request
 * @param {string} url - Request URL
 * @param {Object} data - Request body
 * @param {Object} config - Additional request configuration
 * @returns {Promise<Object>} - Response data
 */
async function post(url, data = {}, config = {}) {
  return requestWithRetry({
    url,
    method: 'post',
    data,
    ...config
  });
}

/**
 * Make a PUT request
 * @param {string} url - Request URL
 * @param {Object} data - Request body
 * @param {Object} config - Additional request configuration
 * @returns {Promise<Object>} - Response data
 */
async function put(url, data = {}, config = {}) {
  return requestWithRetry({
    url,
    method: 'put',
    data,
    ...config
  });
}

/**
 * Make a DELETE request
 * @param {string} url - Request URL
 * @param {Object} config - Additional request configuration
 * @returns {Promise<Object>} - Response data
 */
async function del(url, config = {}) {
  return requestWithRetry({
    url,
    method: 'delete',
    ...config
  });
}

/**
 * Parse and enhance error from HTTP request
 * @param {Error} error - Error object
 * @returns {Error} - Enhanced error
 */
function parseError(error) {
  // Already processed error
  if (error.isHttpError) {
    return error;
  }
  
  // Create a new error object
  const httpError = new Error(error.message);
  httpError.isHttpError = true;
  
  // Add additional properties
  if (error.response) {
    // Server responded with an error status
    httpError.status = error.response.status;
    httpError.statusText = error.response.statusText;
    httpError.data = error.response.data;
    httpError.headers = error.response.headers;
    httpError.message = `HTTP Error ${error.response.status}: ${error.response.statusText}`;
    
    // Add more details if available
    if (error.response.data) {
      if (typeof error.response.data === 'string') {
        httpError.message += ` - ${error.response.data}`;
      } else if (error.response.data.message) {
        httpError.message += ` - ${error.response.data.message}`;
      } else if (error.response.data.error) {
        httpError.message += ` - ${error.response.data.error}`;
      }
    }
  } else if (error.request) {
    // Request was made but no response received
    httpError.request = error.request;
    httpError.message = 'No response received from server';
  } else {
    // Error in setting up the request
    httpError.message = 'Error setting up the request: ' + error.message;
  }
  
  // Add original error for reference
  httpError.originalError = error;
  
  return httpError;
}

module.exports = {
  createClient,
  requestWithRetry,
  get,
  post,
  put,
  del,
  parseError,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY_CONFIG
};