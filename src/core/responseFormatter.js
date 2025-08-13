// src/core/responseFormatter.js

class ResponseFormatter {
  /**
   * Format a response for text-based platforms
   * @param {Object} responseData - Raw response data
   * @returns {Object} - Formatted text response
   */
  formatTextResponse(responseData) {
    // Simple text message
    if (typeof responseData === 'string') {
      return { text: responseData };
    }
    
    // Handle error responses
    if (!responseData.success) {
      return {
        text: responseData.message || 'Sorry, something went wrong.',
      };
    }
    
    return {
      text: responseData.message,
      data: responseData.data || null,
      success: responseData.success !== false,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format a response for Slack
   * @param {Object} responseData - Raw response data
   * @returns {Object} - Formatted Slack message with blocks
   */
  formatSlackResponse(responseData) {
    // Simple text message
    if (typeof responseData === 'string') {
      return { text: responseData };
    }
    
    // Handle error responses
    if (!responseData.success) {
      return {
        text: responseData.message || 'Sorry, something went wrong.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:warning: ${responseData.message || 'Sorry, something went wrong.'}`
            }
          }
        ]
      };
    }
    
    // Format message based on content
    let blocks = [];
    
    // Add header block
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Snyk Audit Insights'
      }
    });
    
    // Add message content
    if (responseData.message) {
      // Split message into paragraphs
      const paragraphs = responseData.message.split('\n\n');
      
      paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: paragraph.replace(/\n/g, '\n')
            }
          });
        }
      });
    }
    
    // Add divider
    blocks.push({ type: 'divider' });
    
    // Add context footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Snyk Audit Bot* • ${new Date().toLocaleString()}`
        }
      ]
    });
    
    return {
      blocks,
      text: responseData.message || 'Snyk Audit Insights' // Fallback text for notifications
    };
  }

  /**
   * Format a response for webhook API
   * @param {Object} responseData - Raw response data
   * @returns {Object} - Formatted API response
   */
  formatApiResponse(responseData) {
    return {
      message: responseData.message,
      data: responseData.data || null,
      success: responseData.success !== false,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ResponseFormatter;