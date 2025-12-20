import type { FilterRule, FilterAction } from "./types.js";
import { logger } from "./config.js";

/**
 * Default filtering rules
 */
const DEFAULT_RULES: FilterRule[] = [
  {
    id: "spam-promotional",
    name: "Promotional Spam",
    description: "Delete obvious promotional and spam emails",
    condition:
      "Email contains promotional content, unsubscribe links, or marketing language",
    action: "delete",
    priority: 1,
  },
  {
    id: "newsletter-archive",
    name: "Newsletter Archive",
    description: "Archive newsletters for later reading",
    condition: "Email is a newsletter or digest",
    action: "archive",
    priority: 2,
  },
  {
    id: "important-keep",
    name: "Important Emails",
    description: "Keep important emails from known contacts",
    condition:
      "Email is from a known contact or contains urgent/important content",
    action: "keep",
    priority: 3,
  },
];

/**
 * Rules Manager for handling email filtering rules
 */
export class RulesManager {
  private rules: FilterRule[] = [];

  constructor(customRules: string[] = []) {
    this.rules = [...DEFAULT_RULES];
    this.addCustomRules(customRules);
    logger.info(`Initialized RulesManager with ${this.rules.length} rules`);
  }

  /**
   * Parse and add custom rules from string format
   */
  private addCustomRules(customRules: string[]): void {
    customRules.forEach((ruleStr, index) => {
      const rule = this.parseCustomRule(ruleStr, index);
      if (rule) {
        this.rules.push(rule);
        logger.debug(`Added custom rule: ${rule.name}`);
      }
    });
  }

  /**
   * Parse a custom rule string into a FilterRule object
   * Format: "Action emails with condition" (e.g., "Delete promotional emails with 'offer' in subject")
   */
  private parseCustomRule(ruleStr: string, index: number): FilterRule | null {
    const lowerRule = ruleStr.toLowerCase();

    let action: FilterAction = "keep";
    if (lowerRule.startsWith("delete")) {
      action = "delete";
    } else if (lowerRule.startsWith("archive")) {
      action = "archive";
    } else if (lowerRule.startsWith("keep")) {
      action = "keep";
    } else if (
      lowerRule.startsWith("mark read") ||
      lowerRule.startsWith("mark_read")
    ) {
      action = "mark_read";
    }

    return {
      id: `custom-${index}`,
      name: `Custom Rule ${index + 1}`,
      description: ruleStr,
      condition: ruleStr,
      action,
      priority: 10 + index,
    };
  }

  /**
   * Get all rules sorted by priority
   */
  getRules(): FilterRule[] {
    return [...this.rules].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get rules formatted for AI prompt
   */
  getRulesForPrompt(): string {
    return this.getRules()
      .map(
        (rule, index) =>
          `${index + 1}. ${rule.description} → Action: ${rule.action}`
      )
      .join("\n");
  }

  /**
   * Add a new rule
   */
  addRule(rule: FilterRule): void {
    this.rules.push(rule);
    logger.info(`Added new rule: ${rule.name}`);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
    const removed = this.rules.length < initialLength;
    if (removed) {
      logger.info(`Removed rule: ${ruleId}`);
    }
    return removed;
  }
}
