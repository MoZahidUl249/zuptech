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
} from "@/lib/admin";
import {
  Card,
  Table,
  Td,
  BtnPrimary,
  BtnGhost,
  BtnDanger,
  inputCls,
  selectCls,
} from "./ui";
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
  staff: "Staff & roles",
  pricing: "Delivery & installation pricing",
};

const PERMS: Permission[] = ["none", "view", "manage"];

export function StaffSection() {
  const { state, update, can, user } = useAdmin();
  const readOnly = can("staff") !== "manage";
  const [selectedRoleId, setSelectedRoleId] = useState("manager");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const selectedRole =
    state.roles.find((r) => r.id === selectedRoleId) ?? state.roles[0];
  const staffCount = (roleId: string) =>
    state.staff.filter((s) => s.roleId === roleId).length;

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
    // The transient password field is sent to POST /admin/api/staff by the
    // sync layer; the server stores only a hash (better-auth).
    update({
      staff: [
        ...state.staff,
        {
          id: `s${Date.now()}`,
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          username,
          password: draft.password,
          roleId: "support",
        },
      ],
    });
    setDraft({ name: "", phone: "", username: "", password: "" });
    setAdding(false);
    toast(`${draft.name.trim()} added to staff`);
  };

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
          <h2 className="text-[15px] font-bold">Staff members</h2>
          {!readOnly ? (
            <BtnPrimary onClick={() => setAdding((a) => !a)}>
              <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add staff
            </BtnPrimary>
          ) : null}
        </div>

        {adding ? (
          <div className="mb-4 grid gap-2.5 rounded-2xl border border-zup-body/8 bg-[#FAFBFC] p-4 sm:grid-cols-5">
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
            <BtnPrimary onClick={addStaff}>Save</BtnPrimary>
          </div>
        ) : null}

        <Table head={["Name", "Phone", "Username", "Role", ""]} minWidth={680}>
          {state.staff.map((s) => {
            const isSuperSelf = s.roleId === "super";
            return (
              <tr key={s.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{s.name}</Td>
                <Td className="text-zup-gray">{s.phone}</Td>
                <Td className="font-mono text-[13px] text-zup-gray">{s.username}</Td>
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
                <Td className="text-right">
                  {!readOnly && !isSuperSelf && s.id !== user?.id ? (
                    <ConfirmDialog
                      trigger={<BtnDanger>Remove</BtnDanger>}
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
          <h2 className="mb-2.5 px-1.5 text-[15px] font-bold">Roles</h2>
          {state.roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRoleId(r.id)}
              className={cn(
                "mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                r.id === selectedRole.id
                  ? "bg-[#E7EDFC] text-zup-blue"
                  : "text-zup-body hover:bg-secondary",
              )}
            >
              {r.name}
              <span className="text-[11px] font-medium text-zup-soft">
                {staffCount(r.id)} staff
              </span>
            </button>
          ))}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => {
                const id = `role${Date.now()}`;
                const none = Object.fromEntries(
                  ADMIN_MODULES.map((m) => [m, m === "dashboard" ? "view" : "none"]),
                ) as Role["permissions"];
                update({
                  roles: [...state.roles, { id, name: "New role", permissions: none }],
                });
                setSelectedRoleId(id);
                toast("Role created — set its permissions");
              }}
              className="mt-2 w-full rounded-xl border border-dashed border-zup-body/20 px-3 py-2.5 text-sm font-bold text-zup-blue transition-colors hover:bg-[#F4F7FE]"
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
            {!readOnly && selectedRole.id !== "super" ? (
              <ConfirmDialog
                trigger={
                  <BtnDanger className="min-h-10 px-4">Delete role</BtnDanger>
                }
                title={`Delete "${selectedRole.name}" role?`}
                description="This can't be undone. Staff assigned to it must be reassigned first."
                confirmLabel="Delete"
                onConfirm={() => {
                  if (staffCount(selectedRole.id) > 0) {
                    toast("Reassign this role's staff before deleting it");
                    return;
                  }
                  update({ roles: state.roles.filter((r) => r.id !== selectedRole.id) });
                  setSelectedRoleId("super");
                  toast(`${selectedRole.name} role deleted`);
                }}
              />
            ) : null}
          </div>

          <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2 border-b border-zup-body/6 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zup-soft">
              Module
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zup-soft">
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
