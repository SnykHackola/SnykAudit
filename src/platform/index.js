// src/platforms/index.js

const { WebhookHandler } = require('./webhook');
const { SlackIntegration } = require('./slack');

module.exports = {
  WebhookHandler,
  SlackIntegration
};