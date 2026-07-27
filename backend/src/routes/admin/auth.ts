import { Elysia } from "elysia";
import { staffLoginDto } from "../../dtos/auth.dto";
import { auth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { allowHit } from "../../lib/rate-limit";
import { getStaffContext } from "../../lib/rbac";

/**
 * Staff authentication. Login/logout wrap Better Auth's username plugin so
 * the panel talks to the paths from BACKEND.md; sessions ride httpOnly
 * cookies set by Better Auth itself (the wrappers just forward the Response).
 */
export const adminAuth = new Elysia({ name: "routes/admin/auth", detail: { tags: ["Admin · Auth"] } })
  .post(
    "/admin/api/login",
    async ({ body, request, server }) => {
      const ip = server?.requestIP(request)?.address ?? "unknown";
      if (
        !allowHit(`login:${body.username}`, 5, 5 * 60_000) ||
        !allowHit(`login-ip:${ip}`, 20, 5 * 60_000)
      ) {
        throw new ApiError(429, "Too many login attempts — try again in a few minutes");
      }

      // asResponse keeps Better Auth's Set-Cookie header intact.
      return auth.api.signInUsername({
        body: { username: body.username.trim().toLowerCase(), password: body.password },
        headers: request.headers,
        asResponse: true,
      });
    },
    { body: staffLoginDto },
  )

  .post("/admin/api/logout", async ({ request }) =>
    auth.api.signOut({ headers: request.headers, asResponse: true }),
  )

  /** The signed-in staff member + their effective permission matrix. */
  .get("/admin/api/me", async ({ request }) => {
    const ctx = await getStaffContext(request.headers);
    if (!ctx) throw new ApiError(401, "Staff sign-in required");
    return ctx;
  });
