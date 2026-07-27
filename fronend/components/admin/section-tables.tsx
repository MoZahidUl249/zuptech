"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  useAdmin,
  LEAD_STATUSES,
  INDUSTRIAL_LEAD_STATUSES,
  type LeadStatus,
  type IndustrialLeadStatus,
} from "@/lib/admin";
import { Card, Table, Td, Pill, selectCls, type PillTone } from "./ui";

// Orders used to live here too; they moved to ./section-orders.tsx when they
// grew a detail view (prepared-by, audit trail, invoice, warranty).

/* ===== Service leads ===== */

export function LeadsSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("leads") !== "manage";

  return (
    <div className="flex flex-col gap-4">
      <Card className="px-2 py-2">
        <Table head={["Service", "Customer", "City", "Status"]} minWidth={680}>
          {state.leads.map((l) => (
            <tr key={l.id} className="last:[&>td]:border-0">
              <Td className="font-bold">{l.service}</Td>
              <Td className="text-zup-mid">{l.customer}</Td>
              <Td className="text-zup-gray">{l.city}</Td>
              <Td>
                {readOnly ? (
                  <Pill
                    tone={l.status === "New" ? "amber" : l.status === "Won" ? "green" : "blue"}
                  >
                    {l.status}
                  </Pill>
                ) : (
                  <select
                    value={l.status}
                    aria-label={`Status of lead from ${l.customer}`}
                    onChange={(e) => {
                      update({
                        leads: state.leads.map((x) =>
                          x.id === l.id ? { ...x, status: e.target.value as LeadStatus } : x,
                        ),
                      });
                      toast(`Lead updated → ${e.target.value}`);
                    }}
                    className={selectCls}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card className="px-5 py-5 sm:px-6">
        <p className="text-[15px] font-bold">Contact messages</p>
        <p className="mt-0.5 text-xs text-zup-soft">
          Sent from the contact page form — reply by phone or email.
        </p>
        {state.messages.length === 0 ? (
          <p className="mt-4 text-[13px] text-zup-soft">No messages yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zup-body/6">
            {state.messages.map((m) => (
              <li key={m.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p className="text-[14px] font-bold">{m.name}</p>
                  {m.phone ? <span className="text-xs text-zup-gray">{m.phone}</span> : null}
                  {m.email ? <span className="text-xs text-zup-gray">{m.email}</span> : null}
                  <span className="ml-auto text-xs text-zup-soft">{m.createdAt}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-zup-mid">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ===== Industrial leads =====
 *
 * Deliberately not folded into LeadsSection: an industrial enquiry is
 * qualified on company/sector/load/timeline rather than customer + city, and
 * runs a longer pipeline, so it gets its own columns, its own status
 * vocabulary and a detail row for the full project spec. Gated on the same
 * "leads" permission. */

function industrialTone(status: IndustrialLeadStatus): PillTone {
  if (status === "Won") return "green";
  if (status === "Lost") return "red";
  if (status === "New") return "amber";
  if (status === "Negotiation" || status === "Proposal sent") return "purple";
  return "blue";
}

export function IndustrialLeadsSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("leads") !== "manage";
  const [openId, setOpenId] = useState<string | null>(null);

  const leads = state.industrialLeads;

  return (
    <div className="flex flex-col gap-4">
      <Card className="px-5 py-4 sm:px-6">
        <p className="text-[15px] font-bold">Industrial enquiries</p>
        <p className="mt-0.5 text-xs text-zup-soft">
          B2B project requests from the /industrial page — qualify, survey, then
          quote. Click a row for the full site spec.
        </p>
      </Card>

      <Card className="px-2 py-2">
        {leads.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-zup-soft">
            No industrial enquiries yet.
          </p>
        ) : (
          <Table
            head={["Company", "Contact", "Sector", "Load", "Timeline", "Status"]}
            minWidth={880}
          >
            {leads.map((l) => {
              const open = openId === l.id;
              return (
                <Fragment key={l.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : l.id)}
                    className="cursor-pointer transition-colors hover:bg-zup-body/2"
                  >
                    <Td className="font-bold">
                      {l.company}
                      <span className="mt-0.5 block text-[11px] font-medium text-zup-soft">
                        {l.service}
                      </span>
                    </Td>
                    <Td className="text-zup-mid">
                      {l.contactName}
                      <span className="mt-0.5 block text-[11px] text-zup-soft">{l.phone}</span>
                    </Td>
                    <Td className="text-zup-gray">{l.sector}</Td>
                    <Td className="text-zup-gray">{l.load || "—"}</Td>
                    <Td className="text-zup-gray">{l.timeline}</Td>
                    {/* Stop propagation so changing status doesn't also
                        toggle the detail row open/closed. */}
                    <Td>
                      {readOnly ? (
                        <Pill tone={industrialTone(l.status)}>{l.status}</Pill>
                      ) : (
                        <select
                          value={l.status}
                          aria-label={`Status of industrial enquiry from ${l.company}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            update({
                              industrialLeads: leads.map((x) =>
                                x.id === l.id
                                  ? { ...x, status: e.target.value as IndustrialLeadStatus }
                                  : x,
                              ),
                            });
                            toast(`Industrial lead updated → ${e.target.value}`);
                          }}
                          className={selectCls}
                        >
                          {INDUSTRIAL_LEAD_STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </Td>
                  </tr>

                  {open ? (
                    <tr className="bg-[#FAFBFC]">
                      <Td colSpan={6} className="px-5 py-4">
                        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                          <Detail label="Service requested" value={l.service} />
                          <Detail label="Project scope" value={l.scope} />
                          <Detail label="Site location" value={l.siteLocation} />
                          <Detail label="Connected load" value={l.load} />
                          <Detail label="Indicative budget" value={l.budget} />
                          <Detail label="Designation" value={l.designation} />
                          <Detail label="Email" value={l.email} />
                          <Detail
                            label="Received"
                            value={new Date(l.createdAt).toLocaleString()}
                          />
                        </dl>
                        {l.notes ? (
                          <div className="mt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-zup-soft">
                              Project details
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed text-zup-mid">
                              {l.notes}
                            </p>
                          </div>
                        ) : null}
                        {readOnly ? null : (
                          <button
                            type="button"
                            onClick={() => {
                              update({
                                industrialLeads: leads.filter((x) => x.id !== l.id),
                              });
                              setOpenId(null);
                              toast(`Deleted enquiry from ${l.company}`);
                            }}
                            className="mt-4 text-xs font-bold text-[#D32F2F] hover:underline"
                          >
                            Delete enquiry
                          </button>
                        )}
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-zup-soft">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-zup-mid">{value || "—"}</dd>
    </div>
  );
}

/* ===== Customers ===== */

export function CustomersSection() {
  const { state } = useAdmin();
  return (
    <Card className="px-2 py-2">
      <Table head={["Customer", "Phone", "Orders", "Joined"]} minWidth={560}>
        {state.customers.map((c) => (
          <tr key={c.id} className="last:[&>td]:border-0">
            <Td className="font-bold">{c.name}</Td>
            <Td className="text-zup-gray">{c.phone}</Td>
            <Td className="font-bold">{c.orders}</Td>
            <Td className="text-zup-soft">{c.joined}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
