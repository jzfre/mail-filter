import { EmailFilteringAgent } from "./emailFiltering.js";
import { config, logger } from "./config.js";

/**
 * Main entry point for the Email Filtering AI Agent
 */
async function main(): Promise<void> {
  logger.info("🚀 Mail Filter starting...");
  logger.info(`   Model: ${config.openaiModel}`);
  logger.info(`   Batch size: ${config.maxEmailBatchSize}`);
  logger.info(`   Processing limit: ${config.emailProcessingLimit}`);
  logger.info(`   Custom rules: ${config.customFilteringRules.length}`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const previewMode =
    args.includes("--preview") ||
    args.includes("--dry-run") ||
    args.includes("-p");
  const helpMode = args.includes("--help") || args.includes("-h");

  if (helpMode) {
    printHelp();
    return;
  }

  try {
    // Create and initialize the agent
    const agent = new EmailFilteringAgent(
      config.gmailCredentialsFile,
      config.gmailTokenFile,
      config.gmailProcessedLabel,
      config.openaiApiKey,
      config.openaiModel,
      config.customFilteringRules,
      config.unreadOnly,
      config.maxEmailBatchSize,
      config.emailProcessingLimit
    );

    await agent.initialize();

    if (previewMode) {
      // Preview mode - show what would happen without executing
      logger.info("\n🔍 Running in preview mode...\n");
      const decisions = await agent.preview();
      logger.info(
        `\n✅ Preview complete. ${decisions.length} emails would be processed.`
      );
    } else {
      // Execute filtering
      const stats = await agent.run();
      logger.info("\n✅ Email filtering complete!");
      logger.info(`   Processed ${stats.totalProcessed} emails`);
    }
  } catch (error) {
    logger.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
📧 Mail Filter

USAGE:
  npm start [options]
  npm run dev [options]

OPTIONS:
  --preview, --dry-run, -p    Preview decisions without executing them
  --help, -h                  Show this help message

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY           Your OpenAI API key (required)
  OPENAI_MODEL             OpenAI model to use (default: gpt-4.1-mini)
  GMAIL_CREDENTIALS_FILE   Path to Gmail credentials (default: credentials.json)
  GMAIL_TOKEN_FILE         Path to Gmail token (default: token.json)
  GMAIL_PROCESSED_LABEL    Label for processed emails (default: mail-filter/processed)
  UNREAD_ONLY              Only process unread emails (default: false)
  MAX_EMAIL_BATCH_SIZE     Max emails per batch (default: 50)
  EMAIL_PROCESSING_LIMIT   Max emails to process, 0=unlimited (default: 100)
  CUSTOM_FILTERING_RULES   Comma-separated custom rules
  LOG_LEVEL                Logging level (default: info)

EXAMPLES:
  # Run in preview mode
  npm start -- --preview

  # Run with custom rules
  CUSTOM_FILTERING_RULES="Delete spam,Keep from boss@company.com" npm start

For more information, see README.md
`);
}

// Run main
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
