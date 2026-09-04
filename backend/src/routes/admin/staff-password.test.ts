import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Setting a staff password, and the self-service reset that no longer exists.
 *
 * The guard worth testing hardest is the Super Admin one. Without it,
 * `staff: manage` is a one-step takeover of the whole permission matrix: set
 * the owner's password, sign in as them, hold everything. Manager and Support
 * both have `staff` in reach on a normal shop.
 */

let staffRow: {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string | null;
  role: { id: string; name: string; isSystem: boolean; permissions: Record<string, string> };
} | null = null;

/** The staff member being acted ON. */
let target: { id: string; userId: string; role: { isSystem: boolean } } | null = null;
/** Every password write that reached Better Auth. */
let written: { userId: string; hash: string }[] = [];

mock.module("../../lib/db", () => ({
  prisma: {
    $queryRaw: async () => [{ "?column?": 1 }],
    staff: {
      /* The guard looks the CALLER up by userId (rbac.ts getStaffContext);
         every other lookup here is by id and means the target. Keying on
         which field is present is what keeps the two apart. */
      findUnique: async ({ where }: { where: { id?: string; userId?: string } }) =>
        where.userId !== undefined ? staffRow : target,
    },
    courier: { findMany: async () => [] },
  },
}));

mock.module("../../lib/auth", () => ({
  auth: {
    api: { getSession: async () => ({ user: { id: "u1" } }) },
    $context: Promise.resolve({
      password: { hash: async (p: string) => `hashed:${p}` },
      internalAdapter: {
        updatePassword: async (userId: string, hash: string) => {
          written.push({ userId, hash });
        },
      },
    }),
  },
}));

const { createApp } = await import("../../app");
const app = createApp({ quiet: true });

async function call(method: string, path: string, body?: unknown) {
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    }),
  );
  return { status: res.status, body: (await res.json().catch(() => null)) as { error?: string } };
}

/** The signed-in caller. The staff member being acted on is `target`. */
function signInAs(permissions: Record<string, string>, { isSystem = false } = {}) {
  staffRow = {
    id: "s1",
    name: "Test Staff",
    username: "test",
    phone: "01700000000",
    email: null,
    role: { id: "r1", name: "Tester", isSystem, permissions },
  };
}

beforeEach(() => {
  written = [];
  target = { id: "target", userId: "user-target", role: { isSystem: false } };
  signInAs({ staffpassword: "manage" });
});

describe("staff self-service reset is gone", () => {
  test("the endpoints that mailed a code no longer exist", async () => {
    // A staff password is a session away from everything that role can do, and
    // the reset was only ever as strong as the mailbox behind it.
    expect((await call("POST", "/admin/api/forgot-password", { email: "a@b.com" })).status).toBe(
      404,
    );
    expect(
      (await call("POST", "/admin/api/reset-password", { email: "a@b.com", otp: "123456", password: "newpass1" }))
        .status,
    ).toBe(404);
  });
});

describe("a manager sets a staff password", () => {
  test("it is hashed by Better Auth and written to that user", async () => {
    const { status } = await call("POST", "/admin/api/staff/target/password", {
      password: "a-good-password",
    });

    expect(status).toBe(200);
    expect(written).toEqual([{ userId: "user-target", hash: "hashed:a-good-password" }]);
  });

  test("the response never echoes the password", async () => {
    const { body } = await call("POST", "/admin/api/staff/target/password", {
      password: "a-good-password",
    });

    expect(JSON.stringify(body)).not.toContain("a-good-password");
  });

  test("a role without staffpassword is refused", async () => {
    // Managing staff outright is still not the same grant as this one.
    signInAs({ orders: "manage", staff: "manage" });

    const { status } = await call("POST", "/admin/api/staff/target/password", {
      password: "a-good-password",
    });

    expect(status).toBe(403);
    expect(written).toEqual([]);
  });

  test("view-only is not enough", async () => {
    signInAs({ staffpassword: "view" });

    expect(
      (await call("POST", "/admin/api/staff/target/password", { password: "a-good-password" }))
        .status,
    ).toBe(403);
    expect(written).toEqual([]);
  });

  /*
   * The one that matters. Without this guard, the password permission is a
   * complete bypass of every other one: set the Super Admin's password, sign
   * in as them, and the matrix means nothing.
   */
  test("a non-Super-Admin cannot set a Super Admin's password", async () => {
    target = { id: "target", userId: "user-boss", role: { isSystem: true } };
    signInAs({ staffpassword: "manage" }, { isSystem: false });

    const { status, body } = await call("POST", "/admin/api/staff/target/password", {
      password: "a-good-password",
    });

    expect(status).toBe(403);
    expect(body.error).toContain("Super Admin");
    expect(written).toEqual([]);
  });

  test("a Super Admin can", async () => {
    target = { id: "target", userId: "user-boss", role: { isSystem: true } };
    signInAs({ staffpassword: "manage" }, { isSystem: true });

    expect(
      (await call("POST", "/admin/api/staff/target/password", { password: "a-good-password" }))
        .status,
    ).toBe(200);
    expect(written).toHaveLength(1);
  });

  test("a short password is refused by the schema, before any write", async () => {
    const { status } = await call("POST", "/admin/api/staff/target/password", {
      password: "abc",
    });

    expect(status).toBe(422);
    expect(written).toEqual([]);
  });

  test("an unknown staff member is a 404", async () => {
    target = null;

    expect(
      (await call("POST", "/admin/api/staff/missing/password", { password: "a-good-password" }))
        .status,
    ).toBe(404);
  });
});
