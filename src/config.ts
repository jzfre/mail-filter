import dotenv from "dotenv";
import type { AppConfig } from "./types.js";

// Load environment variables
dotenv.config();

/**
 * Application configuration loaded from environment variables
 */
export function loadConfig(): AppConfig {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  return {
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    gmailCredentialsFile:
      process.env.GMAIL_CREDENTIALS_FILE || "credentials.json",
    gmailTokenFile: process.env.GMAIL_TOKEN_FILE || "token.json",
    gmailProcessedLabel:
      process.env.GMAIL_PROCESSED_LABEL || "mail-filter/processed",
    unreadOnly: process.env.UNREAD_ONLY === "true",
    maxEmailBatchSize: parseInt(process.env.MAX_EMAIL_BATCH_SIZE || "50", 10),
    emailProcessingLimit:
      process.env.EMAIL_PROCESSING_LIMIT === "0"
        ? Infinity
        : parseInt(process.env.EMAIL_PROCESSING_LIMIT || "100", 10),
    customFilteringRules: process.env.CUSTOM_FILTERING_RULES
      ? process.env.CUSTOM_FILTERING_RULES.split(",").map((rule: string) =>
          rule.trim()
        )
      : [],
    logLevel: process.env.LOG_LEVEL || "info",
  };
}

/**
 * Logger utility
 */
export class Logger {
  private level: string;
  private levels = ["debug", "info", "warn", "error"];

  constructor(level: string = "info") {
    this.level = level;
  }

  private shouldLog(messageLevel: string): boolean {
    return this.levels.indexOf(messageLevel) >= this.levels.indexOf(this.level);
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message), ...args);
    }
  }
}

export const config = loadConfig();
export const logger = new Logger(config.logLevel);
