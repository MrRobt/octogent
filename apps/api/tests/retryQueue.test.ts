import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RetryQueue,
  type RetryQueueDeps,
  computeRetryDelayMs,
  createRetryQueue,
} from "../src/terminalRuntime/retryQueue";

type ScheduledTimer = {
  id: number;
  fireAt: number;
  callback: () => void;
};

class FakeClock {
  now = 0;
  private nextId = 1;
  timers: ScheduledTimer[] = [];

  schedule = (callback: () => void, delayMs: number): number => {
    const timer: ScheduledTimer = {
      id: this.nextId++,
      fireAt: this.now + delayMs,
      callback,
    };
    this.timers.push(timer);
    return timer.id;
  };

  cancel = (id: number) => {
    this.timers = this.timers.filter((timer) => timer.id !== id);
  };

  advanceTo(targetMs: number) {
    while (true) {
      const due = this.timers
        .filter((timer) => timer.fireAt <= targetMs)
        .sort((a, b) => a.fireAt - b.fireAt)[0];
      if (!due) {
        break;
      }
      this.timers = this.timers.filter((timer) => timer.id !== due.id);
      this.now = due.fireAt;
      due.callback();
    }
    this.now = targetMs;
  }
}

describe("computeRetryDelayMs", () => {
  it("uses initial delay for the first retry", () => {
    expect(computeRetryDelayMs(0, { initialDelayMs: 1000, multiplier: 2, maxDelayMs: 30_000 })).toBe(
      1000,
    );
  });

  it("doubles each subsequent attempt", () => {
    const config = { initialDelayMs: 1000, multiplier: 2, maxDelayMs: 30_000 };
    expect(computeRetryDelayMs(1, config)).toBe(2000);
    expect(computeRetryDelayMs(2, config)).toBe(4000);
    expect(computeRetryDelayMs(3, config)).toBe(8000);
  });

  it("caps at maxDelayMs", () => {
    const config = { initialDelayMs: 1000, multiplier: 2, maxDelayMs: 5000 };
    expect(computeRetryDelayMs(10, config)).toBe(5000);
  });
});

