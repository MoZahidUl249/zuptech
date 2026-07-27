"use client";

import { useState } from "react";
import { toast } from "sonner";
import { submitContactMessage } from "@/lib/api";

export function ContactForm({ heading }: { heading: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2 || !phone.trim()) {
      toast.error("Please add your name & phone");
      return;
    }
    if (text.trim().length < 5) {
      toast.error("Please tell us a bit more about what you need");
      return;
    }
    setBusy(true);
    try {
      await submitContactMessage({
        name: name.trim(),
        phone: phone.trim(),
        // Optional — lets us reply by email when a phone call doesn't connect.
        ...(email.trim() ? { email: email.trim() } : {}),
        message: text.trim(),
      });
      setSent(true);
    } catch {
      toast.error("Couldn't send your message — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <div className="flex h-13 w-13 items-center justify-center rounded-full bg-[rgba(76,175,80,.12)] text-2xl text-[#2E7D32]">
          ✓
        </div>
        <p className="text-[15px] font-bold">Message sent</p>
        <p className="max-w-[320px] text-[13.5px] leading-relaxed text-zup-gray">
          Our team will get back to you shortly — usually the same working day.
        </p>
      </div>
    );
  }

  return (
    <>
      <h2
        id="contact-form"
        className="text-[19px] font-bold tracking-[-0.02em]"
      >
        {heading}
      </h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-zup-gray">
        Tell us what you need and the right engineer will pick it up. Fields
        marked * are required.
      </p>
      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        {/* Visible labels, not placeholder-only: placeholders vanish on focus,
            which is exactly when someone tabbing through a form needs them. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField htmlFor="msg-name" label="Your name *">
            <input
              id="msg-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={FIELD}
            />
          </FormField>
          <FormField htmlFor="msg-phone" label="Phone *">
            <input
              id="msg-phone"
              autoComplete="tel"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              className={FIELD}
            />
          </FormField>
        </div>
        <FormField htmlFor="msg-email" label="Email">
          <input
            id="msg-email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            inputMode="email"
            className={FIELD}
          />
        </FormField>
        <FormField htmlFor="msg-text" label="What do you need? *">
          <textarea
            id="msg-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Site, load, timeline — or just ask a question."
            rows={5}
            className={`${FIELD} resize-y`}
          />
        </FormField>
        <button
          type="submit"
          disabled={busy}
          className="mt-1 min-h-13 rounded-full bg-zup-blue text-[15px] font-bold text-white shadow-[0_8px_22px_rgba(21,101,192,.22)] transition-colors hover:bg-zup-blue-dark disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send message"}
        </button>
        <p className="text-center text-[12px] leading-relaxed text-zup-soft">
          We use your details only to answer this enquiry.
        </p>
      </form>
    </>
  );
}

const FIELD =
  "w-full rounded-xl border border-zup-body/10 bg-white px-[15px] py-[13px] text-base outline-none transition-colors focus:border-zup-blue";

function FormField({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-bold uppercase tracking-[0.06em] text-zup-soft"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
