import { describe, it, expect } from "vitest";
import { RulesManager } from "./rules.js";

describe("RulesManager", () => {
  describe("initialization", () => {
    it("should initialize with default rules", () => {
      const manager = new RulesManager([]);
      const rules = manager.getRules();

      expect(rules.length).toBeGreaterThanOrEqual(3);
      expect(rules.some((r) => r.id === "spam-promotional")).toBe(true);
      expect(rules.some((r) => r.id === "newsletter-archive")).toBe(true);
      expect(rules.some((r) => r.id === "important-keep")).toBe(true);
    });

    it("should add custom rules from string array", () => {
      const customRules = ["Delete spam emails", "Archive newsletters"];
      const manager = new RulesManager(customRules);
      const rules = manager.getRules();

      expect(rules.some((r) => r.id === "custom-0")).toBe(true);
      expect(rules.some((r) => r.id === "custom-1")).toBe(true);
    });
  });

  describe("parseCustomRule", () => {
    it("should parse delete action", () => {
      const manager = new RulesManager(["Delete promotional emails"]);
      const rules = manager.getRules();
      const customRule = rules.find((r) => r.id === "custom-0");

      expect(customRule?.action).toBe("delete");
    });

    it("should parse archive action", () => {
      const manager = new RulesManager(["Archive newsletters"]);
      const rules = manager.getRules();
      const customRule = rules.find((r) => r.id === "custom-0");

      expect(customRule?.action).toBe("archive");
    });

    it("should parse keep action", () => {
      const manager = new RulesManager(["Keep emails from boss"]);
      const rules = manager.getRules();
      const customRule = rules.find((r) => r.id === "custom-0");

      expect(customRule?.action).toBe("keep");
    });

    it("should parse mark_read action", () => {
      const manager = new RulesManager(["Mark read low priority emails"]);
      const rules = manager.getRules();
      const customRule = rules.find((r) => r.id === "custom-0");

      expect(customRule?.action).toBe("mark_read");
    });

    it("should default to keep for unknown actions", () => {
      const manager = new RulesManager(["Do something with emails"]);
      const rules = manager.getRules();
      const customRule = rules.find((r) => r.id === "custom-0");

      expect(customRule?.action).toBe("keep");
    });
  });

  describe("getRules", () => {
    it("should return rules sorted by priority", () => {
      const manager = new RulesManager([]);
      const rules = manager.getRules();

      for (let i = 1; i < rules.length; i++) {
        expect(rules[i].priority).toBeGreaterThanOrEqual(rules[i - 1].priority);
      }
    });

    it("should return a copy of rules array", () => {
      const manager = new RulesManager([]);
      const rules1 = manager.getRules();
      const rules2 = manager.getRules();

      expect(rules1).not.toBe(rules2);
      expect(rules1).toEqual(rules2);
    });
  });

  describe("getRulesForPrompt", () => {
    it("should format rules as numbered list", () => {
      const manager = new RulesManager([]);
      const prompt = manager.getRulesForPrompt();

      expect(prompt).toContain("1.");
      expect(prompt).toContain("→ Action:");
    });
  });

  describe("addRule", () => {
    it("should add a new rule", () => {
      const manager = new RulesManager([]);
      const initialCount = manager.getRules().length;

      manager.addRule({
        id: "test-rule",
        name: "Test Rule",
        description: "Test description",
        condition: "Test condition",
        action: "keep",
        priority: 100,
      });

      expect(manager.getRules().length).toBe(initialCount + 1);
      expect(manager.getRules().some((r) => r.id === "test-rule")).toBe(true);
    });
  });

  describe("removeRule", () => {
    it("should remove an existing rule", () => {
      const manager = new RulesManager([]);

      manager.addRule({
        id: "test-rule",
        name: "Test Rule",
        description: "Test description",
        condition: "Test condition",
        action: "keep",
        priority: 100,
      });

      const removed = manager.removeRule("test-rule");

      expect(removed).toBe(true);
      expect(manager.getRules().some((r) => r.id === "test-rule")).toBe(false);
    });

    it("should return false when removing non-existent rule", () => {
      const manager = new RulesManager([]);
      const removed = manager.removeRule("non-existent");

      expect(removed).toBe(false);
    });
  });
});
