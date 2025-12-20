import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import * as readline from "readline";
import type { Email, GmailCredentials, GmailToken } from "./types.js";
import { logger } from "./config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

/**
 * Gmail API Client for email operations
 */
export class GmailClient {
  private oauth2Client: OAuth2Client | null = null;
  private gmail: gmail_v1.Gmail | null = null;
  private credentialsFile: string;
  private tokenFile: string;

  constructor(credentialsFile: string, tokenFile: string) {
    this.credentialsFile = credentialsFile;
    this.tokenFile = tokenFile;
  }

  /**
   * Initialize the Gmail client with OAuth2 authentication
   */
  async initialize(): Promise<void> {
    logger.info("Initializing Gmail client...");

    const credentials = await this.loadCredentials();
    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web || {};

    if (!client_id || !client_secret) {
      throw new Error("Invalid credentials file format");
    }

    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0] || "http://localhost"
    );

    const token = await this.getToken();
    this.oauth2Client.setCredentials(token);

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    logger.info("Gmail client initialized successfully");
  }

  /**
   * Load credentials from file
   */
  private async loadCredentials(): Promise<GmailCredentials> {
    try {
      const content = await fs.readFile(this.credentialsFile, "utf-8");
      return JSON.parse(content) as GmailCredentials;
    } catch {
      throw new Error(
        `Failed to load credentials from ${this.credentialsFile}. ` +
          "Please download OAuth 2.0 credentials from Google Cloud Console."
      );
    }
  }

  /**
   * Get OAuth2 token, either from file or by prompting user
   */
  private async getToken(): Promise<GmailToken> {
    try {
      const content = await fs.readFile(this.tokenFile, "utf-8");
      return JSON.parse(content) as GmailToken;
    } catch {
      logger.info("No token found, initiating OAuth flow...");
      return await this.getNewToken();
    }
  }

  /**
   * Get a new token by prompting user for authorization
   */
  private async getNewToken(): Promise<GmailToken> {
    if (!this.oauth2Client) {
      throw new Error("OAuth2 client not initialized");
    }

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    console.log("\n🔐 Authorize this app by visiting this URL:\n");
    console.log(authUrl);
    console.log("\n");

    const code = await this.promptForCode();

    const { tokens } = await this.oauth2Client.getToken(code);

    // Save token for future use
    await fs.writeFile(this.tokenFile, JSON.stringify(tokens, null, 2));
    logger.info("Token saved successfully");

    return tokens as GmailToken;
  }

  /**
   * Prompt user to enter authorization code
   */
  private promptForCode(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question("Enter the authorization code: ", (code: string) => {
        rl.close();
        resolve(code);
      });
    });
  }

  /**
   * Fetch unread emails from Gmail
   */
  async getUnreadEmails(maxResults: number = 100): Promise<Email[]> {
    if (!this.gmail) {
      throw new Error("Gmail client not initialized. Call initialize() first.");
    }

    logger.info(`Fetching up to ${maxResults} unread emails...`);

    const response = await this.gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults,
    });

    const messages = response.data.messages || [];
    logger.info(`Found ${messages.length} unread emails`);

    const emails: Email[] = [];

    for (const message of messages) {
      if (message.id) {
        try {
          const email = await this.getEmailDetails(message.id);
          if (email) {
            emails.push(email);
          }
        } catch (error) {
          logger.error(`Failed to fetch email ${message.id}:`, error);
        }
      }
    }

    return emails;
  }

  /**
   * Get detailed information about a specific email
   */
  private async getEmailDetails(messageId: string): Promise<Email | null> {
    if (!this.gmail) {
      return null;
    }

    const response = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];

    const getHeader = (name: string): string => {
      const header = headers.find(
        (h: gmail_v1.Schema$MessagePartHeader) =>
          h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || "";
    };

    const body = this.extractBody(message.payload);

    return {
      id: message.id || "",
      threadId: message.threadId || "",
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      body,
      snippet: message.snippet || "",
      date: new Date(parseInt(message.internalDate || "0")),
      labels: message.labelIds || [],
      isUnread: message.labelIds?.includes("UNREAD") || false,
    };
  }

  /**
   * Extract email body from message payload
   */
  private extractBody(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): string {
    if (!payload) {
      return "";
    }

    // Check for plain text body
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Check parts for multipart messages
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }
      // Fallback to HTML if no plain text
      for (const part of payload.parts) {
        if (part.mimeType === "text/html" && part.body?.data) {
          return Buffer.from(part.body.data, "base64").toString("utf-8");
        }
      }
    }

    return "";
  }

  /**
   * Delete an email by moving it to trash
   */
  async deleteEmail(emailId: string): Promise<boolean> {
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }

    try {
      await this.gmail.users.messages.trash({
        userId: "me",
        id: emailId,
      });
      logger.debug(`Deleted email: ${emailId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete email ${emailId}:`, error);
      return false;
    }
  }

  /**
   * Archive an email by removing INBOX label
   */
  async archiveEmail(emailId: string): Promise<boolean> {
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: emailId,
        requestBody: {
          removeLabelIds: ["INBOX"],
        },
      });
      logger.debug(`Archived email: ${emailId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to archive email ${emailId}:`, error);
      return false;
    }
  }

  /**
   * Mark an email as read
   */
  async markAsRead(emailId: string): Promise<boolean> {
    if (!this.gmail) {
      throw new Error("Gmail client not initialized");
    }

    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: emailId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
      logger.debug(`Marked email as read: ${emailId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to mark email as read ${emailId}:`, error);
      return false;
    }
  }
}
