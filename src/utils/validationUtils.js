// src/utils/validationUtils.js

/**
 * Validation utilities for SnykAudit
 * 
 * This utility provides functions for validating data
 * across the application.
 */

/**
 * Check if a value is empty (null, undefined, empty string, or empty array/object)
 * @param {*} value - Value to check
 * @returns {boolean} - Whether the value is empty
 */
function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/**
 * Check if a value is a valid UUID
 * @param {string} value - Value to check
 * @returns {boolean} - Whether the value is a valid UUID
 */
function isUUID(value) {
  if (typeof value !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if a value is a valid email
 * @param {string} value - Value to check
 * @returns {boolean} - Whether the value is a valid email
 */
function isEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }
  
  // Simple email regex - for more comprehensive validation consider a library
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if a value is a valid URL
 * @param {string} value - Value to check
 * @returns {boolean} - Whether the value is a valid URL
 */
function isURL(value) {
  if (typeof value !== 'string') {
    return false;
  }
  
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * Check if a value is a valid date
 * @param {*} value - Value to check
 * @returns {boolean} - Whether the value is a valid date
 */
function isDate(value) {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  
  return false;
}

/**
 * Check if a value is a valid ISO date string
 * @param {string} value - Value to check
 * @returns {boolean} - Whether the value is a valid ISO date string
 */
function isISODate(value) {
  if (typeof value !== 'string') {
    return false;
  }
  
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  return isoDateRegex.test(value) && isDate(value);
}

/**
 * Validate object against a schema
 * @param {Object} object - Object to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} - Validation result with errors
 */
function validateObject(object, schema) {
  const result = {
    valid: true,
    errors: {}
  };
  
  // Check for required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (isEmpty(object[field])) {
        result.valid = false;
        result.errors[field] = `${field} is required`;
      }
    }
  }
  
  // Check field types and constraints
  if (schema.properties) {
    for (const [field, definition] of Object.entries(schema.properties)) {
      // Skip if field is not present and not required
      if (object[field] === undefined) {
        continue;
      }
      
      // Check type
      if (definition.type) {
        const valid = validateType(object[field], definition.type);
        if (!valid) {
          result.valid = false;
          result.errors[field] = `${field} must be a ${definition.type}`;
        }
      }
      
      // Check format if type is valid
      if (definition.format && !result.errors[field]) {
        const valid = validateFormat(object[field], definition.format);
        if (!valid) {
          result.valid = false;
          result.errors[field] = `${field} must be a valid ${definition.format}`;
        }
      }
      
      // Check pattern if specified
      if (definition.pattern && !result.errors[field]) {
        const regex = new RegExp(definition.pattern);
        if (!regex.test(object[field])) {
          result.valid = false;
          result.errors[field] = `${field} does not match required pattern`;
        }
      }
      
      // Check min/max for numbers
      if (definition.type === 'number' && !result.errors[field]) {
        if (definition.minimum !== undefined && object[field] < definition.minimum) {
          result.valid = false;
          result.errors[field] = `${field} must be at least ${definition.minimum}`;
        }
        
        if (definition.maximum !== undefined && object[field] > definition.maximum) {
          result.valid = false;
          result.errors[field] = `${field} must be at most ${definition.maximum}`;
        }
      }
      
      // Check minLength/maxLength for strings
      if (definition.type === 'string' && !result.errors[field]) {
        if (definition.minLength !== undefined && object[field].length < definition.minLength) {
          result.valid = false;
          result.errors[field] = `${field} must be at least ${definition.minLength} characters`;
        }
        
        if (definition.maxLength !== undefined && object[field].length > definition.maxLength) {
          result.valid = false;
          result.errors[field] = `${field} must be at most ${definition.maxLength} characters`;
        }
      }
      
      // Check minItems/maxItems for arrays
      if (definition.type === 'array' && !result.errors[field]) {
        if (definition.minItems !== undefined && object[field].length < definition.minItems) {
          result.valid = false;
          result.errors[field] = `${field} must have at least ${definition.minItems} items`;
        }
        
        if (definition.maxItems !== undefined && object[field].length > definition.maxItems) {
          result.valid = false;
          result.errors[field] = `${field} must have at most ${definition.maxItems} items`;
        }
      }
      
      // Check enum values
      if (definition.enum && !result.errors[field]) {
        if (!definition.enum.includes(object[field])) {
          result.valid = false;
          result.errors[field] = `${field} must be one of: ${definition.enum.join(', ')}`;
        }
      }
    }
  }
  
  return result;
}

/**
 * Validate a value against a type
 * @param {*} value - Value to validate
 * @param {string} type - Type to validate against
 * @returns {boolean} - Whether the value matches the type
 * @private
 */
function validateType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return false;
  }
}

/**
 * Validate a value against a format
 * @param {*} value - Value to validate
 * @param {string} format - Format to validate against
 * @returns {boolean} - Whether the value matches the format
 * @private
 */
function validateFormat(value, format) {
  switch (format) {
    case 'email':
      return isEmail(value);
    case 'uri':
    case 'url':
      return isURL(value);
    case 'uuid':
      return isUUID(value);
    case 'date-time':
    case 'iso-date':
      return isISODate(value);
    default:
      return false;
  }
}

module.exports = {
  isEmpty,
  isUUID,
  isEmail,
  isURL,
  isDate,
  isISODate,
  validateObject
};