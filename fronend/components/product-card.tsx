import Link from "next/link";
import { formatBDT } from "@/lib/site";
import type { Product } from "@/lib/products";
import { cn } from "@/lib/utils";

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

/**
 * A product card, deliberately plain.
 *
 * It used to carry a category line, a floating "save ৳X" stamp, an orange
 * Now/Was/Save panel, a rating-and-sold line and up to three offer badges —
 * seven competing things around a photo the card is actually selling. All of
 * it is gone. What remains is the image, the name, the price and, when it
 * applies, the one fact that stops a click being wasted: that it is out of
 * stock.
 *
 * The offers still exist and are still shown — on the product page, through
 * `OfferLadder`'s `panel` variant, where there is room to read them.
 */
export function ProductCard({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  // salePrice is server-computed (PublicProductDto) — never derived here. The
  // card shows both numbers and does no arithmetic on them at all now: the
  // saving it used to calculate was the only sum on this component.
  const hasSale =
    product.salePrice !== undefined && product.salePrice < product.price;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "block overflow-hidden rounded-2xl border border-zup-body/6 bg-white shadow-[0_4px_16px_rgba(11,79,224,.08)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(11,79,224,.16)]",
        className,
      )}
    >
      <div className="relative">
        {/* `object-contain`, not `object-cover`: the catalogue is hardware of
            wildly different shapes — a tall battery cabinet, a wide switchgear
            panel — and cropping to a square was cutting the ends off the things
            people are trying to recognise. The square box stays so the grid rows
            stay level; the image now fits inside it. */}
        {product.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photos[0]}
            alt={product.name}
            className="aspect-square w-full bg-white object-contain"
          />
        ) : (
          <ProductImagePlaceholder label={product.imgHint} className="aspect-square" />
        )}

        {/*
         * Two labels over the photo: status left, discount right. Bold text
         * and nothing else — no pill, no fill, no icon.
         *
         * The text-shadow is not decoration. `object-contain` puts these on
         * whatever the photo happens to show in its corners, and half this
         * catalogue is white-background product shots where plain dark text on
         * a pale panel is barely legible. A tight white halo costs nothing
         * visually on a dark corner and rescues the light ones. Anything more —
         * a scrim, a chip — would be the box we just removed.
         *
         * `stockTag` is resolved server-side (stockTagFor in backend rules):
         * the manual override and the stock/purchase-order derivation are both
         * server facts, so the card only ever prints the answer.
         */}
        {product.stockTag ? (
          <span
            className="absolute left-2.5 top-2.5 text-[12.5px] font-bold text-zup-body"
            style={{ textShadow: "0 0 4px #fff, 0 0 8px #fff" }}
          >
            {product.stockTag}
          </span>
        ) : null}
        {/* Gated on `hasSale`, NOT on salePct alone.
            `salePct` is the raw column and survives the sale being switched
            off, so a product left at 10% with `onSale` false comes back from
            the API as salePct=10 with salePrice === price. Keying the badge on
            the percentage alone advertised a discount the cart would not
            honour — the exact mismatch this whole design exists to prevent.
            The badge and the struck-through price now answer to one condition. */}
        {hasSale && product.salePct ? (
          <span
            className="absolute right-2.5 top-2.5 text-[12.5px] font-bold text-zup-orange-dark"
            style={{ textShadow: "0 0 4px #fff, 0 0 8px #fff" }}
          >
            -{product.salePct}% off
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
        <h3 className="min-h-9 text-sm font-semibold leading-tight text-zup-body">
          {product.name}
        </h3>
        {/* Old price struck through, then what it costs — no panel, no badge,
            no computed saving. Both numbers come from the server as-is. */}
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {hasSale && (
            <span className="text-[12.5px] text-zup-soft line-through">
              {formatBDT(product.price)}
            </span>
          )}
          <span className="text-[16px] font-bold text-zup-body">
            {formatBDT(hasSale ? product.salePrice! : product.price)}
          </span>
        </span>
        {/* The out-of-stock line that used to sit here has moved onto the
            photo as the status tag above — it now covers "Incoming" and
            "Sold out" too, and the admin can pin any of them. */}
      </div>
    </Link>
  );
}
