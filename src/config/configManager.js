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
   * Initialize configuration, prioritizing environment variables.
   * @returns {Promise<Object>} - Configuration object
   */
  async init() {
    // Default config structure
    let baseConfig = {
      encrypted: false,
      apiKey: '',
      orgId: '',
      groupId: '',
      baseUrl: 'https://api.snyk.io',
      defaultDays: 7,
      businessHoursStart: 8,
      businessHoursEnd: 18,
      timezone: 'UTC'
    };

    // Try to load config from the JSON file if it exists
    try {
      await fs.access(this.configPath);
      const configData = await fs.readFile(this.configPath, 'utf8');
      const fileConfig = JSON.parse(configData);
      baseConfig = { ...baseConfig, ...fileConfig };

      // Decrypt the API key from the file if it's encrypted
      if (baseConfig.encrypted && baseConfig.apiKey) {
        try {
          baseConfig.apiKey = this._decrypt(baseConfig.apiKey);
        } catch (error) {
          console.warn(`Failed to decrypt API key from ${this.configPath}. Please check your ENCRYPTION_KEY.`);
          baseConfig.apiKey = ''; // Clear key on decryption failure
        }
      }
    } catch (error) {
      // It's okay if the file doesn't exist; we'll rely on environment variables or defaults.
    }

    // Prioritize environment variables over file-based config
    this.config = {
      ...baseConfig,
      apiKey: process.env.SNYK_API_KEY || baseConfig.apiKey,
      orgId: process.env.SNYK_ORG_ID || baseConfig.orgId,
      groupId: process.env.SNYK_GROUP_ID || baseConfig.groupId,
    };
    
    return this.config;
  }

  /**
   * Save configuration to the JSON file.
   * Note: This will persist the current state, which might have been loaded from environment variables.
   * @returns {Promise<void>}
   */
  async save() {
    // Create a copy of the config to encrypt and save
    const configToSave = { ...this.config };
    
    // Ensure encryption is explicitly enabled before encrypting
    if (configToSave.encrypted && configToSave.apiKey) {
      configToSave.apiKey = this._encrypt(configToSave.apiKey);
    }
    
    // Write to file
    await fs.writeFile(
      this.configPath,
      JSON.stringify(configToSave, null, 2),
      'utf8'
    );
  }

  /**
   * Update configuration values and save them.
   * @param {Object} updates - Configuration updates
   * @returns {Object} - Updated configuration
   */
  async update(updates) {
    if (!this.config) {
      await this.init();
    }
    
    this.config = { ...this.config, ...updates };
    await this.save();
    
    return this.config;
  }

  /**
   * Get the current configuration.
   * @returns {Promise<Object>} - Configuration object
   */
  async getConfig() {
    if (!this.config) {
      await this.init();
    }
    return this.config;
  }

  /**
   * Set API key and save configuration.
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
   * Encrypt a string using the configured encryption key.
   * @param {string} text - Text to encrypt
   * @returns {string} - Encrypted text in 'iv:encryptedData' format
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
   * Decrypt an encrypted string.
   * @param {string} text - Encrypted text in 'iv:encryptedData' format
   * @returns {string} - Decrypted text
   * @private
   */
  _decrypt(text) {
    const [ivHex, encryptedHex] = text.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted text format. Expected "iv:encryptedData".');
    }
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
