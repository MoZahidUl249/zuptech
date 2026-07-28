"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { composeAddress, stripComposedAddress } from "@/lib/address";
import { ApiError, placeOrder } from "@/lib/api";
import { usePaymentOptions } from "@/lib/admin-bridge";
import { useCart } from "@/lib/cart";
import {
  clearDraft,
  EMPTY_DRAFT as EMPTY_FORM,
  readDraft,
  writeDraft,
  type CheckoutDraft as Draft,
} from "@/lib/checkout-draft";
import { useCustomer } from "@/lib/customer";
import { setAuthPhone } from "@/lib/orders";
import { cartToItems, useQuote } from "@/lib/quote";
import { formatBDT } from "@/lib/site";
import { useDeliveryZone } from "@/lib/zone";
import { CustomerFields, normalizePhone, validateCustomer } from "./customer-fields";
import { DeliveryFields, validateDelivery } from "./delivery-fields";
import { OrderSuccess, type PlacedOrderState } from "./order-success";
import { OrderSummary } from "./order-summary";
import { PaymentPicker } from "./payment-picker";
import { SavedDetailsCard } from "./saved-details-card";

/**
 * Checkout.
 *
 * One page, one button. This was three numbered steps with its own back
 * navigation and a `step` integer that a refresh reset to 1, throwing away
 * everything typed. Steps bought nothing — the whole form fits on a phone
 * screen — and cost a customer three chances to abandon.
 *
 * Two shapes, same submit:
 *
 *   Signed in — nothing to fill in. Name, phone, address and zone come from
 *     the account, shown as a card to confirm. Two taps from cart to placed.
 *   Guest — three labelled blocks on one scrolling page, drafted to
 *     localStorage so leaving and coming back is safe.
 */
