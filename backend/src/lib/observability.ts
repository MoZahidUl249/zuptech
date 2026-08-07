/**
 * Where a crash goes.
 *
 * Before this, an uncaught 500 produced `console.error("[unhandled]", error)`
 * and nothing else: no request path, no method, no way to correlate the stack
 * with the user who hit it, and no way for anyone to find out it happened
 * except by reading container logs at the right moment. Checkout could have
 * been failing for a day.
 *
 * Two things happen here. Every failure gets a short request id that is also
 * returned to the caller, so a customer saying "it said something went wrong"
 * can be matched to an exact stack trace. And if `ERROR_WEBHOOK_URL` is set,
 * the report is POSTed there — that is the seam for Sentry, a Slack incoming
 * webhook, or anything else, without this file needing to know which.
 */

const ERROR_WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL;

/** Short, unguessable, and easy to read back over a phone. */
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface ErrorReport {
  requestId: string;
  method: string;
  path: string;
  message: string;
  stack?: string;
  /** Staff username or customer phone when the request was authenticated. */
  actor?: string;
}

/**
 * Record a server fault.
 *
 * Always logs. Posts to the webhook only when one is configured, and never
 * lets a failing webhook turn one error into two — the whole point is to be
 * the thing that still works when other things don't.
 */
export function reportError(report: ErrorReport): void {
  // One line, structured, so a log search can filter on it. JSON rather than
  // prose because the access log above it is already human-readable and this
  // is the half a machine needs to parse.
  console.error(
    JSON.stringify({ level: "error", at: new Date().toISOString(), ...report }),
  );

  if (!ERROR_WEBHOOK_URL) return;
  void fetch(ERROR_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  }).catch(() => {
    // Deliberately silent: a dead webhook must not become a second error, and
    // the console line above has already preserved the report.
  });
}
