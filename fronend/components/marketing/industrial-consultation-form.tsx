"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, UserCog, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INDUSTRIAL_SCOPES,
  INDUSTRIAL_SECTORS,
  INDUSTRIAL_TIMELINES,
  submitIndustrialLead,
  type IndustrialScope,
  type IndustrialSector,
  type IndustrialTimeline,
} from "@/lib/api";

const perks = [
  { icon: CalendarCheck, label: "Callback within 1 working day" },
  { icon: UserCog, label: "Senior engineer, not a call centre" },
  { icon: FileText, label: "Scoped written proposal" },
];

/** The service options, as resolved by the page — DB-backed when the API is
 *  up, static fallback otherwise. Passed in rather than imported so the
 *  dropdown always matches the cards rendered above it. */
export interface IndustrialFormOption {
  id: string;
  title: string;
}

export function IndustrialConsultationForm({
  options = [],
  serviceId: controlledServiceId,
  onServiceIdChange,
  anchorId = "book",
  compact,
}: {
  options?: IndustrialFormOption[];
  /** Supply both to drive the selection from outside — the capability cards
   *  above the form set it when their booking button is pressed. Left out, the
   *  form owns the selection as it always did. */
  serviceId?: string;
  onServiceIdChange?: (id: string) => void;
  /** Scroll target. Overridable so this form and the consultancy one can share
   *  a page without two `id="book"` in one document. */
  anchorId?: string;
  /** Single column, no pitch panel, no paired field rows — for a half-width
   *  slot like the home page's form pair. */
  compact?: boolean;
}) {
  const [ownServiceId, setOwnServiceId] = useState(options[0]?.id ?? "");
  const serviceId = controlledServiceId ?? ownServiceId;
  const setServiceId = onServiceIdChange ?? setOwnServiceId;
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sector, setSector] = useState<IndustrialSector>(INDUSTRIAL_SECTORS[0]);
  const [scope, setScope] = useState<IndustrialScope>(INDUSTRIAL_SCOPES[0]);
  const [timeline, setTimeline] = useState<IndustrialTimeline>(INDUSTRIAL_TIMELINES[0]);
  const [siteLocation, setSiteLocation] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const selected = options.find((o) => o.id === serviceId);

  const submit = async () => {
    if (company.trim().length < 2) {
      toast.error("Please add your company name");
      return;
    }
    if (contactName.trim().length < 2 || phone.trim().length < 6) {
      toast.error("Please add a contact name & phone");
      return;
    }
    setBusy(true);
    try {
      await submitIndustrialLead({
        // Omitted when the page had no options to offer, so the backend
        // stores the enquiry unlinked rather than against an empty id.
        industrialServiceId: serviceId || undefined,
        serviceName: selected?.title ?? "General industrial enquiry",
        company: company.trim(),
        contactName: contactName.trim(),
        designation: designation.trim(),
        phone: phone.trim(),
        email: email.trim(),
        sector,
        scope,
        timeline,
        // `load` and `budget` are no longer asked for — both are optional on
        // the backend and land as "", so existing leads keep their values and
        // the admin's Connected load row still reads correctly for those.
        siteLocation: siteLocation.trim(),
        notes: details.trim(),
      });
      setSent(true);
    } catch {
      toast.error("Couldn't send your enquiry — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id={anchorId}
      className={cn(
        "grid scroll-mt-24 grid-cols-1 gap-0 overflow-hidden rounded-3xl border border-zup-body/6",
        // The outer max-width belongs to the wide layout only; in a half-width
        // column the parent already sets the width.
        compact ? "" : "mx-auto max-w-[1120px] md:grid-cols-2",
      )}
    >
      {compact ? (
        <div className="bg-white px-6 pt-7 sm:px-8">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
            Industrial clients
          </span>
          <h2 className="mt-2 text-[22px] font-bold tracking-[-0.02em]">
            Book Residential and Industrial Consultation
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-zup-gray">
            Share your plant details and we will prepare a scoped technical proposal.
          </p>
        </div>
      ) : (
      <div className="flex flex-col gap-5 px-6 py-8 sm:px-9 sm:py-10">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
            Industrial clients
          </span>
          <h2 className="mt-2 text-[26px] font-bold tracking-[-0.02em]">
            Book Residential and Industrial Consultation
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-zup-gray">
            Share your plant details and we will prepare a scoped technical proposal.
          </p>
          <div className="mt-3 h-[3px] w-14 rounded-full bg-zup-orange" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          {perks.map((perk) => (
            <div
              key={perk.label}
              className="flex items-center gap-2.5 text-[13.5px] font-semibold text-zup-mid"
            >
              <perk.icon className="h-4 w-4 flex-none text-zup-orange" strokeWidth={2} aria-hidden />
              {perk.label}
            </div>
          ))}
        </div>
        <p className="mt-auto text-[12.5px] leading-relaxed text-zup-soft">
          Looking for home or small-business service instead?{" "}
          <a href="/services" className="font-semibold text-zup-blue underline-offset-2 hover:underline">
            Book a home service →
          </a>
        </p>
      </div>
      )}

      <form
        className={cn(
          "flex flex-col gap-4 px-6 py-8 sm:px-9 sm:py-10",
          compact ? "bg-white sm:px-8" : "bg-[#FAFBFC]",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !sent) void submit();
        }}
      >
        {sent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-13 w-13 items-center justify-center rounded-full bg-[rgba(76,175,80,.12)] text-2xl text-[#2E7D32]">
              ✓
            </div>
            <p className="text-[15px] font-semibold">Enquiry received</p>
            <p className="max-w-[280px] text-[13.5px] text-zup-gray">
              Our industrial engineering team will call {phone} to scope your project.
            </p>
          </div>
        ) : (
          <>
            {options.length > 0 ? (
              <Field label="Service required">
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className={inputCls}
                >
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className={cn("grid grid-cols-1 gap-4", !compact && "sm:grid-cols-2")}>
              <Field label="Company">
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Organisation name"
                  className={inputCls}
                />
              </Field>
              <Field label="Sector">
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value as IndustrialSector)}
                  className={inputCls}
                >
                  {INDUSTRIAL_SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className={cn("grid grid-cols-1 gap-4", !compact && "sm:grid-cols-2")}>
              <Field label="Contact person">
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </Field>
              <Field label="Designation">
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Plant Manager"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className={cn("grid grid-cols-1 gap-4", !compact && "sm:grid-cols-2")}>
              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  inputMode="tel"
                  type="tel"
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className={cn("grid grid-cols-1 gap-4", !compact && "sm:grid-cols-2")}>
              <Field label="Project scope">
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as IndustrialScope)}
                  className={inputCls}
                >
                  {INDUSTRIAL_SCOPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Timeline">
                <select
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value as IndustrialTimeline)}
                  className={inputCls}
                >
                  {INDUSTRIAL_TIMELINES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Site location">
              <input
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="District / area"
                className={inputCls}
              />
            </Field>

            <Field label="Project details">
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Existing setup, redundancy needs, compliance requirements…"
                rows={3}
                className={`${inputCls} resize-y`}
              />
            </Field>

            <button
              type="submit"
              disabled={busy}
              className="mt-1 min-h-13 rounded-full bg-zup-orange text-sm font-bold uppercase tracking-[0.03em] text-white shadow-[0_8px_22px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark disabled:opacity-60"
            >
              {busy ? "Sending…" : "Request Consultation →"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

const inputCls =
  "min-h-11 w-full rounded-xl border border-zup-body/12 bg-white px-3.5 py-2.5 text-[14.5px] outline-none transition-colors focus:border-zup-blue";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-zup-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
