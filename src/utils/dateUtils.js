// src/utils/dateUtils.js

/**
 * Date utilities for SnykAudit
 * 
 * This utility provides functions for date formatting, parsing,
 * and manipulation commonly needed throughout the application.
 */

/**
 * Format a date as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @param {Date|string|number} date - Date to format
 * @returns {string} - Formatted date
 */
function formatISO(date) {
  const dateObj = ensureDate(date);
  return dateObj.toISOString();
}

/**
 * Format a date as a human-readable string
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date
 */
function formatHuman(date, options = {}) {
  const dateObj = ensureDate(date);
  const defaultOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return dateObj.toLocaleString(options.locale || 'en-US', {
    ...defaultOptions,
    ...options
  });
}

/**
 * Format a date as YYYY-MM-DD
 * @param {Date|string|number} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  const dateObj = ensureDate(date);
  return dateObj.toISOString().split('T')[0];
}

/**
 * Format a date as HH:MM:SS
 * @param {Date|string|number} date - Date to format
 * @returns {string} - Formatted time
 */
function formatTime(date) {
  const dateObj = ensureDate(date);
  return dateObj.toISOString().split('T')[1].split('.')[0];
}

/**
 * Calculate days ago from a date
 * @param {number} days - Number of days ago
 * @returns {Date} - Date object
 */
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Calculate hours ago from a date
 * @param {number} hours - Number of hours ago
 * @returns {Date} - Date object
 */
function hoursAgo(hours) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

/**
 * Calculate minutes ago from a date
 * @param {number} minutes - Number of minutes ago
 * @returns {Date} - Date object
 */
function minutesAgo(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date;
}

/**
 * Calculate the start of a day
 * @param {Date|string|number} date - Date to use
 * @returns {Date} - Date object set to start of day
 */
function startOfDay(date) {
  const dateObj = ensureDate(date);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
}

/**
 * Calculate the end of a day
 * @param {Date|string|number} date - Date to use
 * @returns {Date} - Date object set to end of day
 */
function endOfDay(date) {
  const dateObj = ensureDate(date);
  dateObj.setHours(23, 59, 59, 999);
  return dateObj;
}

/**
 * Calculate the start of a week (Sunday)
 * @param {Date|string|number} date - Date to use
 * @returns {Date} - Date object set to start of week
 */
function startOfWeek(date) {
  const dateObj = ensureDate(date);
  const day = dateObj.getDay(); // 0 = Sunday
  dateObj.setDate(dateObj.getDate() - day);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
}

/**
 * Calculate the end of a week (Saturday)
 * @param {Date|string|number} date - Date to use
 * @returns {Date} - Date object set to end of week
 */
function endOfWeek(date) {
  const dateObj = ensureDate(date);
  const day = dateObj.getDay(); // 0 = Sunday
  dateObj.setDate(dateObj.getDate() + (6 - day));
  dateObj.setHours(23, 59, 59, 999);
  return dateObj;
}

/**
 * Calculate the start of a month
 * @param {Date|string|number} date - Date to use
 * @returns {Date} - Date object set to start of month
 */
function startOfMonth(date) {
  const dateObj = ensureDate(date);
  dateObj.setDate(1);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
}

/**
 * Calculate the end of a month
 * @param {Date|string|number} date - Date to use
 * @returns {Date} - Date object set to end of month
 */
function endOfMonth(date) {
  const dateObj = ensureDate(date);
  dateObj.setMonth(dateObj.getMonth() + 1);
  dateObj.setDate(0);
  dateObj.setHours(23, 59, 59, 999);
  return dateObj;
}

/**
 * Calculate time ago in words
 * @param {Date|string|number} date - Date to calculate from
 * @returns {string} - Human readable time ago
 */
