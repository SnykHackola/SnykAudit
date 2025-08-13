// src/utils/logger.js

/**
 * Logger utility for SnykAudit
 * 
 * This utility provides standardized logging functionality with
 * configurable log levels, timestamps, and output formatting.
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  ERROR: 0,   // Only errors
  WARN: 1,    // Errors and warnings
  INFO: 2,    // General information, plus warnings and errors
  DEBUG: 3,   // Detailed information for debugging
  TRACE: 4    // Very detailed information for tracing execution
};

class Logger {
  /**
   * Create a new logger
   * @param {Object} config - Logger configuration
   */
  constructor(config = {}) {
    this.moduleName = config.moduleName || 'SnykAudit';
    this.level = config.level || process.env.LOG_LEVEL || 'INFO';
    this.showTimestamp = config.showTimestamp !== false;
    this.showLevel = config.showLevel !== false;
    this.colorize = config.colorize !== false && process.stdout.isTTY;
    this.logToFile = config.logToFile || false;
    this.logFilePath = config.logFilePath || './logs/snykaudit.log';
    
    // Set numeric log level
    this.numericLevel = LOG_LEVELS[this.level] || LOG_LEVELS.INFO;
    
    // ANSI color codes
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m'
    };
    
    // Color mapping for log levels
    this.levelColors = {
      ERROR: this.colors.red,
      WARN: this.colors.yellow,
      INFO: this.colors.green,
      DEBUG: this.colors.cyan,
      TRACE: this.colors.gray
    };
  }

  /**
   * Set the log level
   * @param {string} level - Log level name
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
      this.numericLevel = LOG_LEVELS[level];
    } else {
      this.warn(`Invalid log level: ${level}. Using INFO.`);
      this.level = 'INFO';
      this.numericLevel = LOG_LEVELS.INFO;
    }
  }

  /**
   * Check if a log level is enabled
   * @param {string} level - Log level name
   * @returns {boolean} - Whether the level is enabled
   */
  isLevelEnabled(level) {
    return LOG_LEVELS[level] <= this.numericLevel;
  }

  /**
   * Log a message with a specific level
   * @param {string} level - Log level name
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @private
   */
  _log(level, message, data) {
    if (!this.isLevelEnabled(level)) {
      return;
    }
    
    // Prepare log parts
    const parts = [];
    
    // Add timestamp if enabled
    if (this.showTimestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }
    
    // Add module name
    parts.push(`[${this.moduleName}]`);
    
    // Add log level if enabled
    if (this.showLevel) {
      parts.push(`[${level}]`);
    }
    
    // Add message
    parts.push(message);
    
    // Prepare log message
    let logMessage = parts.join(' ');
    
    // Add colorization if enabled
    let colorizedMessage = logMessage;
    if (this.colorize) {
      const color = this.levelColors[level] || this.colors.reset;
      colorizedMessage = `${color}${logMessage}${this.colors.reset}`;
    }
    
    // Log to console
    switch (level) {
      case 'ERROR':
        console.error(colorizedMessage);
        break;
      case 'WARN':
        console.warn(colorizedMessage);
        break;
      default:
        console.log(colorizedMessage);
    }
    
    // Log additional data if provided
    if (data !== undefined) {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data);
      }
    }
    
    // Log to file if enabled
    if (this.logToFile) {
      this._logToFile(logMessage, data);
    }
  }

  /**
   * Log a message to a file
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @private
   */
  _logToFile(message, data) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Create log directory if it doesn't exist
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Prepare log entry
      let logEntry = message;
      
      // Add data if provided
      if (data !== undefined) {
        if (typeof data === 'object') {
          logEntry += ' ' + JSON.stringify(data);
        } else {
          logEntry += ' ' + data;
        }
      }
      
      // Append to log file
      fs.appendFileSync(this.logFilePath, logEntry + '\n');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or additional data
   */
  error(message, error) {
    // Extract error information if provided
    let errorData;
    if (error instanceof Error) {
      errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else {
      errorData = error;
    }
    
    this._log('ERROR', message, errorData);
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data) {
    this._log('WARN', message, data);
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data) {
    this._log('INFO', message, data);
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data) {
    this._log('DEBUG', message, data);
  }

  /**
   * Log a trace message
   * @param {string} message - Trace message
   * @param {Object} data - Additional data
   */
  trace(message, data) {
    this._log('TRACE', message, data);
  }

  /**
   * Create a child logger with a different module name
   * @param {string} childName - Child module name
   * @returns {Logger} - Child logger
   */
  child(childName) {
    return new Logger({
      ...this,
      moduleName: `${this.moduleName}:${childName}`
    });
  }
}

// Create default instance
const defaultLogger = new Logger();

module.exports = {
  Logger,
  defaultLogger,
  LOG_LEVELS
};