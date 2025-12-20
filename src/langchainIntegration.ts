import { RunnableSequence } from "@langchain/core/runnables";
import type {
  Email,
  EmailSummary,
  FilterDecision,
  BatchFilterResult,
  FilterRule,
} from "./types.js";
import { AIProcessor } from "./aiProcessor.js";
import { logger } from "./config.js";

/**
 * Input type for the filtering chain
 */
interface FilterChainInput {
  emails: Email[];
  rules: FilterRule[];
  batchSize: number;
}

/**
 * Retry configuration for exponential backoff
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * LangChain integration for email filtering workflow
 */
export class EmailFilteringChain {
  private aiProcessor: AIProcessor;
  private retryConfig: RetryConfig;

  constructor(openaiApiKey: string, retryConfig?: Partial<RetryConfig>) {
    this.aiProcessor = new AIProcessor(openaiApiKey);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Create the email filtering chain using LangChain runnables
   */
  createChain(): RunnableSequence<FilterChainInput, BatchFilterResult> {
    return RunnableSequence.from([
      // Step 1: Prepare emails for processing
      {
        preparedEmails: (input: FilterChainInput) =>
          this.prepareEmails(input.emails),
        rules: (input: FilterChainInput) => input.rules,
        batchSize: (input: FilterChainInput) => input.batchSize,
      },
      // Step 2: Batch emails
      {
        batches: (input: {
          preparedEmails: EmailSummary[];
          batchSize: number;
        }) => this.batchEmails(input.preparedEmails, input.batchSize),
        rules: (input: { rules: FilterRule[] }) => input.rules,
      },
      // Step 3: Process batches with AI
      async (input: { batches: EmailSummary[][]; rules: FilterRule[] }) =>
        this.processBatches(input.batches, input.rules),
    ]);
  }

  /**
   * Prepare emails by extracting relevant information
   */
  private prepareEmails(emails: Email[]): EmailSummary[] {
    logger.debug(`Preparing ${emails.length} emails for processing`);

    return emails.map((email) => ({
      id: email.id,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet || email.body.substring(0, 500),
    }));
  }

  /**
   * Split emails into batches
   */
  private batchEmails(
    emails: EmailSummary[],
    batchSize: number
  ): EmailSummary[][] {
    const batches: EmailSummary[][] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }

    logger.info(`Split ${emails.length} emails into ${batches.length} batches`);
    return batches;
  }

  /**
   * Process all batches with AI
   */
  private async processBatches(
    batches: EmailSummary[][],
    rules: FilterRule[]
  ): Promise<BatchFilterResult> {
    const allDecisions: FilterDecision[] = [];
    const errors: string[] = [];
    let processedCount = 0;
    let consecutiveFailures = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(
        `Processing batch ${i + 1}/${batches.length} (${batch.length} emails)`
      );

      try {
        const decisions = await this.processBatchWithRetry(batch, rules, i + 1);
        allDecisions.push(...decisions);
        processedCount += batch.length;
        consecutiveFailures = 0; // Reset on success
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`Batch ${i + 1} failed after retries: ${errorMessage}`);
        logger.error(
          `Batch ${i + 1} processing failed after all retries:`,
          error
        );
        consecutiveFailures++;

        // If too many consecutive failures, increase delay significantly
        if (consecutiveFailures >= 3) {
          logger.warn("Multiple consecutive failures, increasing delay...");
          await this.delay(this.retryConfig.maxDelayMs);
        }
      }

      // Add delay between batches (exponential based on recent failures)
      if (i < batches.length - 1) {
        const delayMs = this.calculateDelay(consecutiveFailures);
        await this.delay(delayMs);
      }
    }

    return {
      decisions: allDecisions,
      processedCount,
      errors,
    };
  }

  /**
   * Process a single batch with retry logic and exponential backoff
   */
  private async processBatchWithRetry(
    batch: EmailSummary[],
    rules: FilterRule[],
    batchNumber: number
  ): Promise<FilterDecision[]> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delayMs = this.calculateDelay(attempt);
          logger.info(
            `Retrying batch ${batchNumber} (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}) after ${delayMs}ms delay...`
          );
          await this.delay(delayMs);
        }

        return await this.aiProcessor.analyzeEmails(batch, rules);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable (rate limit, timeout, etc.)
        if (!this.isRetryableError(lastError)) {
          logger.error(
            `Non-retryable error for batch ${batchNumber}:`,
            lastError
          );
          throw lastError;
        }

        logger.warn(
          `Batch ${batchNumber} attempt ${attempt + 1} failed: ${lastError.message}`
        );
      }
    }

    throw lastError ?? new Error("Unknown error after retries");
  }

  /**
   * Calculate delay using exponential backoff with jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay =
      this.retryConfig.baseDelayMs * Math.pow(2, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelayMs);

    // Add jitter (±25%) to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Rate limiting errors
    if (message.includes("rate limit") || message.includes("429")) {
      return true;
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return true;
    }

    // Temporary server errors
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return true;
    }

    // Network errors
    if (
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("network")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Run the filtering chain
   */
  async run(
    emails: Email[],
    rules: FilterRule[],
    batchSize: number
  ): Promise<BatchFilterResult> {
    const chain = this.createChain();
    return chain.invoke({ emails, rules, batchSize });
  }
}
