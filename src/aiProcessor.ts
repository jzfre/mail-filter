import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import type {
  EmailSummary,
  FilterDecision,
  FilterRule,
  FilterAction,
} from "./types.js";
import { logger } from "./config.js";

/**
 * Schema for AI filter response validation
 */
const FilterDecisionSchema = z.object({
  emailId: z.string(),
  action: z.enum(["delete", "keep", "archive", "mark_read"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

const AIResponseSchema = z.object({
  decisions: z.array(FilterDecisionSchema),
});

/**
 * AI Processor for email filtering using OpenAI GPT
 */
export class AIProcessor {
  private model: ChatOpenAI;

  constructor(apiKey: string) {
    this.model = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: "gpt-4o",
      temperature: 0.1, // Low temperature for consistent decisions
    });
    logger.info("AI Processor initialized with GPT-4o");
  }

  /**
   * Analyze a batch of emails and return filtering decisions
   */
  async analyzeEmails(
    emails: EmailSummary[],
    rules: FilterRule[]
  ): Promise<FilterDecision[]> {
    if (emails.length === 0) {
      return [];
    }

    logger.info(`Analyzing ${emails.length} emails with AI...`);

    const systemPrompt = this.buildSystemPrompt(rules);
    const userPrompt = this.buildUserPrompt(emails);

    try {
      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const content = response.content as string;
      const decisions = this.parseResponse(content, emails);

      logger.info(`AI analysis complete: ${decisions.length} decisions made`);
      return decisions;
    } catch (error) {
      logger.error("AI analysis failed:", error);
      // Return default "keep" decisions on error
      return emails.map((email) => ({
        emailId: email.id,
        action: "keep" as FilterAction,
        reason: "AI analysis failed, keeping email by default",
        confidence: 0,
      }));
    }
  }

  /**
   * Build system prompt with filtering rules
   */
  private buildSystemPrompt(rules: FilterRule[]): string {
    const rulesText = rules
      .map(
        (rule, i) => `${i + 1}. ${rule.description} → Action: ${rule.action}`
      )
      .join("\n");

    return `You are an intelligent email filtering assistant. Your job is to analyze emails and decide what action to take based on the given rules.

## Filtering Rules:
${rulesText}

## Available Actions:
- "delete": Move email to trash (for spam, unwanted promotional emails)
- "keep": Keep in inbox as unread (for important emails)
- "archive": Remove from inbox but keep (for newsletters, less urgent items)
- "mark_read": Mark as read but keep in inbox

## Response Format:
Respond with a JSON object containing an array of decisions. Each decision must have:
- emailId: The ID of the email
- action: One of "delete", "keep", "archive", "mark_read"
- reason: Brief explanation for the decision
- confidence: A number between 0 and 1 indicating confidence in the decision

Example response:
{
  "decisions": [
    {"emailId": "abc123", "action": "delete", "reason": "Promotional spam", "confidence": 0.95},
    {"emailId": "def456", "action": "keep", "reason": "Important work email", "confidence": 0.9}
  ]
}

Be conservative - when in doubt, keep the email. Never delete potentially important emails.`;
  }

  /**
   * Build user prompt with email summaries
   */
  private buildUserPrompt(emails: EmailSummary[]): string {
    const emailsList = emails
      .map((email, i) => {
        return `[Email ${i + 1}]
ID: ${email.id}
From: ${email.from}
Subject: ${email.subject}
Preview: ${email.snippet.substring(0, 200)}${
          email.snippet.length > 200 ? "..." : ""
        }
---`;
      })
      .join("\n\n");

    return `Please analyze the following ${emails.length} emails and provide filtering decisions:

${emailsList}

Respond with JSON only.`;
  }

  /**
   * Parse AI response into FilterDecision array
   */
  private parseResponse(
    content: string,
    emails: EmailSummary[]
  ): FilterDecision[] {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      const validated = AIResponseSchema.parse(parsed);

      // Ensure all emails have a decision
      const decisionsMap = new Map(
        validated.decisions.map((d: FilterDecision) => [d.emailId, d])
      );

      return emails.map((email): FilterDecision => {
        const decision = decisionsMap.get(email.id);
        if (decision) {
          return decision;
        }
        // Default to keep if no decision provided
        return {
          emailId: email.id,
          action: "keep" as FilterAction,
          reason: "No explicit decision from AI, keeping by default",
          confidence: 0.5,
        };
      });
    } catch (error) {
      logger.error("Failed to parse AI response:", error);
      logger.debug("Raw response:", content);

      // Return default decisions on parse error
      return emails.map((email) => ({
        emailId: email.id,
        action: "keep" as FilterAction,
        reason: "Failed to parse AI response, keeping by default",
        confidence: 0,
      }));
    }
  }
}
