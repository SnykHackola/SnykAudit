// src/nlp/index.js

const IntentRecognizer = require('./intentRecognizer');
const EntityExtractor = require('./entityExtractor');
const ChatbotNlpIntegration = require('./chatbotNlpIntegration');

module.exports = {
  IntentRecognizer,
  EntityExtractor,
  ChatbotNlpIntegration
};