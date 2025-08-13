// src/platforms/slack/slackIntegration.js

const { App } = require('@slack/bolt');
const { ChatbotNlpIntegration } = require('../../nlp');

/**
 * Slack Integration for SnykAudit Chatbot
 * 
 * This component provides a Slack interface to interact with the chatbot.
 * It handles Slack events, messages, and commands, and processes them
 * using the NLP integration.
 */
class SlackIntegration {
  /**
   * Create a Slack integration
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.nlpIntegration = new ChatbotNlpIntegration(config);
    this.apiKey = config.apiKey;
    this.slackToken = config.slackToken;
    this.slackSigningSecret = config.slackSigningSecret;
    this.slackAppToken = config.slackAppToken;
    this.socketMode = !!this.slackAppToken;
    this.conversationContexts = {};
    this.slackApp = null;
    this.initialized = false;
  }

  /**
   * Initialize the Slack integration
   * @param {string} apiKey - Snyk API key
   * @param {Object} config - Additional configuration
   * @returns {Promise<boolean>} - Success status
   */
  async init(apiKey, config = {}) {
    try {
      // Set API key
      this.apiKey = apiKey || this.apiKey;
      
      if (!this.apiKey) {
        console.error('Slack integration initialization failed: No API key provided');
        return false;
      }
      
      // Override config if provided
      if (config.slackToken) this.slackToken = config.slackToken;
      if (config.slackSigningSecret) this.slackSigningSecret = config.slackSigningSecret;
      if (config.slackAppToken) {
        this.slackAppToken = config.slackAppToken;
        this.socketMode = true;
      }
      
      // Check for required Slack credentials
      if (!this.slackToken) {
        console.error('Slack integration initialization failed: No Slack token provided');
        return false;
      }
      
      if (!this.socketMode && !this.slackSigningSecret) {
        console.error('Slack integration initialization failed: No Slack signing secret provided for HTTP mode');
        return false;
      }
      
      // Initialize NLP integration
      const nlpSuccess = await this.nlpIntegration.init(this.apiKey, config);
      
      if (!nlpSuccess) {
        console.error('Slack integration initialization failed: NLP integration failed to initialize');
        return false;
      }
      
      // Initialize Slack app
      const slackOptions = {
        token: this.slackToken
      };
      
      if (this.socketMode) {
        // Socket mode (for development or when public endpoint not available)
        slackOptions.appToken = this.slackAppToken;
        slackOptions.socketMode = true;
      } else {
        // HTTP mode (for production)
        slackOptions.signingSecret = this.slackSigningSecret;
      }
      
      this.slackApp = new App(slackOptions);
      
      // Set up event handlers
      this._setupEventHandlers();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Slack integration initialization failed:', error);
      return false;
    }
  }

  /**
   * Start the Slack app
   * @param {number} port - HTTP port (only used in HTTP mode)
   * @returns {Promise<void>}
   */
  async start(port = 3000) {
    if (!this.initialized) {
      throw new Error('Slack integration not initialized. Call init() first.');
    }
    
    try {
      if (this.socketMode) {
        await this.slackApp.start();
        console.log('⚡️ SnykAudit Slack bot is running in socket mode');
      } else {
        await this.slackApp.start(port);
        console.log(`⚡️ SnykAudit Slack bot is running on port ${port}`);
      }
    } catch (error) {
      console.error('Failed to start Slack integration:', error);
      throw error;
    }
  }

  /**
   * Set up Slack event handlers
   * @private
   */
  _setupEventHandlers() {
    // Handle direct messages
    this.slackApp.message(async ({ message, say, client }) => {
      // Skip messages from bots
      if (message.subtype === 'bot_message' || message.bot_id) {
        return;
      }
      
      try {
        // Get user info for context
        const userInfo = await client.users.info({ user: message.user });
        
        // Get or create conversation context
        const context = this._getConversationContext(message.channel, message.user);
        
        // Add user info to context
        context.slack = {
          userId: message.user,
          channelId: message.channel,
          userName: userInfo.user.name,
          userRealName: userInfo.user.real_name,
          isDirectMessage: message.channel_type === 'im'
        };
        
        // Process the message
        const response = await this.nlpIntegration.processMessage(message.text, context);
        
        // Format response for Slack
        const slackMessage = this._formatSlackMessage(response);
        
        // Send response
        await say(slackMessage);
        
        // Update conversation context
        this._updateConversationContext(message.channel, message.user, {
          lastQuery: message.text,
          lastResponse: response,
          lastTimestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error processing Slack message:', error);
        
        // Send error message
        await say({
          text: `Sorry, I encountered an error: ${error.message}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:warning: Sorry, I encountered an error: ${error.message}`
              }
            }
          ]
        });
      }
    });
    
