"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAdmin,
  ADMIN_MODULES,
  type AdminModule,
  type Permission,
  type Role,
  tempId,
} from "@/lib/admin";
import {
  Card,
  Table,
  Td,
  Pill,
  BtnPrimary,
  BtnGhost,
  BtnDanger,
  inputCls,
  selectCls,
} from "./ui";
import { setStaffPassword } from "@/lib/admin-api";
import { ConfirmDialog } from "./confirm-dialog";

const MODULE_LABELS: Record<AdminModule, string> = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  orders: "Orders",
  invoices: "Invoices",
  warranty: "Warranty",
  products: "Products",
  inventory: "Inventory",
  leads: "Service leads",
  customers: "Customers",
  homepage: "Home page",
  landingpages: "Landing pages",
  sitecontent: "Site content",
  payments: "Payments",
  shipping: "Shipping & couriers",
  messaging: "Text messages",
  staff: "Staff & roles",
  // Narrower than Staff & roles on purpose: staff cannot reset their own
  // password, so someone has to set it — without also being able to create,
  // delete or re-permission people.
  staffpassword: "Set staff passwords",
  // Narrower than Orders on purpose: everyone who works orders can advance a
  // status, but changing what a placed order charges is its own grant.
  orderadjust: "Order charges (corrections)",
};

const PERMS: Permission[] = ["none", "view", "manage"];

