import { describe, expect, it } from "vitest";

import { detectApiFailure, isAutoRetryNotice } from "../src/terminalRuntime/apiFailureDetector";

describe("detectApiFailure", () => {
  it("returns null for ordinary output", () => {
    expect(detectApiFailure("Reading file src/index.ts")).toBeNull();
    expect(detectApiFailure("✓ Tests passed (12 ms)")).toBeNull();
    expect(detectApiFailure("")).toBeNull();
  });

  it("detects Anthropic 5xx Overloaded errors", () => {
    const result = detectApiFailure("⏺ API Error (529 service_overloaded): Overloaded");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("server_overloaded");
    expect(result?.statusCode).toBe(529);
  });

  it("detects bare 'Overloaded' messages", () => {
    const result = detectApiFailure("Anthropic API: Overloaded, please try again");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("server_overloaded");
  });

  it("detects 503 service unavailable", () => {
    const result = detectApiFailure("API Error: 503 Service Unavailable");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("server_error");
    expect(result?.statusCode).toBe(503);
  });

  it("detects 429 rate limit", () => {
    const result = detectApiFailure("API Error: 429 rate_limit_exceeded");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("rate_limit");
    expect(result?.statusCode).toBe(429);
  });

  it("detects 'rate limit' keyword without status", () => {
    const result = detectApiFailure("Request blocked: rate limit reached");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("rate_limit");
  });

  it("detects fetch failed", () => {
    const result = detectApiFailure("TypeError: fetch failed");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("network_error");
  });

  it("detects ECONNRESET", () => {
    const result = detectApiFailure("Error: read ECONNRESET");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("network_error");
  });

  it("detects connection timed out", () => {
    const result = detectApiFailure("connection timed out after 60s");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("network_error");
  });

  it("detects request timed out", () => {
    const result = detectApiFailure("API Error: Request timed out.");
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("network_error");
  });

  it("strips ANSI escape codes before matching", () => {
    const ansi = "[31mAPI Error (529 service_overloaded): Overloaded[0m";
    const result = detectApiFailure(ansi);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("server_overloaded");
  });

  it("returns the first detection when multiple patterns appear", () => {
    const chunk = "API Error: 503 Service Unavailable\nfetch failed";
    const result = detectApiFailure(chunk);
    expect(result).not.toBeNull();
    expect(result?.statusCode).toBe(503);
  });
});

describe("isAutoRetryNotice", () => {
  it("recognizes Claude CLI auto-retry banners", () => {
    expect(
      isAutoRetryNotice(
        "API Error (Request timed out.) · Retrying in 1 seconds… (attempt 1/10)",
      ),
    ).toBe(true);
    expect(isAutoRetryNotice("Retrying in 5 seconds (attempt 3 of 10)")).toBe(true);
  });

  it("returns false for terminal errors", () => {
    expect(isAutoRetryNotice("API Error (529 service_overloaded): Overloaded")).toBe(false);
    expect(isAutoRetryNotice("hello world")).toBe(false);
  });
});
