import { treaty } from "@elysiajs/eden";
import type { App } from "../../backend/src/index";

/*
 * End-to-end typed client for the backend.
 *
 * `App` is a TYPE-ONLY import — it is erased at compile time, so none of the
 * backend's runtime (Elysia, Prisma, Better Auth) is pulled into the browser
 * bundle. What it buys is that routes, params and response shapes are checked
 * against the server's actual definitions: a renamed route or a changed DTO
 * becomes a compile error here instead of a 404/422 discovered by hand.
 *
 * It does mean the frontend cannot typecheck without the backend sources AND a
 * generated Prisma client (backend/src/generated, gitignored) — CI runs
 * `prisma generate` before typechecking, and fronend/Dockerfile does the same
 * before `next build`.
 */

function origin(): string {
  // Browser: same-origin, so next.config.ts's rewrites proxy the call and the
  // Better Auth session cookie stays first-party. Identical reasoning to
  // base() in lib/api.ts and the note at the top of lib/admin-http.ts.
  if (typeof window !== "undefined") return window.location.origin;
  // Server (RSC, metadata, sitemap): straight at the backend, no proxy.
  return process.env.BACKEND_URL ?? "http://localhost:3000";
}

export const api = treaty<App>(origin());

/**
 * What Eden hands back in the `error` slot.
 *
 * `status` is deliberately `unknown`: Eden derives the error union from a
 * route's DECLARED responses, but most of this backend's failures are thrown
 * (`throw notFound(...)`) and mapped to a status by the global onError hook in
 * backend/src/index.ts. Those never make it into the type, so the declared
 * union is narrower than what actually comes back — comparing against it
 * directly makes TypeScript reject real status codes as impossible. Read it
 * through `failureStatus` instead.
 *
 * Declaring `response` schemas on the backend routes would close this gap and
 * make error handling type-checked too.
 */
export interface EdenFailure {
  status: unknown;
  value: unknown;
}

/** The HTTP status as a number; 0 if Eden couldn't determine one. */
export function failureStatus(failure: EdenFailure): number {
  return typeof failure.status === "number" ? failure.status : 0;
}

/**
 * Pulls a readable message out of an error body. Our own routes send
 * `{error}`; Better Auth sends `{message, code}` — the same two shapes
 * lib/api.ts and lib/admin-http.ts already special-case.
 */
export function edenErrorMessage(failure: EdenFailure, fallback: string): {
  message: string;
  code?: string;
} {
  const value = failure.value;
  if (value && typeof value === "object") {
    const body = value as { error?: string; message?: string; code?: string };
    if (typeof body.error === "string") return { message: body.error, code: body.code };
    if (typeof body.message === "string") return { message: body.message, code: body.code };
  }
  if (typeof value === "string" && value) return { message: value };
  return { message: fallback };
}
