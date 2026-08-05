import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getProductBySlug, getProducts } from "@/lib/api";
import { formatBDT, site , jsonLd } from "@/lib/site";
import { ProductActions } from "@/components/product-actions";
import { ProductCard, ProductImagePlaceholder } from "@/components/product-card";
import { ProductVideo } from "@/components/product-video";
import { parseProductVideo } from "@/lib/video";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name} — Price in Bangladesh`,
    description: `${product.description} Price: ${formatBDT(product.price)}. Order online with bKash, Nagad or Cash on Delivery.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} | ZUP TECH`,
      description: product.description,
      url: `${site.url}/products/${product.slug}`,
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const catalog = await getProducts();
  const related = catalog
    .filter((p) => p.id !== product.id && p.cat === product.cat)
    .slice(0, 4);
  const outOfStock = product.inStock === false;
  // salePrice is server-computed (PublicProductDto); never derived here.
  const onSale = product.salePrice !== undefined && product.salePrice < product.price;
  const video = parseProductVideo(product.video);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    category: product.cat === "Home" ? "Home power products" : "Industrial power equipment",
    brand: { "@type": "Brand", name: site.name },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.sold,
      bestRating: 5,
    },
    offers: {
      "@type": "Offer",
      url: `${site.url}/products/${product.slug}`,
      priceCurrency: "BDT",
      price: product.salePrice ?? product.price,
      availability: outOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${site.url}/#organization` },
      // Quantity tiers, so the promotions are machine-readable too. Computed
      // from the product's own percentages the same way the server does
      // (floor), which is safe here because it's metadata, not a rendered
      // price — the cart still reprices through /api/pricing/quote.
      ...(product.quantityOffers?.length
        ? {
            priceSpecification: [...product.quantityOffers]
              .sort((a, b) => a.minQty - b.minQty)
              .map((tier) => ({
                "@type": "UnitPriceSpecification",
                priceCurrency: "BDT",
                price: product.price - Math.floor((product.price * tier.percentage) / 100),
                eligibleQuantity: {
                  "@type": "QuantitativeValue",
                  minValue: tier.minQty,
                  unitCode: "C62", // UN/CEFACT code for "one" (a countable item)
                },
              })),
          }
        : {}),
    },
    // Makes the promo eligible for video rich results. Only the fields Google
    // requires are emitted, and only for YouTube — an uploaded file has no
    // thumbnail to point at, and a VideoObject without one is rejected.
    ...(video?.kind === "youtube"
      ? {
          video: {
            "@type": "VideoObject",
            name: `${product.name} — product video`,
            description: product.description,
            thumbnailUrl: video.thumbnailUrl,
            embedUrl: video.embedUrl,
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${site.url}/shop` },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${site.url}/products/${product.slug}`,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-[1120px] px-5 pt-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-1.5">
        <Link
          href="/shop"
          className="px-1 py-1.5 text-sm font-semibold text-zup-blue transition-colors hover:text-zup-blue-dark"
        >
          ← Shop
        </Link>
      </nav>

      {product.video && (
        <div className="mb-7">
          <ProductVideo url={product.video} />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-2 md:gap-9">
        <div>
          {product.photos?.[0] ? (
            // Backend-hosted product photos (admin uploads) — arbitrary
            // origins, so next/image optimization doesn't apply.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.photos[0]}
              alt={`${product.name} — main photo`}
              className="w-full rounded-[20px] border border-zup-body/6 object-cover [aspect-ratio:1]"
            />
          ) : (
            <ProductImagePlaceholder
              label={`${product.imgHint} — main`}
              className="rounded-[20px] border border-zup-body/6 [aspect-ratio:1]"
            />
          )}
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {product.photos && product.photos.length > 1 ? (
              // Gallery isn't capped to 3 — show every photo after the cover.
              product.photos.slice(1).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`${product.name} — photo ${i + 2}`}
                  className="w-full rounded-[14px] border border-zup-body/6 object-cover [aspect-ratio:1]"
                />
              ))
            ) : (
              <>
                <ProductImagePlaceholder
                  label={`${product.imgHint} — detail`}
                  className="rounded-[14px] border border-zup-body/6 [aspect-ratio:1]"
                />
                <ProductImagePlaceholder
                  label="in-situ install photo"
                  className="rounded-[14px] border border-zup-body/6 [aspect-ratio:1]"
                />
              </>
            )}
          </div>
          <div className="mt-5 rounded-2xl border border-zup-body/6 bg-white px-5.5 py-5">
            <h2 className="mb-2 text-[15px] font-bold tracking-[-0.01em]">
              Product description
            </h2>
            <p className="text-sm leading-relaxed text-zup-gray">
              {product.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-zup-soft">
              {product.category ?? product.cat}
            </span>
            <h1 className="mb-2 mt-1.5 text-[clamp(24px,3.4vw,32px)] font-bold leading-tight tracking-[-0.02em]">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-2xl font-extrabold tracking-[-0.02em]">
                {formatBDT(product.salePrice ?? product.price)}
              </span>
              {onSale ? (
                <>
                  <span className="text-base text-zup-soft line-through">
                    {formatBDT(product.price)}
                  </span>
                  <span className="rounded-full bg-zup-orange px-2.5 py-1 text-[11px] font-bold text-white">
                    −{product.salePercentage}% off
                  </span>
                </>
              ) : null}
              <span className="text-[13px] text-zup-soft">
                ★ {product.rating} · {product.sold} sold
              </span>
            </div>
            <p
              className={
                outOfStock
                  ? "mt-2 text-[13.5px] font-bold text-zup-red"
                  : "mt-2 text-[13.5px] font-semibold text-zup-green-dark"
              }
            >
              {outOfStock
                ? "Out of stock — call us for availability"
                : typeof product.available === "number"
                  ? `In stock · ${product.available} available`
                  : "In stock"}
            </p>
            {product.minDp > 0 && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-zup-blue/6 px-3.5 py-2.5 text-[13.5px] font-semibold text-zup-blue">
                <span
                  className="flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full bg-zup-blue text-[10px] font-bold text-white"
                  aria-hidden
                >
                  ৳
                </span>
                Minimum down payment for this product {product.minDp}%.
              </p>
            )}
          </div>

          <ul className="flex flex-col gap-[9px]">
            {product.specs.map((spec) => (
              <li
                key={spec}
                className="flex items-start gap-2.5 text-[14.5px] leading-normal text-zup-mid"
              >
                <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-zup-blue/8 text-zup-blue">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                <span>{spec}</span>
              </li>
            ))}
          </ul>

          <ProductActions product={product} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-18" aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-4.5 text-[22px] font-bold tracking-[-0.02em]">
            Related products
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} showCategory={false} />
            ))}
          </div>
        </section>
      )}
      <div className="h-[150px] md:h-20" />
    </main>
  );
}
