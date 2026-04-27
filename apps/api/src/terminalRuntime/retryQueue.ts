import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ApiFailure } from "./apiFailureDetector";

export type RetryConfig = {
  initialDelayMs: number;
  multiplier: number;
  maxDelayMs: number;
};

export type RetryEntryStatus = "pending_idle" | "scheduled" | "delivered" | "cancelled";

export type RetryEntry = {
  terminalId: string;
  status: RetryEntryStatus;
  attemptCount: number;
  firstFailureAt: number;
  lastFailureAt: number;
  lastFailure: ApiFailure;
  scheduledRetryAt?: number | undefined;
  lastAttemptAt?: number | undefined;
};

export type RetryQueueDeps = {
  stateFilePath: string;
  config: RetryConfig;
  clock: { now: () => number };
  scheduleTimer: (callback: () => void, delayMs: number) => number;
  cancelTimer: (id: number) => void;
  executeRetry: (terminalId: string) => boolean;
  onChange?: (terminalId: string, entry: RetryEntry | null) => void;
};

export type RetryQueue = {
  recordFailure: (terminalId: string, failure: ApiFailure) => void;
  markIdle: (terminalId: string) => void;
  clearOnSuccess: (terminalId: string) => void;
  cancelRetry: (terminalId: string) => boolean;
  triggerNow: (terminalId: string) => boolean;
  getEntry: (terminalId: string) => RetryEntry | null;
  listEntries: () => RetryEntry[];
  flushSync: () => void;
  close: () => void;
};

export const computeRetryDelayMs = (attemptCount: number, config: RetryConfig): number => {
  const exponent = Math.max(0, attemptCount);
  const raw = config.initialDelayMs * Math.pow(config.multiplier, exponent);
  if (!Number.isFinite(raw)) {
    return config.maxDelayMs;
  }
  return Math.min(config.maxDelayMs, Math.max(0, Math.floor(raw)));
};

const PERSIST_VERSION = 1;

type PersistedDocument = {
  version: number;
  entries: RetryEntry[];
};

const writeStateSync = (path: string, entries: RetryEntry[]) => {
  const document: PersistedDocument = { version: PERSIST_VERSION, entries };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
};

const readStateSync = (path: string): RetryEntry[] => {
  if (!existsSync(path)) {
    return [];
  }

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as PersistedDocument;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
      return [];
    }
    return parsed.entries.filter(
      (entry) => entry && typeof entry === "object" && typeof entry.terminalId === "string",
    );
  } catch {
    return [];
  }
};

