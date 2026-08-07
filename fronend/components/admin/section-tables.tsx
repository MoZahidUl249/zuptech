"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Factory, Mail, PhoneCall, ShoppingBag, Users } from "lucide-react";
import {
  useAdmin,
  LEAD_STATUSES,
  INDUSTRIAL_LEAD_STATUSES,
  type IndustrialLead,
  type IndustrialLeadStatus,
  type LeadStatus,
  type ServiceLead,
} from "@/lib/admin";
import { BtnDanger, Card, Pill, selectCls, type PillTone } from "./ui";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "./confirm-dialog";
import { DataTable, EmptyState, PageHeader, sortRows, type Column } from "./primitives";
import { FilterBar, FilterTabs } from "./primitives/filter-bar";
import { useFilterParams } from "./primitives/filter-params";

// Orders used to live here too; they moved to ./section-orders.tsx when they
// grew a detail view (prepared-by, audit trail, invoice, warranty).

const ALL = "all";

/* ===== Service requests ===== */

export function LeadsSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("leads") !== "manage";
  const { get, set, clear } = useFilterParams();
  const q = get("q");
  const status = get("status", ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const count = (s: LeadStatus) => state.leads.filter((l) => l.status === s).length;
  const needle = q.trim().toLowerCase();
  const rows = state.leads.filter(
    (l) =>
      (status === ALL || l.status === status) &&
      (!needle ||
        l.service.toLowerCase().includes(needle) ||
        l.customer.toLowerCase().includes(needle) ||
        l.address.toLowerCase().includes(needle)),
  );

  const openLead = state.leads.find((l) => l.id === openId) ?? null;

  const columns: Column<(typeof state.leads)[number]>[] = [
    { key: "service", header: "Service", cell: (l) => <span className="font-bold">{l.service}</span> },
    { key: "customer", header: "Customer", cell: (l) => <span className="text-zup-mid">{l.customer}</span> },
    { key: "address", header: "Where", priority: 2, cell: (l) => <span className="text-zup-gray">{l.address || "—"}</span> },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (l) =>
        readOnly ? (
          <Pill tone={l.status === "New" ? "amber" : l.status === "Won" ? "green" : "blue"}>
            {l.status}
          </Pill>
        ) : (
          <select
            value={l.status}
            aria-label={`Status of the request from ${l.customer}`}
            onChange={(e) => {
              update({
                leads: state.leads.map((x) =>
                  x.id === l.id ? { ...x, status: e.target.value as LeadStatus } : x,
                ),
              });
              toast(`${l.customer} → ${e.target.value}`);
            }}
            className={selectCls}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title="Service requests"
          help="People who asked for a home service visit. Call them back and move them along."
        />

        {/* Status was buried in the row selects with no way to filter by it at
            all — you had to read every row to find the new ones. */}
        <FilterTabs
          label="Filter by status"
          value={status}
          onChange={(v) => set({ status: v === ALL ? null : v })}
          options={[
            { value: ALL, label: "All", count: state.leads.length },
            ...LEAD_STATUSES.map((s) => ({ value: s, label: s, count: count(s) })),
          ]}
        />

        <FilterBar
          search={q}
          onSearchChange={(v) => set({ q: v })}
          searchPlaceholder="Search by service, name or address…"
          onReset={clear}
        />

        <Card className="px-2 py-2">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(l) => l.id}
            onRowActivate={(l) => setOpenId(l.id)}
            empty={
              <EmptyState
                icon={PhoneCall}
                title={state.leads.length === 0 ? "No service requests yet" : "Nothing matches"}
                help={
                  state.leads.length === 0
                    ? "They'll appear here when someone books a visit on the Services page."
                    : "Try a different search, or clear the filters."
                }
              />
            }
          />
        </Card>

        {/* Everything the customer typed — phone, email, address, the details
            box — was fetched and then rendered nowhere, so staff could see a
            name and a status and nothing they could act on. */}
        {openLead ? (
          <RequestDetail lead={openLead} onClose={() => setOpenId(null)} />
        ) : null}
      </div>

      <ContactMessages />
    </div>
  );
}

/**
 * Messages from the contact form.
 *
 * These now track read/unread. The backend has always stored and accepted the
 * flag; the admin never used it, so there was no way to tell a message
 * somebody had dealt with from one nobody had seen — and the Today screen had
 * nothing to count.
 */
