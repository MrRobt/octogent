export type ApiFailureKind =
  | "rate_limit"
  | "server_overloaded"
  | "server_error"
  | "network_error";

export type ApiFailure = {
  kind: ApiFailureKind;
  statusCode?: number;
  message: string;
};

const ANSI_PATTERN = /\[[0-9;?]*[ -/]*[@-~]/g;

const stripAnsi = (input: string): string => input.replace(ANSI_PATTERN, "");

const AUTO_RETRY_PATTERN = /retrying in [^.\n]*?(?:attempt|of)\s+\d+/i;

export const isAutoRetryNotice = (chunk: string): boolean => {
  if (!chunk) {
    return false;
  }
  return AUTO_RETRY_PATTERN.test(stripAnsi(chunk));
};

const STATUS_KIND_TABLE: Array<{ statusCode: number; kind: ApiFailureKind }> = [
  { statusCode: 429, kind: "rate_limit" },
  { statusCode: 529, kind: "server_overloaded" },
  { statusCode: 503, kind: "server_error" },
  { statusCode: 502, kind: "server_error" },
  { statusCode: 500, kind: "server_error" },
  { statusCode: 504, kind: "server_error" },
];

const findStatusCodeFailure = (text: string): ApiFailure | null => {
  const match = text.match(/api error[\s:(]+(\d{3})/i);
  if (!match) {
    return null;
  }

  const statusCode = Number(match[1]);
  const entry = STATUS_KIND_TABLE.find((row) => row.statusCode === statusCode);
  if (!entry) {
    if (statusCode >= 500 && statusCode < 600) {
      return {
        kind: "server_error",
        statusCode,
        message: extractContextLine(text, match.index ?? 0),
      };
    }
    return null;
  }

  return {
    kind: entry.kind,
    statusCode,
    message: extractContextLine(text, match.index ?? 0),
  };
};

const extractContextLine = (text: string, anchor: number): string => {
  const start = text.lastIndexOf("\n", anchor) + 1;
  const endNewline = text.indexOf("\n", anchor);
  const end = endNewline === -1 ? text.length : endNewline;
  return text.slice(start, end).trim().slice(0, 240);
};

const KEYWORD_RULES: Array<{ pattern: RegExp; kind: ApiFailureKind }> = [
  { pattern: /overloaded/i, kind: "server_overloaded" },
  { pattern: /rate.?limit/i, kind: "rate_limit" },
  { pattern: /fetch failed/i, kind: "network_error" },
  { pattern: /econn(reset|refused|aborted)/i, kind: "network_error" },
  { pattern: /enotfound/i, kind: "network_error" },
  { pattern: /etimedout/i, kind: "network_error" },
  { pattern: /(connection|socket|network) (refused|reset|closed|timed?\s*out)/i, kind: "network_error" },
  { pattern: /request timed out/i, kind: "network_error" },
  { pattern: /service unavailable/i, kind: "server_error" },
  { pattern: /bad gateway/i, kind: "server_error" },
  { pattern: /internal server error/i, kind: "server_error" },
];

export const detectApiFailure = (chunk: string): ApiFailure | null => {
  if (!chunk) {
    return null;
  }

  const stripped = stripAnsi(chunk);

  // Skip auto-retry notices — Claude CLI is still attempting on its own.
  if (isAutoRetryNotice(stripped)) {
    return null;
  }

  const statusCodeMatch = findStatusCodeFailure(stripped);
  if (statusCodeMatch) {
    return statusCodeMatch;
  }

  for (const rule of KEYWORD_RULES) {
    const match = stripped.match(rule.pattern);
    if (match) {
      return {
        kind: rule.kind,
        message: extractContextLine(stripped, match.index ?? 0),
      };
    }
  }

  return null;
};
