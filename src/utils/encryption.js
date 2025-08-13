// src/utils/encryption.js

/**
 * Encryption utility for SnykAudit
 * 
 * This utility provides functions for encrypting and decrypting
 * sensitive data like API keys and authentication tokens.
 */

const crypto = require('crypto');
const { defaultLogger } = require('./logger');

// Logger for this module
const logger = defaultLogger.child('encryption');

/**
 * Generate a random encryption key
 * @param {number} length - Key length in bytes
 * @returns {string} - Base64 encoded key
 */
function generateKey(length = 32) {
  try {
    const buffer = crypto.randomBytes(length);
    return buffer.toString('base64');
  } catch (error) {
    logger.error('Failed to generate encryption key', error);
    throw new Error('Failed to generate encryption key');
  }
}

/**
 * Encrypt a string
 * @param {string} text - Text to encrypt
 * @param {string} key - Encryption key (base64 encoded)
 * @returns {string} - Encrypted text (format: iv:encryptedData)
 */
function encrypt(text, key) {
  try {
    if (!text || !key) {
      throw new Error('Text and key are required for encryption');
    }
    
    // Derive a key of correct length
    const derivedKey = crypto
      .createHash('sha256')
      .update(key)
      .digest('base64')
      .substring(0, 32);
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return iv:encryptedData format
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - Encrypted text (format: iv:encryptedData)
 * @param {string} key - Encryption key (base64 encoded)
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText, key) {
  try {
    if (!encryptedText || !key) {
      throw new Error('Encrypted text and key are required for decryption');
    }
    
    // Parse the iv:encryptedData format
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Derive a key of correct length
    const derivedKey = crypto
      .createHash('sha256')
      .update(key)
      .digest('base64')
      .substring(0, 32);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Hash a string using SHA-256
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text (hex encoded)
 */
function hash(text) {
  try {
    if (!text) {
      throw new Error('Text is required for hashing');
    }
    
    return crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');
  } catch (error) {
    logger.error('Hashing failed', error);
    throw new Error('Hashing failed');
  }
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} - Random token (hex encoded)
 */
function generateToken(length = 32) {
  try {
    const buffer = crypto.randomBytes(length);
    return buffer.toString('hex');
  } catch (error) {
    logger.error('Failed to generate token', error);
    throw new Error('Failed to generate token');
  }
}

module.exports = {
  generateKey,
  encrypt,
  decrypt,
  hash,
  generateToken
};