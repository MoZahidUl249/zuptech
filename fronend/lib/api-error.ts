/*
 * One error type for every backend call, built for debugging.
 *
 * The old helpers threw away almost everything useful: they collapsed the
 * response to a single string, so a failed request told you "Invalid request"
 * and nothing about WHICH field the server rejected. Elysia sends that
 * information — see the onError hook in backend/src/index.ts — but it arrives
 * as a JSON string nested inside `detail`, so nobody ever read it.
 *
 * The backend's error bodies, in the shapes it actually emits:
 *   ApiError thrown by a handler → { error: "<message>" }
 *   422 on /admin/*             → { error: "Invalid request", detail: "<json>" }
 *   400 on a public route        → { error: "<first validation summary>" }
 *   404                          → { error: "Not found" }
 *   500                          → { error: "Something went wrong" }
 * Better Auth answers with { message, code } instead, hence `code`.
 */

/** Elysia's validation payload, unwrapped from the `detail` string. */
export interface ValidationDetail {
  /** Which part of the request failed: "body", "query", "params". */
  on?: string;
  /** JSON-pointer-ish path to the offending field, e.g. "/sort". */
  property?: string;
  message?: string;
  summary?: string;
  expected?: unknown;
  /** What the server actually received — usually the fastest way to spot a
   *  missing required field or a misnamed key. */
  found?: unknown;
}

interface ErrorInit {
  status: number;
  method: string;
  path: string;
  /** Parsed response body, or the raw text when it wasn't JSON. */
  body: unknown;
}

function parseValidation(body: unknown): ValidationDetail | undefined {
  if (!body || typeof body !== "object") return undefined;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail !== "string") return undefined;
  try {
    const parsed = JSON.parse(detail) as ValidationDetail;
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    // `detail` wasn't JSON after all — not worth failing the error path over.
    return undefined;
  }
}

function messageFrom(body: unknown, fallback: string): { message: string; code?: string } {
  if (body && typeof body === "object") {
    const shaped = body as { error?: string; message?: string; code?: string };
    if (typeof shaped.error === "string" && shaped.error) {
      return { message: shaped.error, code: shaped.code };
    }
    if (typeof shaped.message === "string" && shaped.message) {
      return { message: shaped.message, code: shaped.code };
    }
  }
  if (typeof body === "string" && body.trim()) return { message: body };
  return { message: fallback };
}

/**
 * Base for both ApiError (storefront) and AdminApiError (admin panel). Keeps
 * `status` and `message` exactly as before so existing `catch` blocks and
 * `err.status === 409` checks are unaffected — everything else is additive.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  /** Better Auth's stable code, e.g. "INVALID_EMAIL_OR_PASSWORD". */
  readonly code?: string;
  readonly validation?: ValidationDetail;

  constructor(init: ErrorInit) {
    const fallback = `${init.method} ${init.path} → ${init.status}`;
    const { message, code } = messageFrom(init.body, fallback);
    super(message);
    this.name = "ApiRequestError";
    this.status = init.status;
    this.method = init.method;
    this.path = init.path;
    this.body = init.body;
    this.code = code;
    this.validation = parseValidation(init.body);
  }

  /** True when the server rejected the payload rather than the request failing
   *  for an operational reason — worth branching on in a form. */
  get isValidation(): boolean {
    return this.status === 422 || this.status === 400;
  }

  /**
   * Everything known about the failure, formatted to be read in a console or
   * pasted into a bug report. This is the part that turns "Invalid request"
   * into something actionable.
   */
  describe(): string {
    const lines = [`${this.method} ${this.path} → ${this.status}`, `  ${this.message}`];
    if (this.code) lines.push(`  code: ${this.code}`);
    const v = this.validation;
    if (v) {
      if (v.on) lines.push(`  failed on: ${v.on}`);
      if (v.property) lines.push(`  property: ${v.property}`);
      if (v.summary && v.summary !== this.message) lines.push(`  summary: ${v.summary}`);
      if (v.expected !== undefined) lines.push(`  expected: ${JSON.stringify(v.expected)}`);
      if (v.found !== undefined) lines.push(`  received: ${JSON.stringify(v.found)}`);
    } else if (this.body && typeof this.body === "object") {
      lines.push(`  body: ${JSON.stringify(this.body)}`);
    }
    return lines.join("\n");
  }
}

/**
 * Logs the full context once, at the point of failure, where the request is
 * still identifiable. Production keeps the console clean — the error itself
 * still carries everything, so a caller can surface what it wants.
 */
export function logApiFailure(error: ApiRequestError): void {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[api] ${error.describe()}`);
}

/** Builds the error from a raw Response — used where Eden isn't involved. */
export async function fromResponse(
  method: string,
  path: string,
  response: Response,
): Promise<ApiRequestError> {
  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    try {
      body = await response.text();
    } catch {
      body = null;
    }
  }
  return new ApiRequestError({ status: response.status, method, path, body });
}