export const createRetryQueue = (deps: RetryQueueDeps): RetryQueue => {
  const entries = new Map<string, RetryEntry>();
  const timers = new Map<string, number>();
  const idleTerminals = new Set<string>();

  const restoreScheduledTimer = (entry: RetryEntry) => {
    if (entry.status !== "scheduled" || typeof entry.scheduledRetryAt !== "number") {
      return;
    }
    idleTerminals.add(entry.terminalId);
    const delayMs = Math.max(0, entry.scheduledRetryAt - deps.clock.now());
    const timerId = deps.scheduleTimer(() => {
      timers.delete(entry.terminalId);
      runRetry(entry.terminalId);
    }, delayMs);
    timers.set(entry.terminalId, timerId);
  };

  for (const restored of readStateSync(deps.stateFilePath)) {
    if (restored.status === "delivered") {
      restored.status = "pending_idle";
      restored.scheduledRetryAt = undefined;
    }
    entries.set(restored.terminalId, restored);
    restoreScheduledTimer(restored);
  }

  const persistSoon = (() => {
    let scheduled = false;
    return () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      // Defer to microtask so successive operations coalesce.
      Promise.resolve().then(() => {
        scheduled = false;
        try {
          writeStateSync(deps.stateFilePath, [...entries.values()]);
        } catch {
          // Persistence failures should not crash the runtime.
        }
      });
    };
  })();

  const flushSync = () => {
    try {
      writeStateSync(deps.stateFilePath, [...entries.values()]);
    } catch {
      // Best-effort.
    }
  };

  const notify = (terminalId: string, entry: RetryEntry | null) => {
    deps.onChange?.(terminalId, entry);
  };

  const cancelTimer = (terminalId: string) => {
    const timerId = timers.get(terminalId);
    if (timerId === undefined) {
      return;
    }
    deps.cancelTimer(timerId);
    timers.delete(terminalId);
  };

  const schedule = (entry: RetryEntry) => {
    cancelTimer(entry.terminalId);

    const delayMs = computeRetryDelayMs(entry.attemptCount, deps.config);
    const fireAt = deps.clock.now() + delayMs;
    entry.status = "scheduled";
    entry.scheduledRetryAt = fireAt;

    const timerId = deps.scheduleTimer(() => {
      timers.delete(entry.terminalId);
      runRetry(entry.terminalId);
    }, delayMs);

    timers.set(entry.terminalId, timerId);
    persistSoon();
    notify(entry.terminalId, entry);
  };

  const runRetry = (terminalId: string) => {
    const entry = entries.get(terminalId);
    if (!entry) {
      return;
    }

    entry.scheduledRetryAt = undefined;
    entry.lastAttemptAt = deps.clock.now();

    let succeeded = false;
    try {
      succeeded = deps.executeRetry(terminalId) === true;
    } catch {
      succeeded = false;
    }

    entry.attemptCount += 1;

    if (succeeded) {
      entry.status = "delivered";
      idleTerminals.delete(terminalId);
      persistSoon();
      notify(terminalId, entry);
      return;
    }

    // Could not write to PTY (closed, etc.); back off another step.
    schedule(entry);
  };

  const planScheduling = (terminalId: string) => {
    const entry = entries.get(terminalId);
    if (!entry) {
      return;
    }
    if (entry.status === "cancelled") {
      return;
    }
    if (!idleTerminals.has(terminalId)) {
      entry.status = "pending_idle";
      entry.scheduledRetryAt = undefined;
      cancelTimer(terminalId);
      notify(terminalId, entry);
      return;
    }

    schedule(entry);
  };

  const recordFailure = (terminalId: string, failure: ApiFailure) => {
    const now = deps.clock.now();
    const existing = entries.get(terminalId);
    if (existing) {
      existing.lastFailure = failure;
      existing.lastFailureAt = now;
      // Re-arm: a fresh failure resets cancelled-by-operator state.
      if (existing.status === "cancelled") {
        existing.status = "pending_idle";
      }
      planScheduling(terminalId);
      return;
    }

    const entry: RetryEntry = {
      terminalId,
      status: "pending_idle",
      attemptCount: 0,
      firstFailureAt: now,
      lastFailureAt: now,
      lastFailure: failure,
    };
    entries.set(terminalId, entry);
    planScheduling(terminalId);
  };

  const markIdle = (terminalId: string) => {
    idleTerminals.add(terminalId);
    if (entries.has(terminalId)) {
      planScheduling(terminalId);
    }
  };

  const clearOnSuccess = (terminalId: string) => {
    cancelTimer(terminalId);
    idleTerminals.delete(terminalId);
    if (!entries.has(terminalId)) {
      return;
    }
    entries.delete(terminalId);
    persistSoon();
    notify(terminalId, null);
  };

  const cancelRetry = (terminalId: string): boolean => {
    const entry = entries.get(terminalId);
    if (!entry) {
      return false;
    }
    cancelTimer(terminalId);
    entry.status = "cancelled";
    entry.scheduledRetryAt = undefined;
    persistSoon();
    notify(terminalId, entry);
    return true;
  };

  const triggerNow = (terminalId: string): boolean => {
    const entry = entries.get(terminalId);
    if (!entry) {
      return false;
    }
    cancelTimer(terminalId);
    runRetry(terminalId);
    return true;
  };

  const getEntry = (terminalId: string): RetryEntry | null => entries.get(terminalId) ?? null;

  const listEntries = (): RetryEntry[] => [...entries.values()];

  const close = () => {
    for (const timerId of timers.values()) {
      deps.cancelTimer(timerId);
    }
    timers.clear();
    flushSync();
  };

  return {
    recordFailure,
    markIdle,
    clearOnSuccess,
    cancelRetry,
    triggerNow,
    getEntry,
    listEntries,
    flushSync,
    close,
  };
};
