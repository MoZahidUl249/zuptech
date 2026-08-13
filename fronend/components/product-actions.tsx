"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { useCart } from "@/lib/cart";
import { type Product } from "@/lib/products";
import { formatBDT } from "@/lib/site";
import { OfferLadder } from "./offer-ladder";

export function ProductActions({
  product,
  ctaLabel = "Buy Now",
  offersTitle,
}: {
  product: Product;
  /** Overrides the primary "Buy Now" label — used by campaign landing pages
   *  with their own admin-configured button copy. */
  ctaLabel?: string;
  /** Heading over the offer ladder. Landing pages retitle it, because there
   *  the headline price is campaign copy and these are the catalog offers the
   *  cart will actually honour. */
  offersTitle?: string;
}) {
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const router = useRouter();

  const outOfStock = product.inStock === false;
  // Cap the order at what the backend says is available (stock − reserved).
  const maxQty =
    typeof product.available === "number" ? Math.min(99, Math.max(1, product.available)) : 99;

  // salePrice is server-computed (PublicProductDto); the client never derives
  // a discount. The offer ladder below reads `qty` to show which tiers this
  // quantity has reached — it still shows no money; the charged amount comes
  // from the quote at checkout.
  const effectivePrice = product.salePrice ?? product.price;

  // Either zone having a fee means this product ships with installation.
  const hasInstallation = Boolean(
    product.installationFeeInsideDhaka || product.installationFeeOutsideDhaka,
  );

  const addToCart = () => {
    add(product.id, qty);
    toast.success("Added to cart ✓");
  };

  const buyNow = () => {
    add(product.id, qty);
    router.push("/checkout");
  };

  if (outOfStock) {
    return (
      <div className="rounded-[2px] border border-zup-body/10 bg-white px-5 py-4 text-[14.5px] font-semibold text-zup-gray">
        This product is currently out of stock. Call us to reserve the next
        batch.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-zup-soft">
          Quantity
        </span>
        <div className="inline-flex items-center self-start overflow-hidden rounded-full border border-zup-body/14 bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="h-[46px] w-[46px] text-xl font-semibold text-zup-mid transition-colors hover:bg-secondary"
          >
            −
          </button>
          <span className="min-w-11 text-center text-base font-bold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            aria-label="Increase quantity"
            className="h-[46px] w-[46px] text-[19px] font-semibold text-zup-mid transition-colors hover:bg-secondary"
          >
            +
          </button>
        </div>
      </div>

      {/*
        This was a "With setup / Without setup" toggle. It was a fake choice:
        the value was never sent anywhere, and the backend prices installation
        from the delivery zone and the product's own fee alone
        (backend/src/lib/pricing.ts). Someone picking "Without setup" was
        charged for it anyway. It's now a statement of fact, shown only when
        this product actually carries an installation fee — the exact amount
        depends on the zone and appears in the checkout total.
      */}
      {hasInstallation ? (
        <p className="flex items-start gap-2 rounded-[2px] border border-zup-body/10 bg-white px-4 py-3 text-[13px] leading-relaxed text-zup-mid">
          <Wrench className="mt-0.5 h-4 w-4 flex-none text-zup-blue" strokeWidth={1.8} aria-hidden />
          <span>
            <strong className="font-bold">Installation included.</strong> Our engineer
            fits it for you — the fee depends on your area and is shown before you pay.
          </span>
        </p>
      ) : null}

      {/* Live: rungs light up as the stepper crosses each threshold. */}
      <OfferLadder product={product} qty={qty} variant="panel" title={offersTitle} />

      {/*
       * The buy buttons, in the page at every size.
       *
       * These used to be desktop-only, with mobile served by a bar fixed above
       * the tab bar. That bar is gone: the product page now orders itself so
       * the buttons come straight after the name, which is the same job the
       * floating bar was doing — except in the flow, where it doesn't cover the
       * page, doesn't need a spacer under the content to compensate, and
       * doesn't sit a second price next to the one already on screen.
       */}
      {/* Side by side, each taking half the row. `min-w-0` lets them actually
          divide the space — without it a long label sets the button's minimum
          width and pushes its sibling off. */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={addToCart}
          className="min-w-0 flex-1 rounded-full bg-zup-orange px-4 py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark"
        >
          {/* The unit price is worth saying where there is room for it, but at
              half a phone's width it wraps the label onto three lines. The
              price is stated directly above these buttons either way. */}
          Add to Cart
          <span className="hidden sm:inline"> — {formatBDT(effectivePrice)} each</span>
        </button>
        <button
          type="button"
          onClick={buyNow}
          className="min-w-0 flex-1 rounded-full bg-zup-red px-4 py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(198,40,40,.25)] transition-colors hover:bg-zup-red-dark"
        >
          {ctaLabel}
        </button>
      </div>

    </>
  );
}
