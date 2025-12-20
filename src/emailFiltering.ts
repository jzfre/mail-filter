import type {
  FilterDecision,
  ProcessingStats,
  BatchFilterResult,
  FilterAction,
} from "./types.js";
import { GmailClient } from "./gmailClient.js";
import { EmailFilteringChain } from "./langchainIntegration.js";
import { RulesManager } from "./rules.js";
import { logger } from "./config.js";

/**
 * Main Email Filtering Agent that orchestrates the entire workflow
 */
export class EmailFilteringAgent {
  private gmailClient: GmailClient;
  private filteringChain: EmailFilteringChain;
  private rulesManager: RulesManager;
  private batchSize: number;
  private processingLimit: number;

  constructor(
    gmailCredentialsFile: string,
    gmailTokenFile: string,
    openaiApiKey: string,
    customRules: string[],
    batchSize: number = 50,
    processingLimit: number = 100
  ) {
    this.gmailClient = new GmailClient(gmailCredentialsFile, gmailTokenFile);
    this.filteringChain = new EmailFilteringChain(openaiApiKey);
    this.rulesManager = new RulesManager(customRules);
    this.batchSize = batchSize;
    this.processingLimit = processingLimit;
  }

  /**
   * Initialize the agent (authenticate with Gmail)
   */
  async initialize(): Promise<void> {
    logger.info("Initializing Email Filtering Agent...");
    await this.gmailClient.initialize();
    logger.info("Email Filtering Agent initialized successfully");
  }

  /**
   * Run the email filtering workflow
   */
  async run(): Promise<ProcessingStats> {
    logger.info("Starting email filtering workflow...");

    const stats: ProcessingStats = {
      totalProcessed: 0,
      deleted: 0,
      kept: 0,
      archived: 0,
      markedRead: 0,
      errors: 0,
    };

    try {
      // Step 1: Fetch unread emails
      const emails = await this.gmailClient.getUnreadEmails(
        this.processingLimit
      );

      if (emails.length === 0) {
        logger.info("No unread emails to process");
        return stats;
      }

      logger.info(`Found ${emails.length} unread emails to process`);

      // Step 2: Run filtering chain
      const filterResult = await this.filteringChain.run(
        emails,
        this.rulesManager.getRules(),
        this.batchSize
      );

      // Step 3: Execute actions
      const actionStats = await this.executeActions(filterResult);

      stats.totalProcessed = filterResult.processedCount;
      stats.deleted = actionStats.deleted;
      stats.kept = actionStats.kept;
      stats.archived = actionStats.archived;
      stats.markedRead = actionStats.markedRead;
      stats.errors = filterResult.errors.length + actionStats.errors;

      // Log summary
      this.logSummary(stats, filterResult);

      return stats;
    } catch (error) {
      logger.error("Email filtering workflow failed:", error);
      throw error;
    }
  }

  /**
   * Execute filtering actions based on AI decisions
   */
  private async executeActions(filterResult: BatchFilterResult): Promise<{
    deleted: number;
    kept: number;
    archived: number;
    markedRead: number;
    errors: number;
  }> {
    const results = {
      deleted: 0,
      kept: 0,
      archived: 0,
      markedRead: 0,
      errors: 0,
    };

    for (const decision of filterResult.decisions) {
      try {
        const success = await this.executeAction(decision);

        if (success) {
          switch (decision.action) {
            case "delete":
              results.deleted++;
              break;
            case "keep":
              results.kept++;
              break;
            case "archive":
              results.archived++;
              break;
            case "mark_read":
              results.markedRead++;
              break;
          }
        } else {
          results.errors++;
        }
      } catch (error) {
        logger.error(
          `Failed to execute action for email ${decision.emailId}:`,
          error
        );
        results.errors++;
      }
    }

    return results;
  }

  /**
   * Execute a single filtering action
   */
  private async executeAction(decision: FilterDecision): Promise<boolean> {
    logger.debug(
      `Executing ${decision.action} for email ${decision.emailId}: ${decision.reason}`
    );

    switch (decision.action) {
      case "delete":
        return this.gmailClient.deleteEmail(decision.emailId);
      case "archive":
        return this.gmailClient.archiveEmail(decision.emailId);
      case "mark_read":
        return this.gmailClient.markAsRead(decision.emailId);
      case "keep":
        // No action needed for "keep"
        return true;
      default: {
        const _exhaustiveCheck: never = decision.action;
        logger.warn(`Unknown action: ${_exhaustiveCheck as FilterAction}`);
        return false;
      }
    }
  }

  /**
   * Log processing summary
   */
  private logSummary(
    stats: ProcessingStats,
    filterResult: BatchFilterResult
  ): void {
    logger.info("\n📊 Email Filtering Summary:");
    logger.info(`   Total Processed: ${stats.totalProcessed}`);
    logger.info(`   ✅ Kept: ${stats.kept}`);
    logger.info(`   🗑️  Deleted: ${stats.deleted}`);
    logger.info(`   📁 Archived: ${stats.archived}`);
    logger.info(`   📖 Marked Read: ${stats.markedRead}`);
    logger.info(`   ❌ Errors: ${stats.errors}`);

    if (filterResult.errors.length > 0) {
      logger.warn("\n⚠️ Errors encountered:");
      filterResult.errors.forEach((error) => logger.warn(`   - ${error}`));
    }
  }

  /**
   * Preview filtering decisions without executing them
   */
  async preview(): Promise<FilterDecision[]> {
    logger.info("Running in preview mode (no actions will be executed)...");

    const emails = await this.gmailClient.getUnreadEmails(this.processingLimit);

    if (emails.length === 0) {
      logger.info("No unread emails to process");
      return [];
    }

    const filterResult = await this.filteringChain.run(
      emails,
      this.rulesManager.getRules(),
      this.batchSize
    );

    // Log preview
    logger.info("\n📋 Preview of filtering decisions:");
    for (const decision of filterResult.decisions) {
      const email = emails.find((e) => e.id === decision.emailId);
      logger.info(`\n   Email: ${email?.subject || "Unknown"}`);
      logger.info(`   From: ${email?.from || "Unknown"}`);
      logger.info(`   Action: ${decision.action}`);
      logger.info(`   Reason: ${decision.reason}`);
      logger.info(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    }

    return filterResult.decisions;
  }
}
