"use client";

/*
 * The one HTTP helper every admin client uses.
 *
 * This exact function had been copy-pasted into admin-api.ts,
 * admin-invoices.ts, admin-warranty.ts and admin-landing-pages.ts, so a fix to
 * error handling in one left the other three behind. It lives here now.
 *
 * All calls are same-origin relative paths — next.config.ts proxies /admin/api
 * to the backend, which keeps the Better Auth staff session cookie first-party.
 * There is no token to attach; if you find yourself adding an Authorization
 * header, something has gone wrong.
 */

/** Carries the HTTP status so callers can tell 403 (no permission) from 409
 *  (server refused, e.g. deleting a category that still has products) from a
 *  genuine failure. The old helper threw a bare Error and lost that. */
export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `${method} ${path} → ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new AdminApiError(message, res.status);
  }
  return res.json();
}

export const get = <T,>(path: string) => req<T>("GET", path);

/** Multipart upload (product photos/video, hero images). The browser sets the
 *  multipart boundary itself, so never set Content-Type here. */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) {
    let message = `POST ${path} → ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep status message
    }
    throw new AdminApiError(message, res.status);
  }
  return res.json();
}
