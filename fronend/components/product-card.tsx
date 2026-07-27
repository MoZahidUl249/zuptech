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
        {product.onSale && (product.salePercentage ?? 0) > 0 && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-zup-orange px-2.5 py-1 text-[11px] font-bold text-white">
            −{product.salePercentage}%
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold">
              {formatBDT(product.salePrice ?? product.price)}
            </span>
            {hasSale ? (
              <span className="text-[12px] text-zup-soft line-through">
                {formatBDT(product.price)}
              </span>
            ) : null}
          </span>
          <span className="text-[11.5px] text-zup-soft">
            ★ {product.rating} · {product.sold} sold
          </span>
        </div>
        {(product.freeDeliveryMinQty ?? 0) > 0 ? (
          <span className="text-[11px] font-semibold text-zup-green-dark">
            Free delivery on {product.freeDeliveryMinQty}+
          </span>
        ) : null}
      </div>
    </Link>
  );
}
