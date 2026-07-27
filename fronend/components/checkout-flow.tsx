"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, MapPin, Landmark } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatBDT } from "@/lib/site";
import { cartToItems, useQuote } from "@/lib/quote";
import { setAuthPhone } from "@/lib/orders";
import { usePaymentOptions } from "@/lib/admin-bridge";
import { useDeliveryZone } from "@/lib/zone";
import { ZonePicker } from "@/components/zone-picker";
import { cn } from "@/lib/utils";

interface DoneState {
  orderId: string;
  total: number;
  pay: string;
  phone: string;
}

export function CheckoutFlow() {
  const { cart, count, clear } = useCart();
  // Payment options come from the admin panel's Payments section (enabled
  // methods), falling back to the standard trio.
  const payDefs = usePaymentOptions();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  // Delivery zone. The backend prices delivery/installation as a two-tier
  // inside/outside-Dhaka boolean (POST /api/pricing/quote, POST /api/orders),
  // so this is the one input those endpoints need.
  const [insideDhaka, setInsideDhaka] = useDeliveryZone();
  const [payChoice, setPayChoice] = useState<string | null>(null);
  const [error, setError] = useState<1 | 2 | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState(false);

  // Keep the selection valid if the admin disables the chosen method.
  const pay =
    payChoice && payDefs.some((p) => p.label === payChoice)
      ? payChoice
      : (payDefs[0]?.label ?? "Cash on Delivery");

  // Subtotal, delivery fee and total are computed by the server for the
  // selected zone — the client only renders them (see cal-bk.md).
  const { quote, error: quoteError } = useQuote(cartToItems(cart), insideDhaka);

  const toStep2 = () => {
    const ok = name.trim().length > 1 && /^01\d{9}$/.test(phone.replace(/[\s-]/g, ""));
    if (!ok) {
      setError(1);
      return;
    }
    setError(null);
    setStep(2);
    window.scrollTo(0, 0);
  };

  const toStep3 = () => {
    if (address.trim().length <= 3) {
      setError(2);
      return;
    }
    setError(null);
    setStep(3);
    window.scrollTo(0, 0);
  };

  const placeOrder = async () => {
    // No amounts are sent — the server recomputes every total from its
    // catalog and returns the authoritative order.
    setPlacing(true);
    setOrderError(false);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address: landmark.trim() ? `${address.trim()} (Landmark: ${landmark.trim()})` : address.trim(),
          insideDhaka,
          pay,
          items: cartToItems(cart),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const order: { orderId: string; total: number } = await res.json();
      // Remember the phone locally only to prefill the account sign-in form.
      setAuthPhone(phone.replace(/[\s-]/g, ""));
      setDone({ orderId: order.orderId, total: order.total, pay, phone });
      clear();
      window.scrollTo(0, 0);
    } catch {
      setOrderError(true);
    } finally {
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto max-w-[480px] px-5 pt-16 text-center">
        <div className="zup-pop mx-auto mb-5.5 flex h-18 w-18 items-center justify-center rounded-full bg-[rgba(76,175,80,.12)] text-[32px] text-[#2E7D32]">
          ✓
        </div>
        <h1 className="mb-2.5 text-[28px] font-bold tracking-[-0.025em]">
          Order placed
        </h1>
        <p className="mb-2 text-[15px] leading-relaxed text-zup-gray">
          Order <strong>{done.orderId}</strong> · {formatBDT(done.total)}
        </p>
        <p className="mb-7 text-sm leading-relaxed text-zup-gray">
          We&apos;ll confirm by phone at <strong>{done.phone}</strong> before
          dispatch.{" "}
          {done.pay === "Cash on Delivery"
            ? "Keep the amount ready — pay on delivery."
            : `A ${done.pay} payment request will follow.`}
        </p>
        <div className="mb-6 flex items-center gap-2.5 rounded-[14px] border border-zup-body/7 bg-white px-4 py-3.5 text-left">
          <User className="h-5 w-5 flex-none text-zup-blue" strokeWidth={1.8} aria-hidden />
          <span className="text-[13px] leading-normal text-zup-mid">
            An account was created with <strong>{done.phone}</strong>. Go to
            the Account page and set a password for this number to track your
            order anytime.
          </span>
        </div>
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

  if (count === 0) {
    return (
      <main className="mx-auto max-w-[560px] px-5 pt-16 text-center">
        <p className="mb-5 text-[15px] text-zup-gray">
          Your cart is empty — add a product to check out.
        </p>
        <Link
          href="/shop"
          className="inline-block rounded-full bg-zup-blue px-6.5 py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-zup-blue-dark"
        >
          Browse products
        </Link>
        <div className="h-24" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[560px] px-5 pt-7">
      <div className="mb-6 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (step === 1) router.push("/cart");
            else setStep(step - 1);
          }}
          className="py-1.5 text-sm font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
        >
          ← Back
        </button>
        <div className="flex flex-1 gap-[5px]" aria-hidden>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1 flex-1 rounded-full",
                step >= n ? "bg-zup-blue" : "bg-zup-body/10",
              )}
            />
          ))}
        </div>
        <span className="text-[12.5px] font-semibold text-zup-soft">
          Step {step} of 3
        </span>
      </div>

      {step === 1 && (
        <>
          <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">
            Your details
          </h1>
          <p className="mb-5 text-sm text-zup-gray">
            Guest checkout — no account needed.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              toStep2();
            }}
          >
            <label htmlFor="co-name" className="sr-only">
              Full name
            </label>
            <input
              id="co-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              className="rounded-[14px] border border-zup-body/10 bg-white px-4 py-[15px] text-base outline-none transition-colors focus:border-zup-blue"
            />
            <label htmlFor="co-phone" className="sr-only">
              Phone
            </label>
            <input
              id="co-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (01XXXXXXXXX)"
              inputMode="tel"
              type="tel"
              autoComplete="tel"
              className="rounded-[14px] border border-zup-body/10 bg-white px-4 py-[15px] text-base outline-none transition-colors focus:border-zup-blue"
            />
            {error === 1 && (
              <p className="text-[13px] font-medium text-[#D32F2F]" role="alert">
                Please enter your name and a valid 11-digit phone number.
              </p>
            )}
            <button
              type="submit"
              className="mt-1.5 min-h-[54px] rounded-[14px] bg-zup-orange text-base font-bold text-white transition-colors hover:bg-zup-orange-dark"
            >
              Continue to delivery
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">Delivery</h1>
          <p className="mb-5 text-sm text-zup-gray">
            Where should we bring your order?
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              toStep3();
            }}
          >
            <ZonePicker value={insideDhaka} onChange={setInsideDhaka} />

            <div className="flex flex-col gap-2">
              <label htmlFor="co-address" className="text-[13px] font-semibold text-zup-mid">
                Address
              </label>
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute left-4 top-4.5 h-4.5 w-4.5 text-zup-soft"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <textarea
                  id="co-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House/Flat no., Road no., Area — e.g. House 4, Road 7, Dhanmondi"
                  autoComplete="street-address"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-zup-body/10 bg-white py-3.5 pr-4 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12"
                />
              </div>
              <p className="text-[12px] text-zup-faint">
                Include house/flat, road no. and area so our rider can find you.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="co-landmark" className="text-[13px] font-semibold text-zup-mid">
                Landmark <span className="font-normal text-zup-faint">(optional)</span>
              </label>
              <div className="relative">
                <Landmark
                  className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zup-soft"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <input
                  id="co-landmark"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. near Al-Amin Mosque, opposite City Bank"
                  className="w-full rounded-2xl border border-zup-body/10 bg-white py-3.5 pr-4 pl-11.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint focus:border-zup-blue focus:ring-4 focus:ring-zup-blue/12"
                />
              </div>
            </div>

            {error === 2 && (
              <p className="text-[13px] font-medium text-[#D32F2F]" role="alert">
                Please enter your house/road/area so we can deliver your order.
              </p>
            )}
            <button
              type="submit"
              className="mt-1.5 min-h-[54px] rounded-[14px] bg-zup-orange text-base font-bold text-white transition-colors hover:bg-zup-orange-dark"
            >
              Continue to payment
            </button>
          </form>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mb-5 text-[26px] font-bold tracking-[-0.02em]">Payment</h1>
          <div className="mb-5 flex flex-col gap-2.5" role="radiogroup" aria-label="Payment method">
            {payDefs.map((p) => {
              const on = pay === p.label;
              return (
                <button
                  key={p.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPayChoice(p.label)}
                  className={cn(
                    "flex min-h-14 items-center gap-[13px] rounded-2xl border-2 bg-white p-4 text-left",
                    on ? "border-zup-blue" : "border-zup-body/8",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2",
                      on ? "border-zup-blue" : "border-zup-body/25",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        on ? "bg-zup-blue" : "bg-transparent",
                      )}
                    />
                  </span>
                  <span className="flex flex-col gap-px">
                    <span className="text-[15px] font-bold">{p.label}</span>
                    <span className="text-[12.5px] text-zup-soft">{p.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mb-4.5 flex flex-col gap-[7px] rounded-2xl border border-zup-body/6 bg-white px-4.5 py-4">
            <div className="flex justify-between text-[13.5px] text-zup-gray">
              <span>{count} item(s)</span>
              <span>{quote ? formatBDT(quote.subtotal) : "…"}</span>
            </div>
            <div className="flex justify-between text-[13.5px] text-zup-gray">
              <span>Delivery · {insideDhaka ? "Inside Dhaka" : "Outside Dhaka"}</span>
              <span>
                {quote?.deliveryFee == null
                  ? "…"
                  : quote.deliveryFee === 0
                    ? "Free"
                    : formatBDT(quote.deliveryFee)}
              </span>
            </div>
            {quote?.installationFee ? (
              <div className="flex justify-between text-[13.5px] text-zup-gray">
                <span>Installation</span>
                <span>{formatBDT(quote.installationFee)}</span>
              </div>
            ) : null}
            <div className="h-px bg-zup-body/7" />
            <div className="flex justify-between text-base font-extrabold">
              <span>Total</span>
              <span>{quote?.total != null ? formatBDT(quote.total) : "…"}</span>
            </div>
            {quoteError && (
              <p className="text-[12.5px] font-medium text-[#D32F2F]" role="alert">
                Couldn&apos;t load prices from the server — please retry.
              </p>
            )}
          </div>
          {orderError && (
            <p className="mb-3 text-[13px] font-medium text-[#D32F2F]" role="alert">
              Couldn&apos;t place the order — please try again.
            </p>
          )}
          <button
            type="button"
            onClick={placeOrder}
            disabled={placing || quote?.total == null}
            className="min-h-[54px] w-full rounded-[14px] bg-zup-orange text-base font-bold text-white shadow-[0_8px_22px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark disabled:opacity-60"
          >
            {placing
              ? "Placing order…"
              : `Place order${quote?.total != null ? ` — ${formatBDT(quote.total)}` : ""}`}
          </button>
        </>
      )}
      <div className="h-30" />
    </main>
  );
}
