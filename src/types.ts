/**
 * Type definitions for the Email Filtering AI Agent
 */

export interface Email {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  date: Date;
  labels: string[];
  isUnread: boolean;
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  dateStr: string;
  ageInDays: number;
}

export type FilterAction = "delete" | "keep" | "archive" | "mark_read";

export interface FilterDecision {
  emailId: string;
  action: FilterAction;
  reason: string;
  confidence: number;
}

export interface BatchFilterResult {
  decisions: FilterDecision[];
  processedCount: number;
  errors: string[];
}

export interface FilterRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: FilterAction;
  priority: number;
}

export interface ProcessingStats {
  totalProcessed: number;
  deleted: number;
  kept: number;
  archived: number;
  markedRead: number;
  errors: number;
}

export interface GmailCredentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export interface GmailToken {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface AppConfig {
  openaiApiKey: string;
  openaiModel: string;
  gmailCredentialsFile: string;
  gmailTokenFile: string;
  gmailProcessedLabel: string;
  unreadOnly: boolean;
  maxEmailBatchSize: number;
  emailProcessingLimit: number;
  customFilteringRules: string[];
  logLevel: string;
}

export interface AIFilterRequest {
  emails: EmailSummary[];
  rules: FilterRule[];
}

export interface AIFilterResponse {
  decisions: FilterDecision[];
}