export function StaffSection() {
  const { state, update, can, user } = useAdmin();
  const readOnly = can("staff") !== "manage";
  /* Its own grant: a Manager sets passwords without being able to create,
     delete or re-permission anyone. The server enforces the same split. */
  const canSetPassword = can("staffpassword") === "manage";
  const [selectedRoleId, setSelectedRoleId] = useState("manager");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    // Default to the least-privileged non-system role rather than a hardcoded
    // "support": whichever roles this shop has actually created, start at the
    // bottom of them.
    roleId: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const selectedRole =
    state.roles.find((r) => r.id === selectedRoleId) ?? state.roles[0];
  const staffCount = (roleId: string) =>
    state.staff.filter((s) => s.roleId === roleId).length;
  // Never offer "super" as a default for a new hire.
  const assignableRoles = state.roles.filter((r) => r.id !== "super");
  const defaultRoleId = assignableRoles.at(-1)?.id ?? "";

  const addStaff = () => {
    const username = draft.username.trim().toLowerCase();
    if (!draft.name.trim() || !username || draft.password.length < 6) {
      toast("Fill in name, username and a password of 6+ characters");
      return;
    }
    if (state.staff.some((s) => s.username === username)) {
      toast(`Username "${username}" is taken`);
      return;
    }
    const email = draft.email.trim().toLowerCase();
    // Optional, but it's the only way this person can recover their own
    // password — so a malformed one is worth catching here.
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast("Enter a valid email address, or leave it blank");
      return;
    }
    if (email && state.staff.some((s) => s.email?.toLowerCase() === email)) {
      toast(`Email "${email}" is already assigned to another staff member`);
      return;
    }
    // Was hardcoded to "support" regardless of anything on screen — and the
    // form had no role picker at all, so every new staff member landed in the
    // wrong role and had to be corrected in the table afterwards.
    const roleId = draft.roleId || defaultRoleId;
    if (!roleId) {
      toast("Create a role first, then add staff to it");
      return;
    }

    // The transient password field is sent to POST /admin/api/staff by the
    // sync layer; the server stores only a hash (better-auth).
    update({
      staff: [
        ...state.staff,
        {
          id: tempId("staff"),
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          email,
          username,
          password: draft.password,
          roleId,
        },
      ],
    });
    setDraft({ name: "", phone: "", email: "", username: "", password: "", roleId: "" });
    setAdding(false);
    toast(`${draft.name.trim()} added to staff`);
  };

  const inUse = selectedRole ? staffCount(selectedRole.id) : 0;
  const blockedReason = `Move its ${inUse} ${inUse === 1 ? "person" : "people"} to another role before deleting it.`;

  const setRolePerm = (module: AdminModule, perm: Permission) => {
    update({
      roles: state.roles.map((r) =>
        r.id === selectedRole.id
          ? { ...r, permissions: { ...r.permissions, [module]: perm } }
          : r,
      ),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Staff members */}
      <Card className="px-5 py-5 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-ui-base font-bold">Staff members</h2>
          {!readOnly ? (
            <BtnPrimary onClick={() => setAdding((a) => !a)}>
              <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add staff
            </BtnPrimary>
          ) : null}
        </div>

        {adding ? (
          <div className="mb-4 grid gap-2.5 rounded-2xl border border-zup-body/8 bg-surface-sunken p-4 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Full name"
              aria-label="Full name"
              className={inputCls}
            />
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Phone"
              inputMode="tel"
              aria-label="Phone"
              className={inputCls}
            />
            <input
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Email (for password reset)"
              type="email"
              autoCapitalize="none"
              aria-label="Email"
              className={inputCls}
            />
            <input
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              placeholder="username"
              autoCapitalize="none"
              aria-label="Username"
              className={`${inputCls} font-mono`}
            />
            <div className="flex gap-1.5">
              <input
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                aria-label="Password"
                className={`${inputCls} min-w-0 flex-1`}
              />
              <BtnGhost
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="min-h-10 px-3"
              >
                {showPassword ? "Hide" : "Show"}
              </BtnGhost>
            </div>
            <select
              value={draft.roleId || defaultRoleId}
              onChange={(e) => setDraft({ ...draft, roleId: e.target.value })}
              aria-label="Role"
              className={selectCls}
            >
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <BtnPrimary onClick={addStaff}>Save</BtnPrimary>
          </div>
        ) : null}

        <Table head={["Name", "Phone", "Email", "Username", "Role", ""]} minWidth={840}>
          {state.staff.map((s) => {
            const isSuperSelf = s.roleId === "super";
            return (
              <tr key={s.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{s.name}</Td>
                <Td className="text-zup-gray">{s.phone}</Td>
                <Td className="max-w-[220px] truncate text-zup-gray">
                  {s.email ? (
                    s.email
                  ) : (
                    // Without an address this member can't use "Forgot
                    // password?" — another admin has to reset it for them.
                    <span title="No email on file — this member can't reset their own password">
                      <Pill tone="amber">No reset email</Pill>
                    </span>
                  )}
                </Td>
                <Td className="font-mono text-ui-sm text-zup-gray">{s.username}</Td>
                <Td>
                  <select
                    value={s.roleId}
                    disabled={readOnly || isSuperSelf}
                    aria-label={`Role of ${s.name}`}
                    onChange={(e) => {
                      update({
                        staff: state.staff.map((x) =>
                          x.id === s.id ? { ...x, roleId: e.target.value } : x,
                        ),
                      });
                      toast(`${s.name} → ${state.roles.find((r) => r.id === e.target.value)?.name}`);
                    }}
                    className={selectCls}
                  >
                    {state.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {/* Staff cannot reset their own password any more, so this
                      is the only way one gets changed. Its own permission,
                      narrower than `staff` — a Manager sets passwords without
                      being able to create or delete people. */}
                  {canSetPassword ? <SetPasswordButton id={s.id} name={s.name} /> : null}
                  {!readOnly && !isSuperSelf && s.id !== user?.id ? (
                    <ConfirmDialog
                      trigger={<BtnDanger className="ml-1.5">Remove</BtnDanger>}
                      title={`Remove ${s.name}?`}
                      description="They will immediately lose access to the admin panel."
                      confirmLabel="Remove"
                      onConfirm={() => {
                        update({ staff: state.staff.filter((x) => x.id !== s.id) });
                        toast(`${s.name} removed`);
                      }}
                    />
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* Roles + permission matrix */}
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit px-4 py-4">
          <h2 className="mb-2.5 px-1.5 text-ui-base font-bold">Roles</h2>
          {state.roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRoleId(r.id)}
              className={cn(
                "mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                r.id === selectedRole.id
                  ? "bg-info-bg text-zup-blue"
                  : "text-zup-body hover:bg-secondary",
              )}
            >
              {r.name}
              <span className="text-ui-micro font-medium text-zup-soft">
                {staffCount(r.id)} staff
              </span>
            </button>
          ))}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                const id = tempId("role");
                const none = Object.fromEntries(
                  ADMIN_MODULES.map((m) => [m, m === "dashboard" ? "view" : "none"]),
                ) as Role["permissions"];
                update({
                  roles: [...state.roles, { id, name: "New role", permissions: none }],
                });
                setSelectedRoleId(id);
                toast("Role created — set its permissions");
              }}
              className="mt-2 w-full rounded-xl border border-dashed border-zup-body/20 px-3 py-2.5 text-sm font-bold text-zup-blue transition-colors hover:bg-info-tint"
            >
              + New role
            </button>
          ) : null}
        </Card>

        <Card className="px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input
              value={selectedRole.name}
              disabled={readOnly || selectedRole.id === "super"}
              aria-label="Role name"
              onChange={(e) =>
                update({
                  roles: state.roles.map((r) =>
                    r.id === selectedRole.id ? { ...r, name: e.target.value } : r,
                  ),
                })
              }
              className={`${inputCls} max-w-[220px] font-bold`}
            />
            {/* The guard used to run inside onConfirm: you clicked Delete,
                confirmed a destructive action in a dialog, and only then were
                told it wasn't allowed. Check first — a button that can't work
                should look like it can't work, and say why. */}
            {!readOnly && selectedRole.id !== "super" ? (
              inUse > 0 ? (
                <BtnDanger disabled className="min-h-10 px-4" title={blockedReason}>
                  Delete role
                </BtnDanger>
              ) : (
                <ConfirmDialog
                  trigger={<BtnDanger className="min-h-10 px-4">Delete role</BtnDanger>}
                  title={`Delete the "${selectedRole.name}" role?`}
                  description="This can't be undone."
                  confirmLabel="Delete"
                  onConfirm={() => {
                    update({ roles: state.roles.filter((r) => r.id !== selectedRole.id) });
                    setSelectedRoleId("super");
                    toast(`${selectedRole.name} role deleted`);
                  }}
                />
              )
            ) : null}
          </div>

          {inUse > 0 && !readOnly && selectedRole.id !== "super" ? (
            <p className="mb-4 text-ui-sm text-zup-gray">{blockedReason}</p>
          ) : null}

          <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2 border-b border-zup-body/6 pb-2">
            <span className="text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-soft">
              Module
            </span>
            <span className="text-ui-micro font-bold uppercase tracking-[0.08em] text-zup-soft">
              Permission
            </span>
          </div>

          {ADMIN_MODULES.map((m) => (
            <div
              key={m}
              className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-zup-body/5 py-2.5 last:border-0"
            >
              <span className="text-sm font-semibold">{MODULE_LABELS[m]}</span>
              <div
                className="inline-flex rounded-full bg-zup-body/6 p-1"
                role="radiogroup"
                aria-label={`${MODULE_LABELS[m]} permission`}
              >
                {PERMS.map((perm) => {
                  const active = selectedRole.permissions[m] === perm;
                  const locked = readOnly || selectedRole.id === "super";
                  return (
                    <button
                      key={perm}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={locked}
                      onClick={() => setRolePerm(m, perm)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors disabled:cursor-not-allowed",
                        active
                          ? perm === "none"
                            ? "bg-zup-ink text-white"
                            : "bg-zup-blue text-white"
                          : "text-zup-gray hover:text-zup-body disabled:opacity-55",
                      )}
                    >
                      {perm}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {selectedRole.id === "super" ? (
            <p className="mt-3 text-xs text-zup-soft">
              Super Admin always has full access — its permissions can&apos;t be reduced.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/**
 * Set a staff member's password.
 *
 * Deliberately not part of the pending-changes/Save flow the rest of this
 * screen uses: a password is applied the moment it is submitted, and it must
 * never sit in a draft object waiting for someone to press Save at the bottom
 * of the page.
 */
function SetPasswordButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await setStaffPassword(id, password);
      toast.success(`New password set for ${name}`);
      setPassword("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set the password");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <BtnGhost className="min-h-9 px-3" onClick={() => setOpen(true)}>
        Set password
      </BtnGhost>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <input
        type="password"
        autoFocus
        value={password}
        disabled={busy}
        placeholder="New password"
        aria-label={`New password for ${name}`}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") setOpen(false);
        }}
        className={`${inputCls} w-40`}
      />
      <BtnPrimary className="min-h-9 px-3" disabled={busy} onClick={() => void submit()}>
        Save
      </BtnPrimary>
      <BtnGhost className="min-h-9 px-3" onClick={() => setOpen(false)}>
        Cancel
      </BtnGhost>
    </div>
  );
}
