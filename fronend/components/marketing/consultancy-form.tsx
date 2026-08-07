"use client";

import { useState } from "react";
import { toast } from "sonner";
import { submitLead } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Bookable services, resolved by the page from GET /api/services. The ids
 *  are real Service.id values — POST /api/leads 404s on anything else, which
 *  is what this form used to trip over by sending a display label. */
export interface ConsultancyFormOption {
  id: string;
  title: string;
}

export function ConsultancyForm({
  options = [],
  serviceId: controlledServiceId,
  onServiceIdChange,
  anchorId = "book",
  compact,
}: {
  options?: ConsultancyFormOption[];
  /** Supply both to drive the selection from outside — the service cards above
   *  the form set it when their booking button is pressed. Left out, the form
   *  owns the selection as it always did. */
  serviceId?: string;
  onServiceIdChange?: (id: string) => void;
  /** Scroll target. Overridable because the home page renders this form and
   *  the industrial one on the same document, and two `id="book"` is invalid
   *  HTML — `getElementById` would only ever find the first. */
  anchorId?: string;
  /** Single column, no pitch panel — for a half-width slot like the home
   *  page's form pair, where the two-panel card would fold to ~180px halves. */
  compact?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [ownServiceId, setOwnServiceId] = useState(options[0]?.id ?? "");
  const serviceId = controlledServiceId ?? ownServiceId;
  const setServiceId = onServiceIdChange ?? setOwnServiceId;
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
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: details.trim(),
      });
      setSent(true);
    } catch {
      toast.error("Couldn't send your request — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // One column, always. This used to be a two-panel card with a pitch —
    // eyebrow, standfirst, three promises — filling the half beside the fields.
    // With that copy gone there is nothing to put there, and a form with an
    // empty panel next to it looks broken rather than spacious. `compact` now
    // only trims the scale for the home page's narrower slot.
    <div
      id={anchorId}
      className={cn(
        "flex scroll-mt-24 flex-col overflow-hidden rounded-3xl border border-zup-body/6 bg-white",
        !compact && "mx-auto max-w-[620px]",
      )}
    >
      <div className={cn("px-6 pt-7 sm:px-8", !compact && "sm:px-9 sm:pt-9")}>
        <h2 className={cn("font-bold tracking-[-0.02em]", compact ? "text-[22px]" : "text-[26px]")}>
          Book our services
        </h2>
        <div className="mt-3 h-[3px] w-14 rounded-full bg-zup-orange" aria-hidden />
      </div>

      <form
        className={cn(
          "flex flex-col gap-4 px-6 py-7 sm:px-8",
          !compact && "sm:px-9 sm:py-8",
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
            <Field label="Email (optional)">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
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
            <Field label="Address">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Where is the site?"
                className={inputCls}
              />
            </Field>
            <Field label="Details">
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything we should know before we call"
                rows={3}
                className={`${inputCls} resize-y`}
              />
            </Field>
            <button
              type="submit"
              disabled={busy || unavailable}
              className="mt-1 min-h-13 rounded-full bg-zup-orange text-sm font-bold uppercase tracking-[0.03em] text-white shadow-[0_8px_22px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark disabled:opacity-60"
            >
              {busy ? "Sending…" : "Book our services →"}
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
