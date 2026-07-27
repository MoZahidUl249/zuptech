"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAdmin, type PaymentMethod } from "@/lib/admin";
import { getLocationChildren, patchLocationNode, type AdminLocationNode } from "@/lib/admin-api";
import {
  Card,
  KpiCard,
  Field,
  Pill,
  Toggle,
  BtnGhost,
  Table,
  Td,
  inputCls,
  selectCls,
} from "./ui";

export function PaymentsSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("payments") !== "manage";

  const enabled = state.payments.filter((p) => p.enabled);
  const liveGateways = enabled.filter((p) => p.isGateway && p.environment === "Live");
  const testMode = enabled.filter((p) => p.isGateway && p.environment === "Test");

  const setMethod = (id: string, patch: Partial<PaymentMethod>) =>
    update({
      payments: state.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3.5">
        <KpiCard
          label="Methods enabled"
          value={`${enabled.length} / ${state.payments.length}`}
        />
        <KpiCard label="Live gateways" value={String(liveGateways.length)} tone="green" />
        <KpiCard label="In test mode" value={String(testMode.length)} tone="amber" />
      </div>

      <p className="max-w-[560px] text-[13px] leading-relaxed text-zup-gray">
        Connect and configure the payment gateways customers see at checkout. Keys and
        secrets are stored server-side and never exposed on the storefront. The method
        list itself is fixed by the backend — enable, disable and configure each one.
      </p>

      {state.payments.map((m) => (
        <MethodCard
          key={m.id}
          method={m}
          readOnly={readOnly}
          onChange={(patch) => setMethod(m.id, patch)}
        />
      ))}

      <LocationCostCard
        field="deliveryCost"
        title="Delivery pricing"
        description="What customers pay for shipping to each area — set a district-wide default, or drill in to price a specific Union/Thana differently."
      />
      <LocationCostCard
        field="installationCost"
        title="Installation pricing"
        description="The area-based part of the installation charge, added on top of each product's own installation fee — set a district-wide default, or drill in to price a specific Union/Thana differently."
      />
    </div>
  );
}

/* ===== Delivery / installation pricing tree ===== */

/**
 * Division -> District -> (CityCorporation -> CityCorpArea) | (Upazila ->
 * Union) tree, ~5,000 nodes — far too large for the whole-state diff-sync
 * pattern the rest of this store uses, so it's a self-contained lazy
 * drill-down browser instead, reading/writing /admin/api/locations
 * directly. A customer's final delivery/installation charge is the SUM of
 * every node's own cost from the root down to their chosen leaf (see
 * cal-bk.md), so cost can be edited at any level, not just leaves.
 *
 * Delivery and installation are two separate cards (one cost column each,
 * each with its own independent drill-down position) rather than one
 * combined table — one number to focus on per screen is simpler to edit
 * correctly than two side by side.
 */
function LocationCostCard({
  field,
  title,
  description,
}: {
  field: "deliveryCost" | "installationCost";
  title: string;
  description: string;
}) {
  const { can } = useAdmin();
  // The backend gates /admin/api/locations on the "pricing" module, not
  // "payments" (see src/routes/admin/locations.ts) — matching that here
  // matters because the two permissions aren't always equal per role (e.g.
  // the seeded Manager role has payments:view but pricing:manage).
  const readOnly = can("pricing") !== "manage";

  const [stack, setStack] = useState<AdminLocationNode[]>([]);
  const parentId = stack.length > 0 ? stack[stack.length - 1]!.id : null;
  // `loadedFor` tracks which parentId `nodes` actually belongs to, so a
  // drill-in/back click shows "Loading…" (loadedFor !== parentId) purely at
  // render time instead of a synchronous setState at the top of an effect.
  const [{ nodes, loadedFor }, setLoaded] = useState<{
    nodes: AdminLocationNode[] | null;
    loadedFor: string | null;
  }>({ nodes: null, loadedFor: null });
  const loading = loadedFor !== parentId;

  const load = useCallback(() => {
    let cancelled = false;
    getLocationChildren(parentId)
      .then((n) => {
        if (!cancelled) setLoaded({ nodes: n, loadedFor: parentId });
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load locations");
      });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  useEffect(() => load(), [load]);

  const saveCost = async (node: AdminLocationNode, value: number) => {
    setLoaded((prev) => ({
      ...prev,
      nodes: prev.nodes?.map((n) => (n.id === node.id ? { ...n, [field]: value } : n)) ?? prev.nodes,
    }));
    try {
      await patchLocationNode(node.id, { [field]: value });
    } catch {
      toast.error(`Couldn't save ${node.name} — please retry`);
      load();
    }
  };

  return (
    <Card className="px-2 py-2">
      <div className="px-3 pb-3 pt-3">
        <p className="text-[15px] font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-zup-soft">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-3 pb-2 text-[13px]">
        <button
          type="button"
          onClick={() => setStack([])}
          className={`cursor-pointer font-semibold ${stack.length === 0 ? "text-zup-body" : "text-zup-blue hover:underline"}`}
        >
          All divisions
        </button>
        {stack.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="text-zup-faint">/</span>
            <button
              type="button"
              onClick={() => setStack(stack.slice(0, i + 1))}
              className={`cursor-pointer font-semibold ${i === stack.length - 1 ? "text-zup-body" : "text-zup-blue hover:underline"}`}
            >
              {n.name}
            </button>
          </span>
        ))}
      </div>

      <Table head={["Name", "Price (৳)", ""]} minWidth={420}>
        {loading ? (
          <tr>
            <Td colSpan={3} className="text-center text-zup-soft">
              Loading…
            </Td>
          </tr>
        ) : nodes && nodes.length > 0 ? (
          nodes.map((n) => (
            <tr key={n.id} className="last:[&>td]:border-0">
              <Td className="font-bold">
                {n.name} <Pill tone="gray">{n.type.replace(/_/g, " ")}</Pill>
              </Td>
              <Td>
                <input
                  type="number"
                  min={0}
                  defaultValue={n[field]}
                  disabled={readOnly}
                  aria-label={`${title} for ${n.name}`}
                  onBlur={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    if (v !== n[field]) void saveCost(n, v);
                  }}
                  className={`${inputCls} max-w-[130px]`}
                />
              </Td>
              <Td>
                {n.hasChildren && (
                  <BtnGhost onClick={() => setStack([...stack, n])} className="min-h-8 px-3 text-[12.5px]">
                    Open →
                  </BtnGhost>
                )}
              </Td>
            </tr>
          ))
        ) : (
          <tr>
            <Td colSpan={3} className="text-center text-zup-soft">
              No areas here yet.
            </Td>
          </tr>
        )}
      </Table>
    </Card>
  );
}

