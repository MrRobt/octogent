import { useEffect, useState } from "react";

import { RotateCw, X } from "lucide-react";
import { buildTerminalRetryActionUrl } from "../runtime/runtimeEndpoints";

export type TerminalRetryEntry = {
  terminalId: string;
  status: "pending_idle" | "scheduled" | "delivered" | "cancelled";
  attemptCount: number;
  firstFailureAt: number;
  lastFailureAt: number;
  lastFailure: {
    kind: "rate_limit" | "server_overloaded" | "server_error" | "network_error";
    statusCode?: number;
    message: string;
  };
  scheduledRetryAt?: number;
  lastAttemptAt?: number;
};

const formatCountdown = (totalSeconds: number): string => {
  if (totalSeconds <= 0) {
    return "0s";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
};

const failureKindLabel = (kind: TerminalRetryEntry["lastFailure"]["kind"]): string => {
  switch (kind) {
    case "rate_limit":
      return "Rate limit";
    case "server_overloaded":
      return "Overloaded";
    case "server_error":
      return "Server error";
    case "network_error":
      return "Network error";
  }
};

type Props = {
  terminalId: string;
  entry: TerminalRetryEntry;
};

export const TerminalRetryIndicator = ({ terminalId, entry }: Props) => {
  const [now, setNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState<"cancel" | "now" | null>(null);

  useEffect(() => {
    if (entry.status !== "scheduled" || !entry.scheduledRetryAt) {
      return;
    }
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [entry.status, entry.scheduledRetryAt]);

  const callRetryAction = async (action: "cancel" | "now") => {
    if (pendingAction) {
      return;
    }
    setPendingAction(action);
    try {
      await fetch(buildTerminalRetryActionUrl(terminalId, action), { method: "POST" });
    } catch {
      // Best-effort — server will broadcast updates via the websocket.
    } finally {
      setPendingAction(null);
    }
  };

  if (entry.status === "cancelled" || entry.status === "delivered") {
    return null;
  }

  const remainingSeconds =
    entry.status === "scheduled" && entry.scheduledRetryAt
      ? Math.max(0, Math.ceil((entry.scheduledRetryAt - now) / 1000))
      : null;

  const label =
    entry.status === "pending_idle"
      ? `${failureKindLabel(entry.lastFailure.kind)} · waiting for idle`
      : remainingSeconds !== null
        ? `${failureKindLabel(entry.lastFailure.kind)} · retry in ${formatCountdown(remainingSeconds)}`
        : `${failureKindLabel(entry.lastFailure.kind)} · retry pending`;

  const titleParts = [
    `Last error: ${entry.lastFailure.message || failureKindLabel(entry.lastFailure.kind)}`,
    `Attempts: ${entry.attemptCount}`,
  ];
  if (entry.lastFailure.statusCode) {
    titleParts.unshift(`HTTP ${entry.lastFailure.statusCode}`);
  }

  return (
    <div className="terminal-retry-indicator" title={titleParts.join("\n")}>
      <span className="terminal-retry-indicator-label">{label}</span>
      <button
        type="button"
        className="terminal-retry-indicator-btn"
        onClick={() => {
          void callRetryAction("now");
        }}
        disabled={pendingAction !== null}
        aria-label="Retry now"
        title="Retry now"
      >
        <RotateCw size={12} />
      </button>
      <button
        type="button"
        className="terminal-retry-indicator-btn"
        onClick={() => {
          void callRetryAction("cancel");
        }}
        disabled={pendingAction !== null}
        aria-label="Cancel retry"
        title="Cancel retry"
      >
        <X size={12} />
      </button>
    </div>
  );
};