export function CheckoutFlow() {
  const { cart, count, clear } = useCart();
  const router = useRouter();
  const customer = useCustomer(); // undefined = still checking the session
  const payDefs = usePaymentOptions();

  // The zone is deliberately NOT seeded from the profile. It already persists
  // from the cart (lib/zone.ts), and the cart is where the customer last saw a
  // price for it — silently switching zones at checkout would change the total
  // out from under them. The profile's `insideDhaka` is only a record of what
  // they last used, which is the same thing this store already holds.
  const [insideDhaka, setInsideDhaka] = useDeliveryZone();

  const [form, setForm] = useState<Draft>(EMPTY_FORM);
  const [payChoice, setPayChoice] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [done, setDone] = useState<PlacedOrderState | null>(null);

  const signedIn = Boolean(customer);
  const { name, phone, address, landmark } = form;
  const set = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));

  // Seed the form once the session answer arrives — from the account when
  // signed in, from the saved draft otherwise.
  //
  // Adjusted during render rather than in an effect: an effect would paint an
  // empty form first and then fill it in, and React re-runs this render before
  // committing anything. Keyed on identity so a later profile refresh (the
  // customer store reloads on window focus) can't overwrite what is currently
  // being typed.
  const seedKey =
    customer === undefined ? null : customer ? `account:${customer.id}` : "guest";
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey && seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (customer) {
      // The saved address is stored composed ("… (Landmark: …)"), so split it
      // back out — otherwise editing and re-saving stacks the suffix.
      const saved = stripComposedAddress(customer.address);
      setForm({
        name: customer.name,
        phone: customer.phone,
        address: saved.address,
        landmark: saved.landmark,
      });
      // An account with no address yet has nothing to confirm — open the form
      // rather than showing an empty card.
      if (!saved.address) setEditing(true);
    } else {
      setForm(readDraft());
    }
  }

  // Keep the guest draft current. Signed-in details belong to the account and
  // are saved deliberately via `saveAddress`, never silently to localStorage.
  useEffect(() => {
    if (!seededFor || signedIn) return;
    writeDraft(form);
  }, [seededFor, signedIn, form]);

  // Keep the selection valid if the admin disables the chosen method.
  const pay =
    payChoice && payDefs.some((p) => p.label === payChoice)
      ? payChoice
      : (payDefs[0]?.label ?? "Cash on Delivery");

  const { quote, error: quoteError } = useQuote(cartToItems(cart), insideDhaka);

  const submit = async () => {
    // Validate what the customer can actually change. A signed-in customer's
    // phone is the login identity — not editable here, and the server takes it
    // from the session regardless — so it is never in question.
    const found: Record<string, string> = {
      ...validateCustomer(name, signedIn ? customer!.phone : phone),
      ...validateDelivery(address),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Open the card so the customer can see the field being complained about.
      if (signedIn) setEditing(true);
      return;
    }

    setPlacing(true);
    setOrderError(null);
    try {
      const composed = composeAddress(address, landmark);

      // No amounts are sent — the server recomputes every total from its
      // catalog and returns the authoritative order.
      const order = await placeOrder({
        // Signed in: identity comes from the session cookie. Only send what
        // the customer actually changed for this order.
        ...(signedIn
          ? { name, address: composed, saveAddress }
          : { name, phone: normalizePhone(phone), address: composed }),
        insideDhaka,
        pay,
        items: cartToItems(cart),
      });

      const usedPhone = signedIn ? customer!.phone : normalizePhone(phone);
      // Remember the phone locally only to prefill the account sign-in form.
      setAuthPhone(usedPhone);
      clearDraft();
      setDone({
        orderId: order.orderId,
        total: order.total,
        pay,
        phone: usedPhone,
        wasGuest: !signedIn,
      });
      clear();
      window.scrollTo(0, 0);
    } catch (err) {
      setOrderError(
        err instanceof ApiError ? err.message : "Couldn't place the order — please try again.",
      );
    } finally {
      setPlacing(false);
    }
  };

  if (done) return <OrderSuccess order={done} />;

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
          onClick={() => router.push("/cart")}
          className="cursor-pointer py-1.5 text-sm font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
        >
          ← Back to cart
        </button>
      </div>

      {signedIn ? (
        <>
          <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">
            Hi {customer!.name.split(" ")[0]} 👋
          </h1>
          <p className="mb-5 text-sm text-zup-gray">
            Check your details and place the order.
          </p>

          <Block n={1} title="Deliver to">
            <SavedDetailsCard
              name={name}
              phone={customer!.phone}
              address={address}
              landmark={landmark}
              insideDhaka={insideDhaka}
              editing={editing}
              saveAddress={saveAddress}
              errors={errors}
              onEdit={() => setEditing(true)}
              onNameChange={(v) => set({ name: v })}
              onAddressChange={(v) => set({ address: v })}
              onLandmarkChange={(v) => set({ landmark: v })}
              onZoneChange={setInsideDhaka}
              onSaveAddressChange={setSaveAddress}
            />
          </Block>
        </>
      ) : (
        <>
          <h1 className="mb-1.5 text-[26px] font-bold tracking-[-0.02em]">Checkout</h1>
          <p className="mb-5 text-sm text-zup-gray">
            No account needed — just three quick things.
          </p>

          <Block n={1} title="Who are you?">
            <CustomerFields
              name={name}
              phone={phone}
              onNameChange={(v) => set({ name: v })}
              onPhoneChange={(v) => set({ phone: v })}
              errors={errors}
            />
          </Block>

          <Block n={2} title="Where should we deliver?">
            <DeliveryFields
              insideDhaka={insideDhaka}
              address={address}
              landmark={landmark}
              onZoneChange={setInsideDhaka}
              onAddressChange={(v) => set({ address: v })}
              onLandmarkChange={(v) => set({ landmark: v })}
              errors={errors}
            />
          </Block>
        </>
      )}

      <Block n={signedIn ? 2 : 3} title="How will you pay?">
        <PaymentPicker options={payDefs} value={pay} onChange={setPayChoice} />
      </Block>

      <div className="mb-4.5">
        <OrderSummary
          quote={quote}
          error={quoteError}
          count={count}
          insideDhaka={insideDhaka}
        />
      </div>

      {orderError ? (
        <p className="mb-3 text-[13px] font-medium text-destructive" role="alert">
          {orderError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={placing || quote?.total == null}
        className="min-h-[54px] w-full cursor-pointer rounded-[14px] bg-zup-orange text-base font-bold text-white shadow-[0_8px_22px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {placing
          ? "Placing order…"
          : `Place order${quote?.total != null ? ` — ${formatBDT(quote.total)}` : ""}`}
      </button>
      <div className="h-30" />
    </main>
  );
}

/** A numbered section. The numbers replace the old step navigation: they show
 *  how much is left without splitting the page into screens. */
function Block({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.01em]">
        <span
          className="flex h-6.5 w-6.5 flex-none items-center justify-center rounded-full bg-zup-ink text-[12.5px] font-extrabold text-white"
          aria-hidden
        >
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
