import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { formatBDT } from "@/lib/site";
import type { Product } from "@/lib/products";
import { cn } from "@/lib/utils";
import { OfferLadder } from "./offer-ladder";

export function ProductImagePlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex items-center justify-center bg-[repeating-linear-gradient(-45deg,#F1F3F5_0_12px,#F7F8FA_12px_24px)]",
        className,
      )}
    >
      <span className="px-2.5 text-center font-mono text-[10px] text-zup-faint">
        {label}
      </span>
    </div>
  );
}

export function ProductCard({
  product,
  showCategory = true,
  className,
}: {
  product: Product;
  showCategory?: boolean;
  className?: string;
}) {
  // salePrice is server-computed (PublicProductDto) — never derived here.
  const hasSale =
    product.salePrice !== undefined && product.salePrice < product.price;
  // Display-only arithmetic over two server-given numbers: the gap between
  // them. No charged amount is derived here (cal-bk.md) — the card only names
  // the difference between the two prices it was handed. This used to also
  // recompute that gap as a percentage, with its own rounding that matched
  // neither the server's nor the admin's.
  const saving = hasSale ? product.price - product.salePrice! : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "block overflow-hidden rounded-2xl border border-zup-body/6 bg-white shadow-[0_4px_16px_rgba(11,79,224,.08)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(11,79,224,.16)]",
        className,
      )}
    >
      <div className="relative">
        {product.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photos[0]}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <ProductImagePlaceholder label={product.imgHint} className="aspect-square" />
        )}
        {product.inStock === false && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-zup-body/80 px-2.5 py-1 text-[11px] font-bold text-white">
            Out of stock
          </span>
        )}
        {/* Gated on hasSale, same as the price block below — so the stamp and
            the prices can never tell two different stories. */}
        {hasSale && saving > 0 && (
          <span className="absolute right-2 top-2 flex flex-col items-center rounded-xl bg-zup-orange px-2 py-1 text-white shadow-[0_4px_12px_rgba(232,83,32,.35)]">
            <span className="text-[8.5px] font-bold uppercase tracking-[0.12em]">save</span>
            <span className="text-[14px] font-extrabold leading-none">{formatBDT(saving)}</span>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-[5px] px-3.5 pb-3.5 pt-3">
        {showCategory && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-zup-soft">
            {product.category ?? product.cat}
          </span>
        )}
        <h3 className="min-h-9 text-sm font-semibold leading-tight text-zup-body">
          {product.name}
        </h3>
        {/* The three facts of a deal, in the order they're asked: what it costs
            now, what it cost before, what you keep. Each is labelled in words —
            a struck-through number on its own asks the reader to infer both
            that there is a discount and what it's worth. */}
        {hasSale ? (
          <div className="mt-0.5 rounded-xl bg-zup-orange/8 px-2.5 py-2 ring-1 ring-zup-orange/15">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-zup-orange-dark">
                Now
              </span>
              <span className="text-[19px] font-extrabold leading-none tracking-[-0.01em] text-zup-orange-dark">
                {formatBDT(product.salePrice!)}
              </span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-[11px] text-zup-soft">
                Was <span className="line-through">{formatBDT(product.price)}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zup-green px-1.5 py-[2px] text-[10.5px] font-bold text-white">
                <PiggyBank className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                Save {formatBDT(saving)}
              </span>
            </span>
          </div>
        ) : (
          <span className="text-[16px] font-bold text-zup-body">
            {formatBDT(product.price)}
          </span>
        )}
        <span className="text-[11.5px] text-zup-soft">
          ★ {product.rating} · {product.sold} sold
        </span>
        {/* No qty here — the card advertises what's available, it doesn't
            claim anything is applied. */}
        <OfferLadder product={product} variant="badges" />
      </div>
    </Link>
  );
}
