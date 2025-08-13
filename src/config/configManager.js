// configManager.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ConfigManager {
  constructor(configPath = './.snyk-chatbot-config.json') {
    this.configPath = configPath;
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'change-this-in-production';
    this.config = null;
  }

  /**
   * Initialize configuration
   * @returns {Promise<Object>} - Configuration object
   */
  async init() {
    try {
      // Check if config file exists
      await fs.access(this.configPath);
      
      // Read and parse config
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      // Decrypt sensitive information
      if (this.config.encrypted) {
        this._decryptConfig();
      }
    } catch (error) {
      // Config doesn't exist or is invalid, create default
      this.config = {
        encrypted: true,
        apiKey: '',
        orgId: '',
        groupId: '',
        baseUrl: 'https://api.snyk.io',
        defaultDays: 7,
        businessHoursStart: 8,
        businessHoursEnd: 18,
        timezone: 'UTC'
      };
    }
    
    return this.config;
  }

  /**
   * Save configuration
   * @returns {Promise<void>}
   */
  async save() {
    // Create a copy of the config to encrypt
    const configToSave = { ...this.config };
    
    // Encrypt sensitive data if encryption is enabled
    if (configToSave.encrypted) {
      this._encryptConfig(configToSave);
    }
    
    // Write to file
    await fs.writeFile(
      this.configPath,
      JSON.stringify(configToSave, null, 2),
      'utf8'
    );
  }

  /**
   * Update configuration values
   * @param {Object} updates - Configuration updates
   * @returns {Object} - Updated configuration
   */
  async update(updates) {
    // Make sure config is initialized
    if (!this.config) {
      await this.init();
    }
    
    // Apply updates
    this.config = {
      ...this.config,
      ...updates
    };
    
    // Save updated config
    await this.save();
    
    return this.config;
  }

  /**
   * Get current configuration
   * @returns {Object} - Configuration object
   */
  async getConfig() {
    if (!this.config) {
      await this.init();
    }
    return this.config;
  }

  /**
   * Set API key
   * @param {string} apiKey - Snyk API key
   * @returns {Promise<void>}
   */
  async setApiKey(apiKey) {
    if (!this.config) {
      await this.init();
    }
    
    this.config.apiKey = apiKey;
    await this.save();
  }

  /**
   * Encrypt sensitive configuration data
   * @param {Object} configObj - Configuration object to encrypt
   * @private
   */
  _encryptConfig(configObj) {
    const sensitiveFields = ['apiKey'];
    
    sensitiveFields.forEach(field => {
      if (configObj[field]) {
        configObj[field] = this._encrypt(configObj[field]);
      }
    });
  }

  /**
   * Decrypt sensitive configuration data
   * @private
   */
  _decryptConfig() {
    const sensitiveFields = ['apiKey'];
    
    sensitiveFields.forEach(field => {
      if (this.config[field]) {
        try {
          this.config[field] = this._decrypt(this.config[field]);
        } catch (error) {
          console.warn(`Failed to decrypt ${field}`);
        }
      }
    });
  }

  /**
   * Encrypt a string
   * @param {string} text - Text to encrypt
   * @returns {string} - Encrypted text
   * @private
   */
  _encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(this.encryptionKey).digest('base64').substring(0, 32),
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a string
   * @param {string} text - Encrypted text
   * @returns {string} - Decrypted text
   * @private
   */
  _decrypt(text) {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(this.encryptionKey).digest('base64').substring(0, 32),
      iv
    );
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = ConfigManager;