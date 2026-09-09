/**
 * Structured logger with namespace prefix for easy filtering.
 *
 * Usage:
 *   import { logger } from "@/lib/core/logger";
 *   logger.warn("[share-url]", "Failed to parse URL:", err);
 *
 * In development the prefix makes it easy to filter console output.
 * In production set window.__LOG_LEVEL = "error" to silence warnings.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

declare global {
  interface Window {
    __LOG_LEVEL?: "debug" | "info" | "warn" | "error";
  }
}

const shouldLog = (level: LogLevel): boolean => {
  if (typeof window !== "undefined" && window.__LOG_LEVEL === "error") {
    return level === "error";
  }
  return true;
};

export const logger = {
  debug(...args: unknown[]): void {
    if (shouldLog("debug")) console.debug(...args);
  },
  info(...args: unknown[]): void {
    if (shouldLog("info")) console.info(...args);
  },
  warn(...args: unknown[]): void {
    if (shouldLog("warn")) console.warn(...args);
  },
  error(...args: unknown[]): void {
    if (shouldLog("error")) console.error(...args);
  },
};
