import { describe, expect, test } from "bun:test";
import { ApiRequestError } from "./api-error";

/*
 * The bodies below are copied verbatim from the running backend, not invented
 * — see the onError hook in backend/src/index.ts for the shapes it emits.
 */

/** A real 422 from POST /admin/api/sections with `sort` omitted. */
const VALIDATION_BODY = {
  error: "Invalid request",
  detail: JSON.stringify({
    type: "validation",
    on: "body",
    property: "/sort",
    message: "Expected required property",
    summary: "Property 'sort' is missing",
    expected: { name: " ", sort: 0 },
    found: { name: "missing sort" },
  }),
};

describe("ApiRequestError", () => {
  test("keeps the status and message contract callers already branch on", () => {
    const err = new ApiRequestError({
      status: 409,
      method: "DELETE",
      path: "/admin/api/categories/abc",
      body: { error: "This category still has products" },
    });
    expect(err.status).toBe(409);
    expect(err.message).toBe("This category still has products");
    expect(err instanceof Error).toBe(true);
  });

  test("falls back to method/path/status when the body carries no message", () => {
    const err = new ApiRequestError({ status: 500, method: "GET", path: "/api/products", body: null });
    expect(err.message).toBe("GET /api/products → 500");
  });

  test("reads Better Auth's {message, code} shape as well as our {error}", () => {
    const err = new ApiRequestError({
      status: 401,
      method: "POST",
      path: "/api/auth/login",
      body: { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" },
    });
    expect(err.message).toBe("Invalid email or password");
    expect(err.code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  /**
   * The point of the whole module: the server says exactly which property was
   * wrong, but buries it in a JSON string inside `detail`, so every validation
   * failure used to surface as the useless words "Invalid request".
   */
  test("unwraps the validation detail the server buries in `detail`", () => {
    const err = new ApiRequestError({
      status: 422,
      method: "POST",
      path: "/admin/api/sections",
      body: VALIDATION_BODY,
    });
    expect(err.isValidation).toBe(true);
    expect(err.validation?.property).toBe("/sort");
    expect(err.validation?.summary).toBe("Property 'sort' is missing");
    expect(err.validation?.found).toEqual({ name: "missing sort" });
  });

  test("describe() names the offending property and what was actually sent", () => {
    const text = new ApiRequestError({
      status: 422,
      method: "POST",
      path: "/admin/api/sections",
      body: VALIDATION_BODY,
    }).describe();

    expect(text).toContain("POST /admin/api/sections → 422");
    expect(text).toContain("property: /sort");
    expect(text).toContain("Property 'sort' is missing");
    // The received payload is what makes a missing/misnamed field obvious.
    expect(text).toContain('"name":"missing sort"');
  });

  test("a non-JSON or malformed detail degrades instead of throwing", () => {
    const err = new ApiRequestError({
      status: 422,
      method: "POST",
      path: "/admin/api/sections",
      body: { error: "Invalid request", detail: "not json at all" },
    });
    expect(err.validation).toBeUndefined();
    expect(err.message).toBe("Invalid request");
    expect(() => err.describe()).not.toThrow();
  });

  test("a plain-text body still yields a usable message", () => {
    const err = new ApiRequestError({
      status: 502,
      method: "GET",
      path: "/api/products",
      body: "upstream unavailable",
    });
    expect(err.message).toBe("upstream unavailable");
  });

  test("isValidation is false for operational failures", () => {
    const err = new ApiRequestError({ status: 403, method: "GET", path: "/admin/api/staff", body: null });
    expect(err.isValidation).toBe(false);
  });
});