function MethodCard({
  method: m,
  readOnly,
  onChange,
}: {
  method: PaymentMethod;
  readOnly: boolean;
  onChange: (patch: Partial<PaymentMethod>) => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [name, setName] = useState(m.name);

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7EDFC] text-sm font-extrabold text-zup-blue">
          {m.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          {readOnly ? (
            <p className="text-[15px] font-bold">{m.name}</p>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && onChange({ name: name.trim() })}
              aria-label="Method name"
              className="w-full max-w-[280px] rounded-lg border border-transparent bg-transparent text-[15px] font-bold outline-none transition-colors focus:border-zup-blue focus:bg-white"
            />
          )}
          <p className="text-xs text-zup-soft">
            {m.kind} · {m.provider}
          </p>
        </div>
        <Pill tone={m.enabled ? (m.environment === "Live" ? "green" : "amber") : "gray"}>
          {m.enabled ? m.environment : "Off"}
        </Pill>
        <Toggle
          on={m.enabled}
          disabled={readOnly}
          label={`Enable ${m.name}`}
          onChange={(on) => {
            onChange({ enabled: on });
            toast(`${m.name} ${on ? "enabled" : "disabled"}`);
          }}
        />
      </div>

      {m.isGateway ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Field label="Provider">
            <select
              value={m.provider}
              disabled={readOnly}
              onChange={(e) => onChange({ provider: e.target.value })}
              className={selectCls}
            >
              {m.providers.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Environment">
            <select
              value={m.environment}
              disabled={readOnly}
              onChange={(e) => onChange({ environment: e.target.value as "Live" | "Test" })}
              className={selectCls}
            >
              <option>Live</option>
              <option>Test</option>
            </select>
          </Field>
          <Field label="API key / Store ID" className="sm:col-span-2">
            <input
              value={m.apiKey}
              disabled={readOnly}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className={`${inputCls} font-mono text-[13px]`}
            />
          </Field>
          <Field label="API secret" className="sm:col-span-2">
            <div className="flex gap-2">
              <input
                type={showSecret ? "text" : "password"}
                value={m.apiSecret}
                disabled={readOnly}
                onChange={(e) => onChange({ apiSecret: e.target.value })}
                aria-label="API secret"
                className={`${inputCls} min-w-0 flex-1 font-mono text-[13px]`}
              />
              <BtnGhost onClick={() => setShowSecret((s) => !s)} className="min-h-10 px-4">
                {showSecret ? "Hide" : "Show"}
              </BtnGhost>
            </div>
          </Field>
          <Field label="Webhook / callback URL" className="sm:col-span-2">
            <input
              value={m.webhookUrl}
              disabled={readOnly}
              onChange={(e) => onChange({ webhookUrl: e.target.value })}
              placeholder="https://…"
              className={`${inputCls} font-mono text-[13px]`}
            />
          </Field>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-zup-gray">
          No API configuration needed — the rider collects payment on delivery.
        </p>
      )}

      {!readOnly ? (
        <p className="mt-4 text-xs font-semibold text-zup-soft">
          Changes save automatically as you type.
        </p>
      ) : null}
    </Card>
  );
}