describe("retryQueue", () => {
  let tmpDir: string;
  let stateFilePath: string;
  let clock: FakeClock;
  let executeRetry: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;
  let queue: RetryQueue;

  const buildDeps = (): RetryQueueDeps => ({
    stateFilePath,
    config: { initialDelayMs: 1000, multiplier: 2, maxDelayMs: 60_000 },
    clock: { now: () => clock.now },
    scheduleTimer: clock.schedule,
    cancelTimer: clock.cancel,
    executeRetry,
    onChange,
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "octogent-retry-"));
    stateFilePath = join(tmpDir, "retry-queue.json");
    clock = new FakeClock();
    executeRetry = vi.fn().mockReturnValue(true);
    onChange = vi.fn();
    queue = createRetryQueue(buildDeps());
  });

  afterEach(() => {
    queue.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("schedules a retry on first failure with the initial delay", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "Overloaded" });
    queue.markIdle("term-1");

    const entry = queue.getEntry("term-1");
    expect(entry).not.toBeNull();
    expect(entry?.attemptCount).toBe(0);
    expect(entry?.scheduledRetryAt).toBe(clock.now + 1000);
    expect(executeRetry).not.toHaveBeenCalled();
  });

  it("invokes executeRetry when the timer fires", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "Overloaded" });
    queue.markIdle("term-1");

    clock.advanceTo(1000);
    expect(executeRetry).toHaveBeenCalledTimes(1);
    expect(executeRetry).toHaveBeenCalledWith("term-1");

    const entry = queue.getEntry("term-1");
    expect(entry?.attemptCount).toBe(1);
    expect(entry?.scheduledRetryAt).toBeUndefined();
  });

  it("does not schedule until the session reports idle", () => {
    queue.recordFailure("term-1", { kind: "server_error", message: "503" });
    expect(queue.getEntry("term-1")?.scheduledRetryAt).toBeUndefined();

    queue.markIdle("term-1");
    expect(queue.getEntry("term-1")?.scheduledRetryAt).toBe(clock.now + 1000);
  });

  it("uses exponential backoff after repeated failures", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");
    clock.advanceTo(1000);

    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");
    expect(queue.getEntry("term-1")?.scheduledRetryAt).toBe(1000 + 2000);

    clock.advanceTo(1000 + 2000);
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");
    expect(queue.getEntry("term-1")?.scheduledRetryAt).toBe(1000 + 2000 + 4000);
  });

  it("clearOnSuccess removes the entry and cancels the timer", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");

    queue.clearOnSuccess("term-1");
    expect(queue.getEntry("term-1")).toBeNull();

    clock.advanceTo(5000);
    expect(executeRetry).not.toHaveBeenCalled();
  });

  it("cancelRetry leaves no scheduled timer but keeps history", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");

    queue.cancelRetry("term-1");
    const entry = queue.getEntry("term-1");
    expect(entry).not.toBeNull();
    expect(entry?.status).toBe("cancelled");
    expect(entry?.scheduledRetryAt).toBeUndefined();

    clock.advanceTo(5000);
    expect(executeRetry).not.toHaveBeenCalled();
  });

  it("triggerNow runs the retry immediately", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");

    queue.triggerNow("term-1");
    expect(executeRetry).toHaveBeenCalledTimes(1);

    const entry = queue.getEntry("term-1");
    expect(entry?.attemptCount).toBe(1);
    expect(entry?.scheduledRetryAt).toBeUndefined();
  });

  it("isolates retries per terminal", () => {
    queue.recordFailure("term-a", { kind: "server_overloaded", message: "" });
    queue.recordFailure("term-b", { kind: "rate_limit", message: "" });
    queue.markIdle("term-a");
    queue.markIdle("term-b");

    queue.cancelRetry("term-a");

    clock.advanceTo(1000);
    expect(executeRetry).toHaveBeenCalledTimes(1);
    expect(executeRetry).toHaveBeenCalledWith("term-b");
  });

  it("persists state to disk and restores it", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "Overloaded" });
    queue.markIdle("term-1");
    clock.advanceTo(1000);
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "Overloaded again" });
    queue.markIdle("term-1");

    queue.flushSync();
    expect(readFileSync(stateFilePath, "utf8")).toContain("term-1");

    const newClock = new FakeClock();
    newClock.now = clock.now;
    const replacementExecute = vi.fn().mockReturnValue(true);
    const replacement = createRetryQueue({
      stateFilePath,
      config: { initialDelayMs: 1000, multiplier: 2, maxDelayMs: 60_000 },
      clock: { now: () => newClock.now },
      scheduleTimer: newClock.schedule,
      cancelTimer: newClock.cancel,
      executeRetry: replacementExecute,
      onChange: vi.fn(),
    });

    const restored = replacement.getEntry("term-1");
    expect(restored).not.toBeNull();
    expect(restored?.attemptCount).toBe(1);

    newClock.advanceTo((restored?.scheduledRetryAt ?? 0) + 1);
    expect(replacementExecute).toHaveBeenCalledWith("term-1");
    replacement.close();
  });

  it("notifies onChange whenever an entry changes", () => {
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");
    expect(onChange).toHaveBeenCalledWith(
      "term-1",
      expect.objectContaining({ status: "scheduled" }),
    );

    onChange.mockClear();
    queue.cancelRetry("term-1");
    expect(onChange).toHaveBeenCalledWith(
      "term-1",
      expect.objectContaining({ status: "cancelled" }),
    );

    onChange.mockClear();
    queue.clearOnSuccess("term-1");
    expect(onChange).toHaveBeenCalledWith("term-1", null);
  });

  it("re-schedules when executeRetry refuses (session not ready)", () => {
    executeRetry.mockReturnValueOnce(false);
    queue.recordFailure("term-1", { kind: "server_overloaded", message: "" });
    queue.markIdle("term-1");

    clock.advanceTo(1000);
    const entry = queue.getEntry("term-1");
    expect(entry?.scheduledRetryAt).toBe(1000 + 2000);
    expect(entry?.attemptCount).toBe(1);
  });
});