function ContactMessages() {
  const { state, update, can } = useAdmin();
  const readOnly = can("leads") !== "manage";
  const unread = state.messages.filter((m) => !m.read);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? state.messages : unread.length > 0 ? unread : state.messages;

  const setRead = (id: string, read: boolean) =>
    update({ messages: state.messages.map((m) => (m.id === id ? { ...m, read } : m)) });

  return (
    <Card className="px-5 py-5 sm:px-6" id="messages">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-ui-lg font-bold">
          Contact messages
          {unread.length > 0 ? (
            <span className="ml-2 rounded-full bg-zup-blue px-2 py-0.5 text-ui-xs font-extrabold text-white">
              {unread.length} new
            </span>
          ) : null}
        </h2>
        {state.messages.length > unread.length && unread.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="cursor-pointer text-ui-sm font-bold text-zup-blue transition-colors hover:text-zup-blue-dark"
          >
            {showAll ? "Show unread only" : `Show all ${state.messages.length}`}
          </button>
        ) : null}
      </div>
      <p className="text-ui-sm text-zup-soft">Sent from the contact page. Reply by phone or email.</p>

      {state.messages.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Mail}
            title="No messages yet"
            help="Anything sent through the contact form lands here."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-zup-body/6">
          {shown.map((m) => (
            <li key={m.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                {!m.read ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-zup-blue"
                    aria-label="Unread"
                  />
                ) : null}
                <p className="text-ui-base font-bold">{m.name}</p>
                {/* tel:/mailto: so replying is one tap, not a copy-paste. */}
                {m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    className="text-ui-xs font-semibold text-zup-blue hover:underline"
                  >
                    {m.phone}
                  </a>
                ) : null}
                {m.email ? (
                  <a
                    href={`mailto:${m.email}`}
                    className="text-ui-xs font-semibold text-zup-blue hover:underline"
                  >
                    {m.email}
                  </a>
                ) : null}
                <span className="ml-auto text-ui-xs text-zup-soft">{m.createdAt}</span>
              </div>
              <p className="mt-1 text-ui-sm leading-relaxed text-zup-mid">{m.message}</p>
              {readOnly ? null : (
                <button
                  type="button"
                  onClick={() => setRead(m.id, !m.read)}
                  className="mt-2 cursor-pointer text-ui-xs font-bold text-zup-blue transition-colors hover:text-zup-blue-dark"
                >
                  {m.read ? "Mark as unread" : "Mark as read"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ===== Business enquiries =====
 *
 * Deliberately not folded into LeadsSection: an industrial enquiry is
 * qualified on company/sector/load/timeline rather than customer + city, and
 * runs a longer pipeline, so it gets its own columns, its own status
 * vocabulary and a detail panel for the full project spec. Gated on the same
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
  const { get, set, clear } = useFilterParams();
  const q = get("q");
  const status = get("status", ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const leads = state.industrialLeads;
  const count = (s: IndustrialLeadStatus) => leads.filter((l) => l.status === s).length;
  const needle = q.trim().toLowerCase();
  const rows = leads.filter(
    (l) =>
      (status === ALL || l.status === status) &&
      (!needle ||
        l.company.toLowerCase().includes(needle) ||
        l.contactName.toLowerCase().includes(needle) ||
        l.sector.toLowerCase().includes(needle) ||
        l.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || " ")),
  );

  const open = rows.find((l) => l.id === openId) ?? null;

  const columns: Column<(typeof leads)[number]>[] = [
    {
      key: "company",
      header: "Company",
      cell: (l) => (
        <span className="font-bold">
          {l.company}
          <span className="mt-0.5 block text-ui-micro font-medium text-zup-soft">{l.service}</span>
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (l) => (
        <span className="text-zup-mid">
          {l.contactName}
          <a
            href={`tel:${l.phone}`}
            className="mt-0.5 block text-ui-micro font-semibold text-zup-blue hover:underline"
          >
            {l.phone}
          </a>
        </span>
      ),
    },
    { key: "sector", header: "Sector", priority: 2, cell: (l) => <span className="text-zup-gray">{l.sector}</span> },
    { key: "load", header: "Load", priority: 3, cell: (l) => <span className="text-zup-gray">{l.load || "—"}</span> },
    { key: "timeline", header: "When", priority: 3, cell: (l) => <span className="text-zup-gray">{l.timeline}</span> },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (l) =>
        readOnly ? (
          <Pill tone={industrialTone(l.status)}>{l.status}</Pill>
        ) : (
          <select
            value={l.status}
            aria-label={`Status of the enquiry from ${l.company}`}
            onChange={(e) => {
              update({
                industrialLeads: leads.map((x) =>
                  x.id === l.id ? { ...x, status: e.target.value as IndustrialLeadStatus } : x,
                ),
              });
              toast(`${l.company} → ${e.target.value}`);
            }}
            className={selectCls}
          >
            {INDUSTRIAL_LEAD_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Business enquiries"
        help="Companies asking about industrial work. Open one to see the full site details."
      />

      <FilterTabs
        label="Filter by status"
        value={status}
        onChange={(v) => set({ status: v === ALL ? null : v })}
        options={[
          { value: ALL, label: "All", count: leads.length },
          ...INDUSTRIAL_LEAD_STATUSES.map((s) => ({ value: s, label: s, count: count(s) })),
        ]}
      />

      <FilterBar
        search={q}
        onSearchChange={(v) => set({ q: v })}
        searchPlaceholder="Search by company, contact, sector or phone…"
        onReset={clear}
      />

      <Card className="px-2 py-2">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(l) => l.id}
          onRowActivate={(l) => setOpenId(l.id)}
          empty={
            <EmptyState
              icon={Factory}
              title={leads.length === 0 ? "No business enquiries yet" : "Nothing matches"}
              help={
                leads.length === 0
                  ? "Enquiries from the Industrial page land here."
                  : "Try a different search, or clear the filters."
              }
            />
          }
        />
      </Card>

      {/* The spec used to expand inline, which pushed every row below it down
          the page — you lost your place every time you looked at one. */}
      {open ? (
        <EnquiryDetail
          lead={open}
          readOnly={readOnly}
          onClose={() => setOpenId(null)}
          onDelete={() => {
            update({ industrialLeads: leads.filter((x) => x.id !== open.id) });
            setOpenId(null);
            toast(`Deleted the enquiry from ${open.company}`);
          }}
        />
      ) : null}
    </div>
  );
}

/** One service request in full. Same Sheet/Detail vocabulary as the industrial
 *  EnquiryDetail below — a service lead has fewer fields, not different ones. */
function RequestDetail({ lead: l, onClose }: { lead: ServiceLead; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-6 sm:max-w-[520px]">
        <SheetTitle className="text-ui-xl font-extrabold tracking-[-0.015em]">
          {l.customer}
        </SheetTitle>
        <p className="mt-0.5 mb-5 text-ui-sm text-zup-gray">{l.service}</p>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
          <div>
            <dt className="text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
              Phone
            </dt>
            <dd className="mt-0.5 text-ui-sm font-medium">
              {l.phone ? (
                <a href={`tel:${l.phone}`} className="text-zup-blue hover:underline">
                  {l.phone}
                </a>
              ) : (
                <span className="text-zup-mid">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
              Email
            </dt>
            <dd className="mt-0.5 text-ui-sm font-medium">
              {l.email ? (
                <a href={`mailto:${l.email}`} className="text-zup-blue hover:underline">
                  {l.email}
                </a>
              ) : (
                <span className="text-zup-mid">—</span>
              )}
            </dd>
          </div>
          <Detail label="Address" value={l.address} />
          <Detail label="Came in" value={new Date(l.createdAt).toLocaleString()} />
        </dl>

        {l.notes ? (
          <div className="mt-5">
            <p className="text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
              What they told us
            </p>
            <p className="mt-1 text-ui-sm leading-relaxed text-zup-mid">{l.notes}</p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EnquiryDetail({
  lead: l,
  readOnly,
  onClose,
  onDelete,
}: {
  lead: IndustrialLead;
  readOnly: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  // A Sheet rather than a hand-rolled fixed panel: it brings the focus trap,
  // Escape-to-close and correct stacking. The hand-rolled version put its own
  // backdrop above the delete confirmation, so the dialog appeared greyed out
  // behind it.
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-6 sm:max-w-[520px]">
        <SheetTitle className="text-ui-xl font-extrabold tracking-[-0.015em]">
          {l.company}
        </SheetTitle>
        <p className="mt-0.5 mb-5 text-ui-sm text-zup-gray">{l.service}</p>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
          <Detail label="Who to contact" value={l.contactName} />
          <Detail label="Their job title" value={l.designation} />
          <Detail label="Phone" value={l.phone} />
          <Detail label="Email" value={l.email} />
          <Detail label="Project scope" value={l.scope} />
          <Detail label="Where the site is" value={l.siteLocation} />
          <Detail label="Connected load" value={l.load} />
          <Detail label="Rough budget" value={l.budget} />
          <Detail label="When they need it" value={l.timeline} />
          <Detail label="Came in" value={new Date(l.createdAt).toLocaleString()} />
        </dl>

        {l.notes ? (
          <div className="mt-5">
            <p className="text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
              What they told us
            </p>
            <p className="mt-1 text-ui-sm leading-relaxed text-zup-mid">{l.notes}</p>
          </div>
        ) : null}

        {readOnly ? null : (
          <div className="mt-8">
            <ConfirmDialog
              trigger={<BtnDanger className="min-h-10 px-4">Delete enquiry</BtnDanger>}
              title={`Delete the enquiry from ${l.company}?`}
              description="This can't be undone."
              confirmLabel="Delete"
              onConfirm={onDelete}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
        {label}
      </dt>
      <dd className="mt-0.5 text-ui-sm font-medium text-zup-mid">{value || "—"}</dd>
    </div>
  );
}

/* ===== Customers ===== */

export function CustomersSection() {
  const { state, can } = useAdmin();
  const { get, set, clear } = useFilterParams();
  const q = get("q");
  const sortKey = get("sort", "orders");
  const sortDir = get("dir", "desc") as "asc" | "desc";

  const needle = q.trim().toLowerCase();
  const filtered = state.customers.filter(
    (c) =>
      !needle ||
      c.name.toLowerCase().includes(needle) ||
      c.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || " "),
  );
  const rows = sortRows(filtered, { key: sortKey, dir: sortDir }, (c, key) =>
    key === "orders" ? c.orders : key === "name" ? c.name : c.joined,
  );

  const columns: Column<(typeof state.customers)[number]>[] = [
    { key: "name", header: "Customer", sortable: true, cell: (c) => <span className="font-bold">{c.name}</span> },
    {
      key: "phone",
      header: "Phone",
      cell: (c) => (
        <a href={`tel:${c.phone}`} className="text-zup-blue hover:underline">
          {c.phone}
        </a>
      ),
    },
    { key: "orders", header: "Orders", sortable: true, cell: (c) => <span className="font-bold">{c.orders}</span> },
    { key: "joined", header: "First ordered", priority: 2, sortable: true, cell: (c) => <span className="text-zup-soft">{c.joined}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      hideLabelOnCard: true,
      cell: (c) =>
        can("orders") === "none" ? null : (
          // The single most useful thing on this screen, and it didn't exist:
          // the whole point of looking a customer up is to find their orders.
          <Link
            href={`/admin/orders?q=${encodeURIComponent(c.phone)}`}
            className="rounded-full bg-secondary px-3.5 py-2 text-ui-sm font-bold text-zup-body transition-colors hover:bg-zup-body/10"
          >
            See their orders
          </Link>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        help="Everyone who has ordered from you. Search by name or phone number."
      />

      <FilterBar
        search={q}
        onSearchChange={(v) => set({ q: v })}
        searchPlaceholder="Search by name or phone…"
        onReset={clear}
      />

      <p className="mb-3 text-ui-sm font-semibold text-zup-soft">
        {rows.length} of {state.customers.length} customers
      </p>

      <Card className="px-2 py-2">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          sort={{ key: sortKey, dir: sortDir }}
          onSortChange={(s) => set({ sort: s.key, dir: s.dir })}
          empty={
            <EmptyState
              icon={state.customers.length === 0 ? Users : ShoppingBag}
              title={state.customers.length === 0 ? "No customers yet" : "Nobody matches"}
              help={
                state.customers.length === 0
                  ? "A customer record is created the first time someone orders."
                  : "Try a different name or phone number."
              }
            />
          }
        />
      </Card>
    </div>
  );
}
