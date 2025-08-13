# SnykAudit

SnykAudit is an intelligent chatbot that analyzes Snyk audit logs to provide insights into security events and user activities. It processes natural language queries, detects suspicious behavior, and helps security teams monitor their Snyk usage more effectively.

![SnykAudit Banner](https://placeholder-for-banner-image.com/banner.png)

## Features

- **Natural Language Interface**: Ask questions in plain English about your Snyk audit logs
- **Security Event Monitoring**: Track and analyze security-critical events
- **User Activity Tracking**: Monitor what users are doing in your Snyk organization
- **Suspicious Behavior Detection**: Identify unusual activities like after-hours changes
- **Multiple Interfaces**: Access via webhook API or Slack
- **Secure Configuration**: Encrypted storage of sensitive information

## Examples

Ask SnykAudit questions like:

- "Show me recent security events"
- "Any suspicious activity in the last 24 hours?"
- "What has john.doe been doing?"
- "Were there any policy changes recently?"
- "Show me after-hours activity"
- "Who modified our integrations this week?"

## Architecture

SnykAudit is built with a modular architecture:

- **Core**: Business logic for analyzing audit logs
- **NLP**: Natural language processing for understanding queries
- **Platforms**: Interface adapters for Slack and webhook API
- **API**: Client and service layer for Snyk Audit API
- **Config**: Configuration management with encryption
- **Utils**: Supporting utility functions

## Installation

### Prerequisites

- Node.js 16 or higher
- Snyk account with API access
- Snyk organization ID
- Slack workspace (if using Slack integration)

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/SnykAudit.git
   cd SnykAudit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

### Docker Deployment

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```ini
# Application
PORT=3000
NODE_ENV=development

# Feature Flags
ENABLE_WEBHOOK=true
ENABLE_SLACK=false

# Security
ENCRYPTION_KEY=your-secure-random-key
CONFIG_API_TOKEN=your-api-config-token
WEBHOOK_AUTH_TOKEN=your-webhook-auth-token

# Slack Integration (only if ENABLE_SLACK=true)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token  # Only needed for socket mode

# Logging
LOG_LEVEL=INFO  # ERROR, WARN, INFO, DEBUG, TRACE
```

### Snyk Configuration

You can configure your Snyk API key and organization ID either:

1. Through environment variables:
   ```
   SNYK_API_KEY=your-api-key
   SNYK_ORG_ID=your-org-id
   ```

2. Through the configuration API:
   ```bash
   curl -X POST \
     http://localhost:3000/config \
     -H "Authorization: Bearer your-config-api-token" \
     -H "Content-Type: application/json" \
     -d '{
       "apiKey": "your-api-key",
       "orgId": "your-org-id"
     }'
   ```

3. Through the Slack interface (if enabled):
   ```
   /snykaudit config
   ```

## Usage

### Webhook API

Send POST requests to `/webhook` with your query:

```bash
curl -X POST \
  http://localhost:3000/webhook \
  -H "Authorization: Bearer your-webhook-auth-token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me recent security events",
    "context": {
      "userId": "user123"
    }
  }'
```

### Slack Integration

If the Slack integration is enabled:

1. **Direct Messages**: Send a direct message to the bot
2. **Channel Mentions**: Mention the bot in a channel it's been invited to
3. **Slash Commands**:
   - `/snykaudit help` - Show help information
   - `/snykaudit status` - Check bot status
   - `/snykaudit config` - Configure the bot (admin only)

## Development

### Project Structure

```
SnykAudit/
├── src/
│   ├── api/          # Snyk API integration
│   ├── config/       # Configuration management
│   ├── core/         # Core business logic
│   ├── nlp/          # Natural language processing
│   ├── platforms/    # Interface adapters
│   ├── utils/        # Utility functions
│   └── index.js      # Main entry point
├── test/
│   ├── unit/         # Unit tests
│   └── integration/  # Integration tests
├── .env.example      # Example environment config
├── Dockerfile        # Docker configuration
└── docker-compose.yml
```

### Running Tests

```bash
npm test
```

### Running in Development Mode

```bash
npm run dev
```

## API Reference

### Webhook API

`POST /webhook`

**Headers**:
- `Authorization: Bearer your-webhook-auth-token`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "message": "Your natural language query",
  "context": {
    "userId": "optional-user-id",
    "channelId": "optional-channel-id"
  }
}
```

**Response**:
```json
{
  "message": "Response message",
  "data": {
    "events": []
  },
  "success": true,
  "timestamp": "2023-07-20T12:34:56.789Z"
}
```

### Configuration API

`POST /config`

**Headers**:
- `Authorization: Bearer your-config-api-token`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "apiKey": "your-snyk-api-key",
  "orgId": "your-org-id",
  "defaultDays": 14
}
```

## Security Considerations

- API keys are encrypted before being stored on disk
- Authentication is required for webhook and configuration endpoints
- Sensitive information is never logged

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Snyk](https://snyk.io/) for their excellent security platform and API
- [Slack](https://slack.com/) for their bot platform