"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/products";
import { formatBDT } from "@/lib/site";
import { cartToItems, useQuote, type QuoteLine } from "@/lib/quote";
import { useDeliveryZone } from "@/lib/zone";
import { ZonePicker } from "@/components/zone-picker";
import { OfferLadder } from "@/components/offer-ladder";
import {
  cartSavings,
  discountReason,
  freeDeliveryState,
  lineSavings,
} from "@/lib/pricing-display";

export function CartView({ products }: { products: Product[] }) {
  const { cart, count, change } = useCart();
  const items = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x): x is { product: Product; qty: number } => !!x.product);

  // Every amount below comes from the server (cal-bk.md). The zone is the one
  // input it needs to price delivery and installation.
  const [insideDhaka, setInsideDhaka] = useDeliveryZone();
  const { quote, error } = useQuote(cartToItems(cart), insideDhaka);
  const lineFor = (id: string) => quote?.lines.find((l) => l.productId === id);

  const savings = quote
    ? cartSavings(quote.lines, (id) => products.find((p) => p.id === id))
    : 0;

  return (
    <main className="mx-auto max-w-[700px] px-5 pt-8">
      <h1 className="mb-5.5 text-3xl font-bold tracking-[-0.025em]">Cart</h1>

      {count === 0 ? (
        <div className="rounded-[2px] border border-zup-body/6 bg-white px-5 py-14 text-center">
          <p className="mb-5 text-[15px] text-zup-gray">Your cart is empty.</p>
          <Link
            href="/products"
            className="inline-block rounded-full bg-zup-blue px-6.5 py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-zup-blue-dark"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {items.map(({ product, qty }) => (
              <li
                key={product.id}
                className="flex items-center gap-3.5 rounded-2xl border border-zup-body/6 bg-white p-3.5"
              >
                {product.photos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.photos[0]}
                    alt={product.name}
                    className="h-16 w-16 flex-none rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className="h-16 w-16 flex-none rounded-xl bg-[repeating-linear-gradient(-45deg,#F1F3F5_0_10px,#F7F8FA_10px_20px)]"
                    role="img"
                    aria-label={product.imgHint}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <Link
                    href={`/products/${product.slug}`}
                    className="text-[14.5px] font-semibold leading-snug text-zup-body hover:text-zup-blue"
                  >
                    {product.name}
                  </Link>
                  <LinePricing product={product} qty={qty} line={lineFor(product.id)} />
                </div>
                <div className="flex items-center gap-0.5 rounded-full border border-zup-body/8 bg-zup-bg p-[3px]">
                  <button
                    type="button"
                    onClick={() => change(product.id, -1)}
                    aria-label={`Decrease quantity of ${product.name}`}
                    className="h-[34px] w-[34px] rounded-full text-[17px] text-zup-mid transition-colors hover:bg-zup-body/5"
                  >
                    −
                  </button>
                  <span className="min-w-5 text-center text-sm font-bold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => change(product.id, 1)}
                    aria-label={`Increase quantity of ${product.name}`}
                    className="h-[34px] w-[34px] rounded-full text-[17px] text-zup-mid transition-colors hover:bg-zup-body/5"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4.5 flex flex-col gap-[9px] rounded-2xl border border-zup-body/6 bg-white px-5 py-4.5">
            <div className="flex justify-between text-sm text-zup-gray">
              <span>Subtotal · {count} item(s)</span>
              <span>{quote ? formatBDT(quote.subtotal) : error ? "—" : "…"}</span>
            </div>

            {savings > 0 ? (
              <div className="flex justify-between text-sm font-semibold text-zup-green-dark">
                <span>You save</span>
                <span>− {formatBDT(savings)}</span>
              </div>
            ) : null}

            <div className="my-1 border-t border-zup-body/7 pt-3">
              <ZonePicker value={insideDhaka} onChange={setInsideDhaka} compact />
            </div>

            <div className="flex justify-between text-sm text-zup-gray">
              <span>Delivery</span>
              <span
                className={quote?.deliveryFee === 0 ? "font-semibold text-zup-green-dark" : ""}
              >
                {quote?.deliveryFee == null
                  ? error
                    ? "—"
                    : "Calculated at checkout"
                  : quote.deliveryFee === 0
                    ? "Free"
                    : formatBDT(quote.deliveryFee)}
              </span>
            </div>

            {quote?.installationFee ? (
              <div className="flex justify-between text-sm text-zup-gray">
                <span>Installation</span>
                <span>{formatBDT(quote.installationFee)}</span>
              </div>
            ) : null}

            <div className="my-[3px] h-px bg-zup-body/7" />
            <div className="flex justify-between text-[17px] font-extrabold">
              <span>Total</span>
              <span>
                {quote?.total != null
                  ? formatBDT(quote.total)
                  : error
                    ? "—"
                    : "Calculated at checkout"}
              </span>
            </div>
            {error && (
              <p className="text-[12.5px] text-zup-soft" role="alert">
                Couldn&apos;t load prices — totals will be confirmed at checkout.
              </p>
            )}
          </div>

          <Link
            href="/checkout"
            className="mt-4 flex min-h-[54px] w-full items-center justify-center rounded-[2px] bg-zup-orange text-base font-bold text-white shadow-[0_8px_22px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark"
          >
            Checkout
          </Link>

          <div className="mt-3.5 flex items-center justify-center gap-2">
            <span className="rounded-[2px] bg-[rgba(194,24,91,.07)] px-2.5 py-[5px] text-[11.5px] font-bold text-[#C2185B]">
              bKash
            </span>
            <span className="rounded-[2px] bg-[rgba(230,81,0,.07)] px-2.5 py-[5px] text-[11.5px] font-bold text-[#E65100]">
              Nagad
            </span>
            <span className="rounded-[2px] bg-zup-body/6 px-2.5 py-[5px] text-[11.5px] font-bold text-zup-mid">
              COD
            </span>
          </div>
        </>
      )}
      <div className="h-24" />
    </main>
  );
}

/**
 * One line's price story: what it costs, what it used to cost, why it dropped,
 * and what one more unit would unlock. Falls back to a plain qty × price
 * estimate while the quote is in flight.
 */
function LinePricing({
  product,
  qty,
  line,
}: {
  product: Product;
  qty: number;
  line: QuoteLine | undefined;
}) {
  if (!line) {
    return (
      <span className="text-sm font-bold">
        {qty} × {formatBDT(product.price)}
      </span>
    );
  }

  const discounted = line.unitPrice < product.price;
  const reason = discountReason(product, line);
  const saved = lineSavings(product, line);
  // Server truth: the fee is actually zero on this line, whatever the tiers say.
  const deliveryFree = freeDeliveryState(product, line).free;

  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-bold">
        {formatBDT(line.lineTotal)}
        {discounted ? (
          <span className="text-[12px] font-medium text-zup-soft line-through">
            {formatBDT(product.price * qty)}
          </span>
        ) : null}
        <span className="text-[12px] font-medium text-zup-faint">
          ({qty} × {formatBDT(line.unitPrice)})
        </span>
      </span>

      {reason || saved > 0 ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {reason ? (
            <span className="rounded-full bg-zup-green/12 px-2 py-[2px] text-[11px] font-bold text-zup-green-dark">
              {reason}
            </span>
          ) : null}
          {saved > 0 ? (
            <span className="text-[11.5px] font-semibold text-zup-green-dark">
              You save {formatBDT(saved)}
            </span>
          ) : null}
        </span>
      ) : null}

      {deliveryFree ? (
        <span className="flex items-center gap-1 text-[11.5px] font-semibold text-zup-green-dark">
          <Truck className="h-3 w-3" strokeWidth={2} aria-hidden />
          Free delivery
        </span>
      ) : null}

      {/* Which tiers this quantity has earned, and the nearest one it hasn't. */}
      <OfferLadder product={product} qty={qty} variant="line" />
    </>
  );
}
