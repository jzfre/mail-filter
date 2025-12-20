import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmailSummary, FilterRule } from "./types.js";

// Mock the langchain modules before importing AIProcessor
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn(),
  })),
}));

vi.mock("@langchain/core/messages", () => ({
  SystemMessage: vi.fn().mockImplementation((content: string) => ({ content })),
  HumanMessage: vi.fn().mockImplementation((content: string) => ({ content })),
}));

// Suppress logger output during tests
vi.mock("./config.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AIProcessor", () => {
  const mockEmails: EmailSummary[] = [
    {
      id: "email-1",
      from: "spam@example.com",
      subject: "Buy now! Limited offer!",
      snippet: "Amazing deals just for you...",
    },
    {
      id: "email-2",
      from: "boss@company.com",
      subject: "Q4 Planning Meeting",
      snippet: "Please review the attached documents...",
    },
  ];

  const mockRules: FilterRule[] = [
    {
      id: "rule-1",
      name: "Delete Spam",
      description: "Delete promotional spam",
      condition: "Promotional content",
      action: "delete",
      priority: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("analyzeEmails", () => {
    it("should return empty array for empty email list", async () => {
      const { AIProcessor } = await import("./aiProcessor.js");
      const processor = new AIProcessor("test-api-key");

      const result = await processor.analyzeEmails([], mockRules);

      expect(result).toEqual([]);
    });

    it("should return decisions for each email on successful analysis", async () => {
      const mockResponse = {
        content: JSON.stringify({
          decisions: [
            {
              emailId: "email-1",
              action: "delete",
              reason: "Promotional spam",
              confidence: 0.95,
            },
            {
              emailId: "email-2",
              action: "keep",
              reason: "Important work email",
              confidence: 0.9,
            },
          ],
        }),
      };

      const { ChatOpenAI } = await import("@langchain/openai");
      vi.mocked(ChatOpenAI).mockImplementation(
        () =>
          ({
            invoke: vi.fn().mockResolvedValue(mockResponse),
          }) as unknown as InstanceType<typeof ChatOpenAI>
      );

      const { AIProcessor } = await import("./aiProcessor.js");
      const processor = new AIProcessor("test-api-key");

      const result = await processor.analyzeEmails(mockEmails, mockRules);

      expect(result).toHaveLength(2);
      expect(result[0].emailId).toBe("email-1");
      expect(result[0].action).toBe("delete");
      expect(result[1].emailId).toBe("email-2");
      expect(result[1].action).toBe("keep");
    });

    it("should return default keep decisions on API error", async () => {
      const { ChatOpenAI } = await import("@langchain/openai");
      vi.mocked(ChatOpenAI).mockImplementation(
        () =>
          ({
            invoke: vi.fn().mockRejectedValue(new Error("API Error")),
          }) as unknown as InstanceType<typeof ChatOpenAI>
      );

      const { AIProcessor } = await import("./aiProcessor.js");
      const processor = new AIProcessor("test-api-key");

      const result = await processor.analyzeEmails(mockEmails, mockRules);

      expect(result).toHaveLength(2);
      expect(result.every((d) => d.action === "keep")).toBe(true);
      expect(result.every((d) => d.confidence === 0)).toBe(true);
    });

    it("should return default keep decisions on invalid JSON response", async () => {
      const mockResponse = {
        content: "This is not valid JSON",
      };

      const { ChatOpenAI } = await import("@langchain/openai");
      vi.mocked(ChatOpenAI).mockImplementation(
        () =>
          ({
            invoke: vi.fn().mockResolvedValue(mockResponse),
          }) as unknown as InstanceType<typeof ChatOpenAI>
      );

      const { AIProcessor } = await import("./aiProcessor.js");
      const processor = new AIProcessor("test-api-key");

      const result = await processor.analyzeEmails(mockEmails, mockRules);

      expect(result).toHaveLength(2);
      expect(result.every((d) => d.action === "keep")).toBe(true);
    });

    it("should fill missing email decisions with default keep", async () => {
      const mockResponse = {
        content: JSON.stringify({
          decisions: [
            {
              emailId: "email-1",
              action: "delete",
              reason: "Spam",
              confidence: 0.9,
            },
            // email-2 decision is missing
          ],
        }),
      };

      const { ChatOpenAI } = await import("@langchain/openai");
      vi.mocked(ChatOpenAI).mockImplementation(
        () =>
          ({
            invoke: vi.fn().mockResolvedValue(mockResponse),
          }) as unknown as InstanceType<typeof ChatOpenAI>
      );

      const { AIProcessor } = await import("./aiProcessor.js");
      const processor = new AIProcessor("test-api-key");

      const result = await processor.analyzeEmails(mockEmails, mockRules);

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe("delete");
      expect(result[1].action).toBe("keep");
      expect(result[1].confidence).toBe(0.5);
    });
  });
});
