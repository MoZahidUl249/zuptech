"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, UserCog, FileText } from "lucide-react";
import { submitLead } from "@/lib/api";

const perks = [
  { icon: CalendarCheck, label: "Callback within 1 working day" },
  { icon: UserCog, label: "Senior engineer, not a call centre" },
  { icon: FileText, label: "Scoped written proposal" },
];

/** Bookable services, resolved by the page from GET /api/services. The ids
 *  are real Service.id values — POST /api/leads 404s on anything else, which
 *  is what this form used to trip over by sending a display label. */
export interface ConsultancyFormOption {
  id: string;
  title: string;
}

export function ConsultancyForm({ options = [] }: { options?: ConsultancyFormOption[] }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [serviceId, setServiceId] = useState(options[0]?.id ?? "");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // With no catalogue there is no valid serviceId to send, so booking is
  // closed rather than silently failing on submit.
  const unavailable = options.length === 0;

  const submit = async () => {
    if (name.trim().length < 2 || !phone.trim()) {
      toast.error("Please add your name & phone");
      return;
    }
    if (!serviceId) {
      toast.error("Please choose a service");
      return;
    }
    setBusy(true);
    try {
      await submitLead({
        serviceId,
        customer: name.trim(),
        city: city.trim() || "Not given",
        phone: phone.trim(),
        notes: [
          company.trim() ? `Company: ${company.trim()}` : null,
          email.trim() ? `Email: ${email.trim()}` : null,
          details.trim() || null,
        ]
          .filter(Boolean)
          .join(" — "),
      });
      setSent(true);
    } catch {
      toast.error("Couldn't send your request — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-3xl border border-zup-body/6 md:grid-cols-2">
      <div className="flex flex-col gap-5 px-6 py-8 sm:px-9 sm:py-10">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-zup-orange">
            Book a consultation
          </span>
          <h2 className="mt-2 text-[26px] font-bold tracking-[-0.02em]">Try Our Consultancy</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-zup-gray">
            Tell us about your site and load profile. A senior engineer calls you back within
            one working day.
          </p>
          <div className="mt-3 h-[3px] w-14 rounded-full bg-zup-orange" aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          {perks.map((perk) => (
            <div key={perk.label} className="flex items-center gap-2.5 text-[13.5px] font-semibold text-zup-mid">
              <perk.icon className="h-4 w-4 flex-none text-zup-orange" strokeWidth={2} aria-hidden />
              {perk.label}
            </div>
          ))}
        </div>
      </div>

      <form
        className="flex flex-col gap-4 bg-[#FAFBFC] px-6 py-8 sm:px-9 sm:py-10"
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
            <p className="text-[15px] font-semibold">Request received</p>
            <p className="max-w-[280px] text-[13.5px] text-zup-gray">
              We&apos;ll call {phone} within one working day.
            </p>
          </div>
        ) : (
          <>
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className={inputCls}
              />
            </Field>
            <Field label="Company">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Organisation"
                className={inputCls}
              />
            </Field>
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
            <Field label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Where is the site?"
                className={inputCls}
              />
            </Field>
            <Field label="What do you need?">
              {unavailable ? (
                <p className="text-[13.5px] text-zup-gray">
                  Our service list is unavailable right now — please{" "}
                  <a href="/contact" className="font-semibold text-zup-blue underline-offset-2 hover:underline">
                    contact us
                  </a>{" "}
                  instead.
                </p>
              ) : (
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
              )}
            </Field>
            <Field label="Site & load details">
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Location, connected load, timeline…"
                rows={3}
                className={`${inputCls} resize-y`}
              />
            </Field>
            <button
              type="submit"
              disabled={busy || unavailable}
              className="mt-1 min-h-13 rounded-full bg-zup-orange text-sm font-bold uppercase tracking-[0.03em] text-white shadow-[0_8px_22px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark disabled:opacity-60"
            >
              {busy ? "Sending…" : "Book a Consultation →"}
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
