// src/utils/index.js

/**
 * Utils module index
 * 
 * This file exports all utility functions from the utils module.
 */

const { Logger, defaultLogger, LOG_LEVELS } = require('./logger');
const encryption = require('./encryption');
const dateUtils = require('./dateUtils');
const httpUtils = require('./httpUtils');
const validationUtils = require('./validationUtils');

module.exports = {
  // Logger
  Logger,
  defaultLogger,
  LOG_LEVELS,
  
  // Encryption
  generateKey: encryption.generateKey,
  encrypt: encryption.encrypt,
  decrypt: encryption.decrypt,
  hash: encryption.hash,
  generateToken: encryption.generateToken,
  
  // Date Utils
  formatISO: dateUtils.formatISO,
  formatHuman: dateUtils.formatHuman,
  formatDate: dateUtils.formatDate,
  formatTime: dateUtils.formatTime,
  daysAgo: dateUtils.daysAgo,
  hoursAgo: dateUtils.hoursAgo,
  minutesAgo: dateUtils.minutesAgo,
  startOfDay: dateUtils.startOfDay,
  endOfDay: dateUtils.endOfDay,
  startOfWeek: dateUtils.startOfWeek,
  endOfWeek: dateUtils.endOfWeek,
  startOfMonth: dateUtils.startOfMonth,
  endOfMonth: dateUtils.endOfMonth,
  timeAgo: dateUtils.timeAgo,
  parseDate: dateUtils.parseDate,
  parseNaturalDate: dateUtils.parseNaturalDate,
  isToday: dateUtils.isToday,
  isYesterday: dateUtils.isYesterday,
  isWeekend: dateUtils.isWeekend,
  isBusinessHours: dateUtils.isBusinessHours,
  
  // HTTP Utils
  createHttpClient: httpUtils.createClient,
  httpGet: httpUtils.get,
  httpPost: httpUtils.post,
  httpPut: httpUtils.put,
  httpDelete: httpUtils.del,
  requestWithRetry: httpUtils.requestWithRetry,
  parseHttpError: httpUtils.parseError,
  
  // Validation Utils
  isEmpty: validationUtils.isEmpty,
  isUUID: validationUtils.isUUID,
  isEmail: validationUtils.isEmail,
  isURL: validationUtils.isURL,
  isDate: validationUtils.isDate,
  isISODate: validationUtils.isISODate,
  validateObject: validationUtils.validateObject
};