    // Handle mentions in channels
    this.slackApp.event('app_mention', async ({ event, say, client }) => {
      try {
        // Get user info for context
        const userInfo = await client.users.info({ user: event.user });
        
        // Extract the actual message (remove the bot mention)
        const message = event.text.replace(/<@[A-Z0-9]+>/, '').trim();
        
        // Get or create conversation context
        const context = this._getConversationContext(event.channel, event.user);
        
        // Add user info to context
        context.slack = {
          userId: event.user,
          channelId: event.channel,
          userName: userInfo.user.name,
          userRealName: userInfo.user.real_name,
          isDirectMessage: false,
          isMention: true
        };
        
        // Process the message
        const response = await this.nlpIntegration.processMessage(message, context);
        
        // Format response for Slack
        const slackMessage = this._formatSlackMessage(response);
        
        // Send response
        await say(slackMessage);
        
        // Update conversation context
        this._updateConversationContext(event.channel, event.user, {
          lastQuery: message,
          lastResponse: response,
          lastTimestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error processing app mention:', error);
        
        // Send error message
        await say({
          text: `Sorry, I encountered an error: ${error.message}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:warning: Sorry, I encountered an error: ${error.message}`
              }
            }
          ]
        });
      }
    });
    
    // Add slash command for configuring the bot
    this.slackApp.command('/snykaudit', async ({ command, ack, respond, client }) => {
      // Acknowledge the command request
      await ack();
      
      try {
        // Parse the command text
        const args = command.text.split(' ');
        const action = args[0]?.toLowerCase();
        
        if (action === 'help' || !action) {
          // Show help
          await respond({
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: 'SnykAudit Bot Help'
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: 'Here are some things you can ask me:'
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '• *Show me recent security events*\n• *Any suspicious activity in the last 24 hours?*\n• *What has [username] been doing?*\n• *Were there any policy changes recently?*'
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: 'You can also use these commands:'
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '• `/snykaudit help` - Show this help message\n• `/snykaudit status` - Check bot status\n• `/snykaudit config` - Show configuration options (admin only)'
                }
              }
            ]
          });
        } else if (action === 'status') {
          // Show status
          await respond({
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*SnykAudit Bot Status*\n\nStatus: ${this.initialized ? '✅ Active' : '❌ Inactive'}\nNLP Engine: ${this.nlpIntegration.initialized ? '✅ Ready' : '❌ Not ready'}`
                }
              }
            ]
          });
        } else if (action === 'config') {
          // Check if user is admin (you might want to implement proper authorization)
          // For now, we'll check if the user is a workspace admin
          const userInfo = await client.users.info({ user: command.user_id });
          const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
          
          if (!isAdmin) {
            await respond({
              text: 'Sorry, only administrators can access configuration options.',
              response_type: 'ephemeral'
            });
            return;
          }
          
          // Open configuration modal
          await client.views.open({
            trigger_id: command.trigger_id,
            view: {
              type: 'modal',
              callback_id: 'config_modal',
              title: {
                type: 'plain_text',
                text: 'SnykAudit Configuration'
              },
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*Snyk Organization ID*\nThe organization ID for Snyk Audit API'
                  }
                },
                {
                  type: 'input',
                  block_id: 'org_id_block',
                  label: {
                    type: 'plain_text',
                    text: 'Organization ID'
                  },
                  element: {
                    type: 'plain_text_input',
                    action_id: 'org_id_input',
                    placeholder: {
                      type: 'plain_text',
                      text: 'Enter your Snyk organization ID'
                    }
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*Snyk API Key*\nThe API key for accessing Snyk Audit API'
                  }
                },
                {
                  type: 'input',
                  block_id: 'api_key_block',
                  label: {
                    type: 'plain_text',
                    text: 'API Key'
                  },
                  element: {
                    type: 'plain_text_input',
                    action_id: 'api_key_input',
                    placeholder: {
                      type: 'plain_text',
                      text: 'Enter your Snyk API key'
                    }
                  }
                }
              ],
              submit: {
                type: 'plain_text',
                text: 'Save'
              }
            }
          });
        } else {
          // Unknown command
          await respond({
            text: `Unknown command: ${action}. Try '/snykaudit help' for available commands.`,
            response_type: 'ephemeral'
          });
        }
      } catch (error) {
        console.error('Error processing slash command:', error);
        
        await respond({
          text: `Sorry, I encountered an error: ${error.message}`,
          response_type: 'ephemeral'
        });
      }
    });
    
    // Handle configuration modal submission
    this.slackApp.view('config_modal', async ({ ack, body, view, client }) => {
      // Acknowledge the submission
      await ack();
      
      try {
        // Extract values from the submission
        const orgId = view.state.values.org_id_block.org_id_input.value;
        const apiKey = view.state.values.api_key_block.api_key_input.value;
        
        // Validate input
        if (!orgId || !apiKey) {
          await client.chat.postMessage({
            channel: body.user.id,
            text: 'Error: Both Organization ID and API Key are required.'
          });
          return;
        }
        
        // Reinitialize with new config
        const success = await this.nlpIntegration.init(apiKey, { orgId });
        
        if (success) {
          // Update instance variables
          this.apiKey = apiKey;
          
          await client.chat.postMessage({
            channel: body.user.id,
            text: 'Configuration updated successfully! The bot is now using the new settings.'
          });
        } else {
          await client.chat.postMessage({
            channel: body.user.id,
            text: 'Failed to update configuration. Please check the values and try again.'
          });
        }
      } catch (error) {
        console.error('Error processing modal submission:', error);
        
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Error updating configuration: ${error.message}`
        });
      }
    });
  }

  /**
   * Get conversation context for a channel and user
   * @param {string} channelId - Slack channel ID
   * @param {string} userId - Slack user ID
   * @returns {Object} - Conversation context
   * @private
   */
  _getConversationContext(channelId, userId) {
    const key = `${channelId}:${userId}`;
    
    if (!this.conversationContexts[key]) {
      this.conversationContexts[key] = {
        lastQuery: null,
        lastResponse: null,
        lastTimestamp: null
      };
    }
    
    return this.conversationContexts[key];
  }

  /**
   * Update conversation context for a channel and user
   * @param {string} channelId - Slack channel ID
   * @param {string} userId - Slack user ID
   * @param {Object} updates - Updates to apply to context
   * @private
   */
  _updateConversationContext(channelId, userId, updates) {
    const key = `${channelId}:${userId}`;
    
    this.conversationContexts[key] = {
      ...this.conversationContexts[key],
      ...updates
    };
  }

  /**
   * Format response for Slack
   * @param {Object} response - Response from NLP integration
   * @returns {Object} - Formatted Slack message
   * @private
   */
  _formatSlackMessage(response) {
    // Simple text message
    if (typeof response === 'string') {
      return { text: response };
    }
    
    // Handle error responses
    if (!response.success) {
      return {
        text: response.message || 'Sorry, something went wrong.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:warning: ${response.message || 'Sorry, something went wrong.'}`
            }
          }
        ]
      };
    }
    
    // Format message based on content
    let blocks = [];
    
    // Add header block for non-fallback responses
    if (!response.fallback) {
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Snyk Audit Insights'
        }
      });
    }
    
    // Add message content
    if (response.message) {
      // Split message into paragraphs
      const paragraphs = response.message.split('\n\n');
      
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
    
    // Add clarification note if this is a low-confidence response
    if (response.clarification) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_Note: I\'m not entirely sure about this answer. Please let me know if this isn\'t what you were looking for._'
          }
        ]
      });
    }
    
    // Add divider for non-fallback responses
    if (!response.fallback && blocks.length > 0) {
      blocks.push({ type: 'divider' });
      
      // Add context footer
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*SnykAudit Bot* • ${new Date().toLocaleString()}`
          }
        ]
      });
    }
    
    return {
      blocks,
      text: response.message || 'SnykAudit Insights' // Fallback text for notifications
    };
  }
}

module.exports = SlackIntegration;