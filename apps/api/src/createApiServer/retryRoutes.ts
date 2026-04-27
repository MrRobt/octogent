import type { ApiRouteHandler } from "./routeHelpers";
import { writeJson, writeMethodNotAllowed } from "./routeHelpers";

const TERMINAL_RETRY_PATH_PATTERN = /^\/api\/terminals\/([^/]+)\/retry(?:\/(cancel|now))?$/;

export const handleRetriesCollectionRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime },
) => {
  if (requestUrl.pathname !== "/api/retries") {
    return false;
  }

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  writeJson(response, 200, { entries: runtime.listRetryEntries() }, corsOrigin);
  return true;
};

export const handleTerminalRetryRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime },
) => {
  const match = requestUrl.pathname.match(TERMINAL_RETRY_PATH_PATTERN);
  if (!match) {
    return false;
  }

  const terminalId = decodeURIComponent(match[1] ?? "");
  const action = match[2] ?? null;

  if (action === null) {
    if (request.method !== "GET") {
      writeMethodNotAllowed(response, corsOrigin);
      return true;
    }

    const entry = runtime.getRetryEntry(terminalId);
    if (!entry) {
      writeJson(response, 404, { error: "No retry entry for this terminal." }, corsOrigin);
      return true;
    }

    writeJson(response, 200, entry, corsOrigin);
    return true;
  }

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const succeeded =
    action === "cancel" ? runtime.cancelRetry(terminalId) : runtime.triggerRetryNow(terminalId);

  if (!succeeded) {
    writeJson(response, 404, { error: "No retry entry for this terminal." }, corsOrigin);
    return true;
  }

  const entry = runtime.getRetryEntry(terminalId);
  writeJson(response, 200, entry, corsOrigin);
  return true;
};
