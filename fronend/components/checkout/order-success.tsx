"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound } from "lucide-react";
import { ApiError, claimAccount, getMe } from "@/lib/api";
import { setCustomer } from "@/lib/customer";
import { formatBDT } from "@/lib/site";
import { Field, inputCls } from "./field";

export interface PlacedOrderState {
  orderId: string;
  total: number;
  pay: string;
  phone: string;
  /** Guests get the account-claim offer; signed-in customers already have one. */
  wasGuest: boolean;
}

export function OrderSuccess({ order }: { order: PlacedOrderState }) {
  return (
    <main className="mx-auto max-w-[480px] px-5 pt-16 text-center">
      <div className="zup-pop mx-auto mb-5.5 flex h-18 w-18 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
        <CheckCircle2 className="h-9 w-9" strokeWidth={2} aria-hidden />
      </div>
      <h1 className="mb-2.5 text-[28px] font-bold tracking-[-0.025em]">Order placed</h1>
      <p className="mb-2 text-[15px] leading-relaxed text-zup-gray">
        Order <strong>{order.orderId}</strong> · {formatBDT(order.total)}
      </p>
      <p className="mb-7 text-sm leading-relaxed text-zup-gray">
        We&apos;ll confirm by phone at <strong>{order.phone}</strong> before dispatch.{" "}
        {order.pay === "Cash on Delivery"
          ? "Keep the amount ready — pay on delivery."
          : `A ${order.pay} payment request will follow.`}
      </p>

      {order.wasGuest ? <ClaimAccount phone={order.phone} /> : null}

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-full bg-zup-blue px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-zup-blue-dark"
        >
          Continue shopping
        </Link>
        <Link
          href="/account"
          className="rounded-full border border-zup-body/14 bg-white px-7 py-3.5 text-[15px] font-semibold text-zup-body transition-colors hover:bg-secondary"
        >
          Track order
        </Link>
      </div>
      <div className="h-24" />
    </main>
  );
}

/**
 * Turn the guest's order into an account, right here.
 *
 * This screen used to claim "an account was created with {phone} — go to the
 * Account page and set a password", which was false: guest checkout writes a
 * Customer row but no sign-in account, and there was no flow anywhere to add a
 * password to one. The customer was sent to a dead end. Now the offer is real
 * — POST /api/auth/claim sets the password on the number they just used and
 * signs them in.
 */
function ClaimAccount({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      setError("Pick a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claimAccount(phone, password, email.trim() || undefined);
      // Refresh the shared store so the header avatar and /account agree
      // immediately — claim signs the customer in via a session cookie.
      setCustomer(await getMe());
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't set your password — please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mb-6 rounded-[14px] border border-ok-fg/20 bg-ok-bg px-4 py-3.5 text-left text-[13.5px] leading-relaxed text-ok-fg">
        You&apos;re signed in. Next time your details fill in automatically — and you
        can check on this order any time from the Account page.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] border border-zup-body/7 bg-white px-4 py-3.5 text-left transition-colors hover:bg-secondary"
      >
        <KeyRound className="h-5 w-5 flex-none text-zup-blue" strokeWidth={1.8} aria-hidden />
        <span className="text-[13px] leading-normal text-zup-mid">
          <strong className="text-zup-body">Save my details</strong> — set a password for{" "}
          {phone} and skip the form next time.
        </span>
      </button>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-3.5 rounded-[14px] border border-zup-body/7 bg-white px-4 py-4 text-left">
      <p className="text-[13.5px] leading-relaxed text-zup-mid">
        Set a password for <strong>{phone}</strong>. Next time, ordering takes two taps.
      </p>
      <Field id="claim-password" label="Choose a password" error={error ?? undefined}>
        {(props) => (
          <input
            {...props}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className={inputCls(Boolean(error))}
          />
        )}
      </Field>
      <Field
        id="claim-email"
        label="Email"
        optional
        hint="Only used if you ever forget your password."
      >
        {(props) => (
          <input
            {...props}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputCls()}
          />
        )}
      </Field>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="min-h-12 cursor-pointer rounded-[14px] bg-zup-ink text-[15px] font-bold text-white transition-colors hover:bg-zup-body disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save my details"}
      </button>
    </div>
  );
}
