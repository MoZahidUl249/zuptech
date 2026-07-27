import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getLandingPage } from "@/lib/api";
import { formatBDT } from "@/lib/site";
import { ProductActions } from "@/components/product-actions";
import { LandingPageGtm } from "@/components/marketing/landing-page-gtm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  return {
    title: page?.headline ?? "Offer",
    // Unlisted campaign page — never indexed, never in the sitemap.
    robots: { index: false, follow: false },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // One call: the payload embeds the product, which is what lets a campaign
  // sell something that is off the storefront (GET /api/products/:slug 404s
  // on it). The backend 404s unpublished pages and counts the view.
  const pub = await getLandingPage(slug);
  if (!pub) notFound();

  const product = pub.product;

  return (
    <main className="mx-auto max-w-[720px] px-5 pb-16 pt-0">
      <LandingPageGtm gtmId={pub.gtmId} />

      {pub.ribbonText ? (
        <div className="-mx-5 mb-6 bg-zup-orange px-5 py-2 text-center text-[12.5px] font-bold uppercase tracking-[0.04em] text-white">
          {pub.ribbonText}
        </div>
      ) : null}

      <h1 className="mb-2 text-[clamp(24px,4vw,32px)] font-bold leading-tight tracking-[-0.02em]">
        {pub.headline}
      </h1>
      <p className="mb-5 text-[14.5px] leading-relaxed text-zup-gray">
        {pub.product.description}
      </p>

      <div
        className="mb-6 flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_14px,#F6F7F9_14px_28px)]"
        role="img"
        aria-label={pub.imageHint || pub.product.name}
      >
        <span className="rounded-lg bg-white/85 px-3 py-1.5 text-center font-mono text-[11px] text-zup-faint">
          {pub.imageHint || `${pub.product.name} photo`}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <span className="text-[32px] font-extrabold tracking-[-0.02em]">
          {formatBDT(pub.offerPrice)}
        </span>
        {pub.compareAtPrice > pub.offerPrice ? (
          <>
            <span className="text-lg text-zup-faint line-through">
              {formatBDT(pub.compareAtPrice)}
            </span>
            <span className="rounded-full bg-zup-orange px-3 py-1 text-xs font-bold text-white">
              {pub.discountPercentage}% OFF
            </span>
          </>
        ) : null}
      </div>
      {pub.compareAtPrice > pub.offerPrice ? (
        <p className="-mt-4 mb-6 text-sm font-semibold text-zup-green">
          Save {formatBDT(pub.compareAtPrice - pub.offerPrice)} today
        </p>
      ) : null}

      {pub.benefitBullets.length > 0 ? (
        <ul className="mb-7 flex flex-col gap-2.5 rounded-2xl border border-zup-body/6 bg-white px-5 py-5">
          {pub.benefitBullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-[14.5px]">
              <Check
                className="mt-0.5 h-[18px] w-[18px] flex-none text-zup-green"
                strokeWidth={2.5}
                aria-hidden
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-3.5 pb-24 md:pb-0">
        <ProductActions product={product} ctaLabel={pub.buttonLabel || "Buy Now"} />
      </div>

      {pub.footerNote ? (
        <p className="mt-6 text-center text-xs text-zup-soft">{pub.footerNote}</p>
      ) : null}
    </main>
  );
}
