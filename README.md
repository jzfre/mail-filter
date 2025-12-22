# Mail Filter

An intelligent email filtering system that uses OpenAI GPT to automatically categorize and filter your Gmail inbox. Built with TypeScript and Node.js.

## Features

- **AI-Powered Filtering**: Uses OpenAI GPT to analyze email content and make filtering decisions
- **Custom Rules**: Supports custom filtering rules for your specific needs
- **Batch Processing**: Processes emails in batches to optimize API usage
- **Gmail Integration**: Direct integration with Gmail API for email operations
- **LangChain Integration**: Uses LangChain for structured AI workflow orchestration
- **Type Safety**: Full TypeScript implementation with strict typing
- **Error Handling**: Comprehensive error handling with exponential backoff retry logic

## Architecture

This agent uses LangChain for workflow orchestration, with the following components:

1. **Gmail Client**: Handles authentication and email operations via Gmail API
2. **AI Processor**: Integrates with OpenAI GPT for content analysis using LangChain
3. **Rules Manager**: Applies custom filtering rules to enhance decision-making
4. **Email Filtering Agent**: Main orchestrator that ties everything together

## Requirements

- Node.js 18+
- Gmail account with API access enabled
- OpenAI API key

## Setup Instructions

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd mail-filter
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up Gmail API**:

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select an existing one)
   - Enable the **Gmail API**:
     - Go to "APIs & Services" → "Library"
     - Search for "Gmail API" → Enable it
   - Configure **OAuth consent screen**:
     - Go to "APIs & Services" → "OAuth consent screen"
     - **Select "External"** (required for personal Gmail accounts)
     - Fill in app name, support email, and developer email
     - Add scopes: `gmail.readonly` and `gmail.modify`
     - Add your email as a test user (required while app is in testing mode)
   - Create **OAuth credentials**:
     - Go to "APIs & Services" → "Credentials"
     - Click "Create Credentials" → "OAuth 2.0 Client ID"
     - Select "Desktop app" as the application type
     - Download the JSON file and save it as `credentials.json` in the project root

4. **Set environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

5. **Build and run the agent**:

   ```bash
   npm run build
   npm start
   ```

   Or for development:

   ```bash
   npm run dev
   ```

6. **First-time authentication**:

   On first run, the app will prompt you to authorize Gmail access:
   - A URL will be printed to the terminal
   - Open the URL in your browser and sign in with your Google account
   - Authorize the app to access your Gmail
   - You'll be redirected to a localhost URL that won't load (this is normal)
   - Copy the `code` parameter from the URL (between `code=` and `&scope=`)
   - Paste the code back into the terminal and press Enter
   - The app saves the token to `token.json` (auto-generated, don't commit this file)

## Configuration

### Environment Variables

| Variable                 | Description                    | Default            |
| ------------------------ | ------------------------------ | ------------------ |
| `OPENAI_API_KEY`         | Your OpenAI API key            | Required           |
| `GMAIL_CREDENTIALS_FILE` | Path to Gmail credentials file | `credentials.json` |
| `GMAIL_TOKEN_FILE`       | Path to Gmail token file (auto-generated) | `token.json`       |
| `MAX_EMAIL_BATCH_SIZE`   | Maximum emails per batch       | `50`               |
| `EMAIL_PROCESSING_LIMIT` | Maximum emails to process      | `100`              |
| `CUSTOM_FILTERING_RULES` | Comma-separated custom rules   | Optional           |
| `LOG_LEVEL`              | Logging level                  | `info`             |

### Example Custom Rules

```bash
CUSTOM_FILTERING_RULES="Keep emails from my manager,Delete promotional emails with 'offer' in subject,Archive newsletters"
```

## How It Works

1. **Email Retrieval**: The agent fetches unread emails from your Gmail inbox
2. **Batching**: Emails are processed in batches (max 50 at a time)
3. **AI Analysis**: Each batch is sent to OpenAI GPT for analysis via LangChain
4. **Rule Application**: Custom filtering rules are applied to guide decisions
5. **Action Execution**: Emails are either deleted or marked as read based on AI analysis

## Project Structure

```
src/
├── index.ts              # Main application entry point
├── config.ts             # Configuration and settings
├── gmailClient.ts        # Gmail API integration
├── aiProcessor.ts        # AI processing with OpenAI GPT
├── langchainIntegration.ts # LangChain workflow setup
├── rules.ts              # Custom filtering rules
├── emailFiltering.ts     # Core filtering logic
└── types.ts              # TypeScript type definitions
```

## Development

```bash
# Run type checking
npm run typecheck

# Run linter
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run all checks (typecheck + lint + format)
npm run check
```

## Security Considerations

- The agent accesses your Gmail account and reads email content
- API keys should be stored securely in environment variables
- Never commit `credentials.json`, `token.json`, or `.env` files
- Consider using a dedicated Gmail account for testing

## Error Handling

The agent includes comprehensive error handling:

- Exponential backoff retry logic for API failures
- Graceful degradation when AI analysis fails
- Detailed error reporting in logs

## License

MIT License
