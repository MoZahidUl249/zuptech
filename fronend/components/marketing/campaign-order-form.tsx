"use client";

import { useMemo, useState } from "react";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { formatBDTBangla as formatBDT, toBanglaDigits } from "@/lib/site";
import type { CampaignBundle, CampaignFormLabels } from "@/lib/api";

/**
 * The campaign page's own cash-on-delivery form.
 *
 * A direct-response page lives or dies on not navigating: someone arriving
 * from an ad fills this in where they landed rather than being sent to the
 * cart and then to /checkout. It posts to the same `POST /api/orders` the rest
 * of the site uses, so there is no second order path to keep correct — and the
 * server reprices from the catalogue either way, which is why the totals shown
 * here are safe to display: they come from the bundle ladder the server
 * derived, not from anything typed into the campaign.
 */
export function CampaignOrderForm({
  productId,
  bundles,
  labels,
  title,
  intro,
  deliveryFee,
  unitLabel,
  campaignSlug,
  payMethod,
  productName,
}: {
  productId: string;
  bundles: CampaignBundle[];
  labels: CampaignFormLabels;
  title: string;
  intro: string;
  deliveryFee: number;
  unitLabel: string;
  /** Attributes the order to this campaign, so its sales can be counted. */
  campaignSlug: string;
  /** For analytics only — an id in a GA4 report is unreadable. */
  productName: string;
  /**
   * The payment method to place the order under, resolved on the server from
   * the enabled list.
   *
   * This used to be the literal string "Cash on Delivery". Checkout resolves
   * a method BY NAME, so renaming that row in the admin — or disabling it —
   * broke every campaign order form silently and permanently, with the
   * failure surfacing only as a 400 to a customer mid-purchase. Empty means
   * nothing is enabled, and the form says so instead of posting a guess.
   */
  payMethod: string;
}) {
  // Default to the best-value row the campaign offers, not the smallest — the
  // bundle ladder exists to lift order value and the page already argues for it.
  const [qty, setQty] = useState(bundles[bundles.length - 1]?.qty ?? 1);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = useMemo(
    () => bundles.find((b) => b.qty === qty) ?? bundles[0],
    [bundles, qty],
  );
  const delivery = deliveryFee * qty;
  const total = (chosen?.total ?? 0) + delivery;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(labels.name);
    if (!form.phone.trim()) return setError(labels.phone);
    if (form.address.trim().length < 8) return setError(labels.address);

    setError(null);
    setBusy(true);
    trackBeginCheckout(
      [{ item_id: productId, item_name: productName, price: chosen.unitPrice, quantity: qty }],
      chosen.total,
    );
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          insideDhaka: true,
          pay: payMethod,
          items: [{ productId, qty }],
          landingPageSlug: campaignSlug,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        // The server's message is the useful one (out of stock, bad phone) —
        // showing our own generic line here would hide it.
        setError(body?.error ?? "Something went wrong");
        return;
      }
      /* The campaign's own funnel. Same event names as the storefront, so a
         GA4 report covers both without a second set of tags — the campaign is
         distinguishable by page_location, not by a different vocabulary. */
      trackPurchase(String(body.orderId), Number(body.total ?? chosen.total), [
        { item_id: productId, item_name: productName, price: chosen.unitPrice, quantity: qty },
      ]);
      setDone(body.orderId as string);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-zup-line bg-white p-6 text-center">
        <p className="text-[17px] font-bold text-zup-ink">{labels.successMessage}</p>
        <p className="mt-2 font-mono text-[15px] text-zup-blue">{done}</p>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-zup-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-zup-blue";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-zup-line bg-white p-5 sm:p-6">
      {title ? <h3 className="text-[17px] font-bold text-zup-ink">{title}</h3> : null}
      {intro ? <p className="mt-1.5 text-[14px] leading-relaxed text-zup-gray">{intro}</p> : null}

      <div className="mt-5 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-zup-body">{labels.name}</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={labels.namePlaceholder}
            className={field}
            autoComplete="name"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-zup-body">{labels.phone}</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder={labels.phonePlaceholder}
            className={field}
            inputMode="tel"
            autoComplete="tel"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-zup-body">{labels.address}</span>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={labels.addressPlaceholder}
            rows={3}
            className={`${field} resize-none`}
            autoComplete="street-address"
          />
        </label>
      </div>

      {bundles.length > 1 ? (
        <fieldset className="mt-5">
          <legend className="mb-2 text-[13px] font-semibold text-zup-body">
            {labels.packageLabel}
          </legend>
          <div className="flex flex-col gap-2">
            {bundles.map((b) => (
              <label
                key={b.qty}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${
                  b.qty === qty ? "border-zup-blue bg-zup-blue/5" : "border-zup-line bg-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="bundle"
                    checked={b.qty === qty}
                    onChange={() => setQty(b.qty)}
                    className="h-4 w-4 accent-zup-blue"
                  />
                  <span className="text-[15px] font-semibold text-zup-ink">
                    {toBanglaDigits(b.qty)} {unitLabel}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {b.saving > 0 ? (
                    <span className="text-[13px] text-zup-soft line-through">
                      {formatBDT(b.wasTotal)}
                    </span>
                  ) : null}
                  <span className="text-[15px] font-bold text-zup-ink">{formatBDT(b.total)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <dl className="mt-5 flex flex-col gap-1.5 border-t border-zup-line pt-4 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-zup-gray">{labels.deliveryLabel}</dt>
          <dd className="font-semibold text-zup-body">{formatBDT(delivery)}</dd>
        </div>
        <div className="flex justify-between text-[17px]">
          <dt className="font-bold text-zup-ink">{labels.totalLabel}</dt>
          <dd className="font-bold text-zup-ink">{formatBDT(total)}</dd>
        </div>
      </dl>

      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] font-semibold text-zup-orange">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !payMethod}
        data-cta="order_form"
        className="mt-4 w-full rounded-full bg-zup-orange px-5 py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-zup-orange-dark disabled:opacity-60"
      >
        {busy ? "…" : labels.submit}
      </button>
    </form>
  );
}
