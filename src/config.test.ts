import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger } from "./config.js";

describe("Logger", () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("log level filtering", () => {
    it("should log all levels when level is debug", () => {
      const logger = new Logger("debug");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it("should not log debug when level is info", () => {
      const logger = new Logger("info");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it("should only log warn and error when level is warn", () => {
      const logger = new Logger("warn");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it("should only log error when level is error", () => {
      const logger = new Logger("error");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("message formatting", () => {
    it("should include timestamp in log messages", () => {
      const logger = new Logger("info");

      logger.info("test message");

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        // No additional args
      );
    });

    it("should include log level in uppercase", () => {
      const logger = new Logger("info");

      logger.info("test message");

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]")
      );
    });

    it("should include the message content", () => {
      const logger = new Logger("info");

      logger.info("my test message");

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("my test message")
      );
    });

    it("should pass additional arguments", () => {
      const logger = new Logger("info");
      const extraData = { foo: "bar" };

      logger.info("test message", extraData);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        extraData
      );
    });
  });

  describe("default level", () => {
    it("should default to info level", () => {
      const logger = new Logger();

      logger.debug("debug message");
      logger.info("info message");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });
  });
});
