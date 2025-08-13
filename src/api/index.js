// src/api/index.js

/**
 * API module index
 * 
 * This file exports the components of the API module.
 */

const SnykApiClient = require('./client');
const SnykAuditService = require('./service');

module.exports = {
  SnykApiClient,
  SnykAuditService
};