function timeAgo(date) {
  const dateObj = ensureDate(date);
  const now = new Date();
  const diffMs = now - dateObj;
  
  // Convert to minutes, hours, days
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Parse a date string in various formats
 * @param {string} dateString - Date string to parse
 * @returns {Date} - Date object
 */
function parseDate(dateString) {
  if (!dateString) {
    throw new Error('Date string is required');
  }
  
  // Try parsing as ISO date
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try parsing common date formats
  const formats = [
    // MM/DD/YYYY
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      build: (m) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))
    },
    // DD/MM/YYYY
    {
      regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      build: (m) => new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
    },
    // YYYY/MM/DD
    {
      regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
      build: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    },
    // YYYY-MM-DD
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      build: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    }
  ];
  
  for (const format of formats) {
    const match = dateString.match(format.regex);
    if (match) {
      const date = format.build(match);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  // Try natural language parsing
  return parseNaturalDate(dateString);
}

/**
 * Parse natural language date expressions
 * @param {string} text - Natural language date expression
 * @returns {Date} - Date object
 */
function parseNaturalDate(text) {
  const now = new Date();
  const lowerText = text.toLowerCase().trim();
  
  // Common expressions
  if (lowerText === 'today') {
    return now;
  } else if (lowerText === 'yesterday') {
    return daysAgo(1);
  } else if (lowerText === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  } else if (lowerText.match(/last\s+night/i)) {
    const lastNight = daysAgo(1);
    lastNight.setHours(20, 0, 0, 0);
    return lastNight;
  } else if (lowerText.match(/this\s+morning/i)) {
    const thisMorning = new Date(now);
    thisMorning.setHours(8, 0, 0, 0);
    return thisMorning;
  }
  
  // Patterns like "X days ago", "X weeks ago", etc.
  const timeUnits = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  };
  
  const agoPattern = /(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i;
  const agoMatch = lowerText.match(agoPattern);
  
  if (agoMatch) {
    const amount = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2].toLowerCase();
    
    if (timeUnits[unit]) {
      const date = new Date(now.getTime() - (amount * timeUnits[unit]));
      return date;
    }
  }
  
  // Patterns like "last week", "last month", etc.
  const lastPattern = /last\s+(week|month|year)/i;
  const lastMatch = lowerText.match(lastPattern);
  
  if (lastMatch) {
    const unit = lastMatch[1].toLowerCase();
    
    if (unit === 'week') {
      return daysAgo(7);
    } else if (unit === 'month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return lastMonth;
    } else if (unit === 'year') {
      const lastYear = new Date(now);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      return lastYear;
    }
  }
  
  // If we can't parse it, throw an error
  throw new Error(`Unable to parse date: ${text}`);
}

/**
 * Check if a date is today
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} - Whether the date is today
 */
function isToday(date) {
  const dateObj = ensureDate(date);
  const today = new Date();
  
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is yesterday
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} - Whether the date is yesterday
 */
function isYesterday(date) {
  const dateObj = ensureDate(date);
  const yesterday = daysAgo(1);
  
  return (
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} - Whether the date is a weekend
 */
function isWeekend(date) {
  const dateObj = ensureDate(date);
  const day = dateObj.getDay();
  
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Check if a date is within business hours (9 AM - 5 PM)
 * @param {Date|string|number} date - Date to check
 * @param {number} startHour - Start hour (default: 9)
 * @param {number} endHour - End hour (default: 17)
 * @returns {boolean} - Whether the date is within business hours
 */
function isBusinessHours(date, startHour = 9, endHour = 17) {
  const dateObj = ensureDate(date);
  const hour = dateObj.getHours();
  
  return hour >= startHour && hour < endHour && !isWeekend(dateObj);
}

/**
 * Ensure a value is a Date object
 * @param {Date|string|number} value - Value to convert
 * @returns {Date} - Date object
 * @private
 */
function ensureDate(value) {
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  throw new Error('Invalid date value');
}

module.exports = {
  formatISO,
  formatHuman,
  formatDate,
  formatTime,
  daysAgo,
  hoursAgo,
  minutesAgo,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  timeAgo,
  parseDate,
  parseNaturalDate,
  isToday,
  isYesterday,
  isWeekend,
  isBusinessHours
};