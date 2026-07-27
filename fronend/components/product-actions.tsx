"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { type Product } from "@/lib/products";
import { offerTiersLabel } from "@/lib/pricing-display";
import { formatBDT } from "@/lib/site";
import { cn } from "@/lib/utils";

export function ProductActions({
  product,
  ctaLabel = "Buy Now",
}: {
  product: Product;
  /** Overrides the primary "Buy Now" label — used by campaign landing pages
   *  with their own admin-configured button copy. */
  ctaLabel?: string;
}) {
  const [qty, setQty] = useState(1);
  const [withSetup, setWithSetup] = useState(true);
  const { add } = useCart();
  const router = useRouter();

  const outOfStock = product.inStock === false;
  // Cap the order at what the backend says is available (stock − reserved).
  const maxQty =
    typeof product.available === "number" ? Math.min(99, Math.max(1, product.available)) : 99;

  // salePrice is server-computed (PublicProductDto); the client never derives
  // a discount. Quantity offers are shown as available tiers rather than an
  // applied price — the charged amount still comes from the quote at checkout.
  const hasSale = product.salePrice !== undefined && product.salePrice < product.price;
  const effectivePrice = product.salePrice ?? product.price;
  const tiers = offerTiersLabel(product.quantityOffers);

  const addToCart = () => {
    add(product.id, qty);
    toast.success(`Added to cart ✓${withSetup ? " (with setup)" : ""}`);
  };

  const buyNow = () => {
    add(product.id, qty);
    router.push("/checkout");
  };

  if (outOfStock) {
    return (
      <div className="rounded-[14px] border border-zup-body/10 bg-white px-5 py-4 text-[14.5px] font-semibold text-zup-gray">
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

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-zup-soft">
          Setup
        </span>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setWithSetup(true)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-[14px] border-2 px-4 py-[11px] text-left transition-colors hover:border-zup-blue",
              withSetup ? "border-zup-blue bg-zup-blue/5" : "border-zup-body/12 bg-white",
            )}
          >
            <span className="text-sm font-bold text-zup-body">With setup</span>
            <span className="text-xs text-zup-gray">
              Engineer installs it · fee confirmed by phone
            </span>
          </button>
          <button
            type="button"
            onClick={() => setWithSetup(false)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-[14px] border-2 px-4 py-[11px] text-left transition-colors hover:border-zup-blue",
              !withSetup ? "border-zup-blue bg-zup-blue/5" : "border-zup-body/12 bg-white",
            )}
          >
            <span className="text-sm font-bold text-zup-body">Without setup</span>
            <span className="text-xs text-zup-gray">Product only, self-install</span>
          </button>
        </div>
      </div>

      {(tiers || (product.freeDeliveryMinQty ?? 0) > 0) && (
        <div className="flex flex-col gap-1 rounded-[14px] bg-zup-green/8 px-4 py-3">
          {tiers ? (
            <span className="text-[12.5px] font-semibold text-zup-green-dark">{tiers}</span>
          ) : null}
          {(product.freeDeliveryMinQty ?? 0) > 0 ? (
            <span className="text-[12.5px] font-semibold text-zup-green-dark">
              Free delivery on {product.freeDeliveryMinQty}+ units
            </span>
          ) : null}
        </div>
      )}

      {/* Desktop buttons */}
      <div className="hidden flex-col gap-2.5 md:flex">
        <button
          type="button"
          onClick={addToCart}
          className="rounded-full bg-zup-orange px-8 py-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(232,83,32,.25)] transition-colors hover:bg-zup-orange-dark"
        >
          Add to Cart — {formatBDT(effectivePrice)} each
        </button>
        <button
          type="button"
          onClick={buyNow}
          className="rounded-full bg-zup-red px-8 py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(198,40,40,.25)] transition-colors hover:bg-zup-red-dark"
        >
          {ctaLabel}
        </button>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-16 z-70 border-t border-zup-body/7 bg-white/94 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[560px] items-center gap-3.5">
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-zup-soft">Price</span>
            <span className="flex items-baseline gap-1.5">
              <span className="whitespace-nowrap text-lg font-extrabold tracking-[-0.02em]">
                {formatBDT(effectivePrice)}
              </span>
              {hasSale ? (
                <span className="text-[12px] text-zup-soft line-through">
                  {formatBDT(product.price)}
                </span>
              ) : null}
            </span>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="min-h-13 flex-1 rounded-[14px] bg-zup-orange text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(232,83,32,.3)] active:scale-[.98]"
          >
            Add to Cart
          </button>
          <button
            type="button"
            onClick={buyNow}
            className="min-h-13 flex-1 rounded-[14px] bg-zup-red text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(198,40,40,.3)] active:scale-[.98]"
          >
            Buy Now
          </button>
        </div>
      </div>
    </>
  );
}
