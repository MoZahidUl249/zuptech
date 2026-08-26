import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Phone } from "lucide-react";
import { getLandingPage, getProductsByIds, getSiteConfig } from "@/lib/api";
import { formatBDTBangla as formatBDT, toBanglaDigits } from "@/lib/site";
import { cn } from "@/lib/utils";
import { isOptimizableImageSrc } from "@/lib/images";
import { LandingPageGtm } from "@/components/marketing/landing-page-gtm";
import { ProductCard } from "@/components/product-card";
import { CampaignOrderForm } from "@/components/marketing/campaign-order-form";
import { ProductVideo } from "@/components/product-video";
import { parseProductVideo } from "@/lib/video";
import { CampaignCountdown } from "@/components/marketing/campaign-countdown";
import { CampaignTracking } from "@/components/marketing/campaign-tracking";
import {
  CampaignMediaCarousel,
  type CampaignMediaItem,
} from "@/components/marketing/campaign-media-carousel";

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

/** Every CTA on the page scrolls to the same form. */
const ORDER_HREF = "#order";

/*
 * ── The page's spacing scale ──────────────────────────────────────────────
 *
 * One scale, applied by the two helpers below and by every band that uses
 * them. Written down because the page had drifted: three callers passed
 * padding overrides that silently lost to the helper's own classes (see the
 * cn() note on `Section`), so the rhythm on screen was not the rhythm in the
 * source.
 *
 *   Band padding     py-10 sm:py-12          — Section, every band
 *   Reading column   max-w-[720px] px-5      — Inner, every band, no exceptions
 *   Heading → body   mt-3
 *   Body → media     mt-6
 *   Media → price    mt-5
 *   Price → CTA      mt-5                    — OrderCta owns this
 *   CTA → note       mt-2.5
 *   Section heading  mb-6
 *   Card list gap    gap-3.5
 *   Bullet list gap  gap-2
 *   CTA              block px-5 py-3.5, clamp(16px,3.6vw,22px), extrabold
 *   Radii            rounded-[2px] throughout. globals.css flattens the whole
 *                    --radius scale to 2px anyway, so `rounded-2xl` here was
 *                    spelling, not appearance.
 */

/**
 * The reading column every band shares.
 *
 * Horizontal padding lives HERE rather than on the band, so the column is
 * defined in exactly one place — a band that wants full-bleed colour and
 * inset text gets both without doing arithmetic.
 */
function Inner({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[720px] px-5", className)}>{children}</div>;
}

/**
 * One band of the page.
 *
 * Colours arrive as inline `style`, not Tailwind classes, because they are
 * per-campaign values from the database — a class name cannot be built from a
 * runtime hex and have Tailwind emit it. They are hex-validated at the DTO
 * (`hexColor` in landing-pages.dto.ts), which is what makes interpolating them
 * here safe; nothing else in this file re-checks them.
 *
 * `cn()`, not a template literal. Concatenating meant a caller's `py-4` was
 * emitted alongside the helper's `py-7` and the winner was decided by
 * stylesheet order rather than by the caller — measured on the live page, the
 * override lost every time. twMerge makes the last word win, which is the only
 * thing a caller passing padding could have meant.
 *
 * Declared at module scope so React keeps the same component identity across
 * renders instead of remounting the whole section.
 */
function Section({
  children,
  className,
  bg,
  color,
}: {
  children: React.ReactNode;
  className?: string;
  bg?: string;
  color?: string;
}) {
  return (
    <section className={cn("py-10 sm:py-12", className)} style={{ backgroundColor: bg, color }}>
      {children}
    </section>
  );
}

/**
 * One order button.
 *
 * Every media block on the page is followed by one: a visitor who has just
 * watched the demo or looked through the box shots should not have to scroll
 * to find the form. Each carries its own `data-cta`, because five identical
 * buttons all pointing at #order are otherwise a single undifferentiated
 * trigger in GTM — `campaign-tracking.tsx` reads this attribute to say which
 * one was pressed.
 */
function OrderCta({
  label,
  note,
  at,
  ctaBg,
  ctaText,
  className,
}: {
  label: string;
  /** Small print under the button, e.g. "no advance payment". */
  note?: string;
  /** The `data-cta` value. See CampaignTracking. */
  at: "hero" | "gallery" | "quality" | "countdown";
  ctaBg: string;
  ctaText: string;
  className?: string;
}) {
  if (!label) return null;
  return (
    <>
      <a
        href={ORDER_HREF}
        data-cta={at}
        className={cn(
          "mt-5 block rounded-[2px] px-5 py-3.5 text-center text-[clamp(16px,3.6vw,22px)] font-extrabold",
          className,
        )}
        style={{ backgroundColor: ctaBg, color: ctaText }}
      >
        {label}
      </a>
      {note ? <p className="mt-2.5 text-center text-[12.5px] opacity-80">{note}</p> : null}
    </>
  );
}

/**
 * Campaign page.
 *
 * Every string below comes from the landing page row, so a campaign is written
 * end to end from the admin — the layout is fixed, the words are not, and
 * nothing here assumes English. Sections whose content is empty render
 * nothing at all, so a half-filled campaign degrades to a shorter page rather
 * than a page full of blank headings.
 *
 * The only numbers on the page come from `pub.bundles`, which the server
 * derived from this campaign's own price ladder when it has one and from the
 * product's quantity offers when it does not — through `campaignUnitPrice()`,
 * the same function `priceCart()` charges with. So a campaign still cannot
 * advertise a price the cart will refuse.
 */
export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // One call: the payload embeds the product, which is what lets a campaign
  // sell something that is off the storefront (GET /api/products/:slug 404s
  // on it). The backend 404s unpublished pages and counts the view.
  const pub = await getLandingPage(slug);
  if (!pub) notFound();

  const product = pub.product;
  const one = pub.bundles[0];

  /*
   * The campaign's palette, with a fallback per role.
   *
   * The fallbacks are not decoration: a page written by an older client, or
   * one whose row predates these columns, would otherwise paint `undefined`
   * into `style` and render as unstyled white-on-white. Every colour has a
   * default at the column too, so this is belt and braces at the one place a
   * missing value would be invisible rather than loud.
   */
  const theme = {
    heroBg: pub.colorHeroBg || "#17341B",
    heroText: pub.colorHeroText || "#FFFFFF",
    bandBg: pub.colorBandBg || "#45712F",
    bandText: pub.colorBandText || "#FFFFFF",
    tintBg: pub.colorTintBg || "#F2F5EC",
    pageBg: pub.colorPageBg || "#FFFFFF",
    pageText: pub.colorPageText || "#15181E",
    accent: pub.colorAccent || "#45712F",
    highlight: pub.colorHighlight || "#FFF306",
    ctaBg: pub.colorCtaBg || "#000000",
    ctaText: pub.colorCtaText || "#FFFFFF",
  };

  /*
   * The payment method this page's order form places orders under.
   *
   * Resolved here, from the enabled list, because checkout matches a method
   * by NAME: the form used to send the literal "Cash on Delivery", so
   * renaming or disabling that row in the admin broke every campaign order
   * silently. Preferring an offline method keeps cash-on-delivery behaviour
   * where one exists, and falling back to the first enabled method means the
   * page still sells if the shop is card-only.
   */
  const siteConfig = await getSiteConfig();
  const payOptions = siteConfig?.paymentOptions ?? [];
  const payMethod =
    payOptions.find((o) => /cash on delivery|cod/i.test(o.label))?.label ??
    payOptions[0]?.label ??
    "";

  // Parsed, not just non-empty: an unusable URL must fall back to the photo.
  const heroVideo = parseProductVideo(pub.heroVideoUrl);

  /*
   * The struck-through price beside the live one.
   *
   * ONE struck price, never two. `compareAtPrice` is the campaign's own
   * advertised reference and wins when it is set; otherwise the bundle's
   * `wasTotal` stands in, which is what the hero showed before the coloured
   * price bands were removed. Zero hides the left-hand side entirely rather
   * than printing a struck ৳0.
   */
  const struckPrice =
    pub.compareAtPrice > 0
      ? pub.compareAtPrice
      : one && one.wasTotal > one.total
        ? one.wasTotal
        : 0;

  /*
   * The "what's in the box" gallery.
   *
   * The migration backfilled the old single `videoUrl` into `galleryItems`,
   * so the fallback below only fires for a row written by an older admin
   * client mid-rollout — but a campaign silently losing its demo video for
   * the length of a deploy is not something to leave to timing.
   */
  /*
   * The pack shot, defined once because two things need it: the hero when no
   * video is set, and `ProductVideo`'s fallback when a video IS set but will
   * not play.
   *
   * That second case used to have no answer. `parseProductVideo` decides from
   * the URL's shape, before anything has tried to load it, so a hero video
   * whose file had gone left a dead black rectangle at the top of the page AND
   * suppressed the photo that should have stood in for it. Passing the still
   * down means the worst case is the page the campaign would have had anyway.
   */
  const heroStill = product.photos?.[0] ? (
    <Image
      src={product.photos[0]}
      alt={product.name}
      width={720}
      height={540}
      className="h-auto w-full object-cover"
      unoptimized={!isOptimizableImageSrc(product.photos[0])}
      preload
    />
  ) : (
    <div className="flex aspect-[4/3] items-center justify-center bg-[repeating-linear-gradient(135deg,#f4f5f7_0_12px,#eceef1_12px_24px)]">
      <span className="rounded-full bg-white/80 px-3 py-1 text-[12px] text-zup-soft">
        {pub.imageHint || product.name}
      </span>
    </div>
  );

  const galleryItems: CampaignMediaItem[] = pub.galleryItems?.length
    ? pub.galleryItems
    : pub.videoUrl
      ? [{ url: pub.videoUrl, kind: "video", alt: "" }]
      : [];

  /* Same shape of fallback for the quality block's photos. */
  const qcPhotos = pub.qcImages?.length ? pub.qcImages : pub.qcImage ? [pub.qcImage] : [];

  /* The row shown above the footer — resolved and re-sorted into the admin's
   * order, dropping ids that no longer resolve, exactly as the home rows and a
   * product's recommendations do. */
  const rowIds = pub.productRowIds ?? [];
  const rowFetched = rowIds.length > 0 ? await getProductsByIds(rowIds) : [];
  const productRow = rowIds
    .map((id) => rowFetched.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div style={{ backgroundColor: theme.pageBg, color: theme.pageText }}>
      <LandingPageGtm gtmId={pub.gtmId} />
      {/* Which campaign, which product, and which CTA — the things a raw
          click trigger cannot tell apart on this page. */}
      <CampaignTracking
        slug={slug}
        productId={product.id}
        productName={product.name}
        price={one?.unitPrice ?? pub.offerPrice}
      />

      {/* ── 1. Header: the site's own mark, hotline, and a jump to the form ── */}
      <header
        className="sticky top-0 z-30 border-b border-zup-line backdrop-blur"
        style={{ backgroundColor: theme.tintBg }}
      >
        <Inner className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/zup-mark.png"
              alt="ZUP TECH"
              width={30}
              height={30}
              className="h-[30px] w-[30px] object-contain"
              preload
            />
            <span className="text-[15px] font-extrabold leading-none tracking-[0.05em] text-zup-body">
              ZUP TECH
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {pub.hotlineNumber ? (
              <a
                href={`tel:${pub.hotlineNumber.replace(/\s/g, "")}`}
                className="hidden flex-col items-end leading-tight min-[420px]:flex"
              >
                <span className="text-[10.5px] font-medium text-zup-soft">{pub.hotlineLabel}</span>
                <span className="text-[13.5px] font-bold text-zup-body">{pub.hotlineNumber}</span>
              </a>
            ) : null}
            {pub.headerCtaLabel ? (
              <a
                href={ORDER_HREF}
                data-cta="header"
                className="rounded-[2px] px-4 py-2 text-[13.5px] font-semibold"
                style={{ backgroundColor: theme.ctaBg, color: theme.ctaText }}
              >
                {pub.headerCtaLabel}
              </a>
            ) : null}
          </div>
        </Inner>
      </header>

      {/* ── 2. Hero ─────────────────────────────────────────────────────── */}
      {/* The hero carries the campaign's own colours and a headline scaled to
          the reference design — clamp tops out near 44px rather than 34px,
          because on a direct-response page the headline is the argument, not a
          label above one. */}
      <Section bg={theme.heroBg} color={theme.heroText}>
        <Inner>
          {pub.trustBadges.length ? (
            <ul className="mb-4 flex flex-wrap gap-2">
              {pub.trustBadges.map((b) => (
                <li
                  key={b}
                  className="rounded-[2px] px-3 py-1 text-[11.5px] font-semibold"
                  style={{ backgroundColor: theme.bandBg, color: theme.bandText }}
                >
                  {b}
                </li>
              ))}
            </ul>
          ) : null}

          <h1 className="text-[clamp(28px,6vw,44px)] font-extrabold leading-[1.2] tracking-[-0.02em]">
            {pub.headline}
          </h1>
          {pub.subheadline ? (
            <p className="mt-3 text-[clamp(15px,3.4vw,19px)] leading-relaxed opacity-90">{pub.subheadline}</p>
          ) : null}

          {/*
            The hero slot: a video when the campaign has one, otherwise the
            pack shot.

            Video wins because a campaign that bothers to set one is selling
            with it, and stacking both puts the fold's most valuable space
            under two competing things. The gallery further down is
            unaffected — a campaign can run either, both, or neither.

            ProductVideo renders a thumbnail and only swaps in the iframe on
            click, so a hero video costs no YouTube script, connection or
            cookie for the visitors who never press play.

            Blank is the only thing that brings the photo back. A non-YouTube
            URL is treated as a direct file and rendered in a <video> — the
            same behaviour as the product page's own video field, and the
            same responsibility on whoever pastes it. The check below is on
            the parsed value rather than the raw string only because
            `parseProductVideo` also rejects a non-http URL outright, and a
            null there must not leave an empty frame in the hero.

            One wrapper for both branches, so `discountBadge` sits on the
            media whichever it is. It used to live inside the photo branch
            alone, which meant setting a hero video silently dropped the
            badge — a campaign losing its "16%" for a reason nothing on the
            page could explain.
          */}
          <div className="relative mt-6 overflow-hidden rounded-[2px] border border-white/15">
            {heroVideo ? <ProductVideo url={pub.heroVideoUrl} fallback={heroStill} /> : heroStill}
            {pub.discountBadge ? (
              <span
                className="absolute right-3 top-3 z-10 rounded-[2px] px-3 py-1 text-[12.5px] font-extrabold"
                style={{ backgroundColor: theme.highlight, color: theme.pageText }}
              >
                {pub.discountBadge}
              </span>
            ) : null}
          </div>

          {/*
            The price, directly under the media: what it used to cost on the
            left, struck; what it costs now on the right.

            The right-hand number is `one.total` — the bundle ladder's own
            first row, which the server derived from the product's quantity
            offers — NOT the campaign's `offerPrice` copy. Checkout reprices
            through priceCart(), so taking the number from the same place the
            cart does is what keeps the price on screen and the price charged
            from ever disagreeing.
          */}
          {struckPrice > 0 ? (
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <span className="text-[clamp(17px,4vw,22px)] opacity-70 line-through">
                {formatBDT(struckPrice)}
              </span>
              <span className="text-[clamp(30px,8vw,40px)] font-bold leading-none">
                {formatBDT(one?.total ?? 0)}
              </span>
            </div>
          ) : (
            <p className="mt-5 text-[clamp(30px,8vw,40px)] font-bold leading-none">
              {formatBDT(one?.total ?? 0)}
            </p>
          )}

          <OrderCta
            label={pub.buttonLabel}
            note={pub.heroCtaNote}
            at="hero"
            ctaBg={theme.ctaBg}
            ctaText={theme.ctaText}
          />
        </Inner>
      </Section>

      {/* ── 3. What's in the box — photos and clips ─────────────────────── */}
      {/* Was a single video slot. A campaign selling a 38-piece toolset has
          more than one thing to show, and one embed could only ever show the
          one. `videoTitle` stays the heading, so every campaign's existing
          Bengali wording carries across untouched. */}
      {galleryItems.length ? (
        <Section>
          <Inner>
            {pub.videoTitle ? (
              <h2 className="mb-6 text-center text-[21px] font-bold leading-snug">
                {pub.videoTitle}
              </h2>
            ) : null}
            <CampaignMediaCarousel
              items={galleryItems}
              label={pub.videoTitle || product.name}
              fallbackAlt={product.name}
            />
            <OrderCta
              label={pub.buttonLabel}
              at="gallery"
              ctaBg={theme.ctaBg}
              ctaText={theme.ctaText}
            />
          </Inner>
        </Section>
      ) : null}

      {/* ── 4. Spec sheet ───────────────────────────────────────────────── */}
      {pub.specs.length ? (
        <Section bg={theme.heroBg} color={theme.heroText}>
          <Inner>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              {pub.specTitle ? <h2 className="text-[21px] font-bold">{pub.specTitle}</h2> : null}
              {pub.specMeta ? (
                <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-white/50">
                  {pub.specMeta}
                </span>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pub.specs.map((s, i) => (
                <div key={`${s.label}-${i}`} className="rounded-[2px] bg-white/5 p-4">
                  <dt className="font-mono text-[22px] font-bold leading-none">{s.value}</dt>
                  <dd className="mt-1.5 text-[12.5px] text-white/60">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Inner>
        </Section>
      ) : null}

      {/* ── 5. Bundle ladder — priced from the product, never from copy ─── */}
      {pub.bundles.length > 1 ? (
        <Section>
          <Inner>
            {pub.bundlesTitle ? (
              <h2 className="text-center text-[22px] font-bold">{pub.bundlesTitle}</h2>
            ) : null}
            {pub.bundlesSubtitle ? (
              <p className="mt-3 text-center text-[14.5px] text-zup-gray">{pub.bundlesSubtitle}</p>
            ) : null}
            <ul className="mt-6 flex flex-col gap-3">
              {pub.bundles.map((b) => (
                <li
                  key={b.qty}
                  className="flex items-center justify-between gap-4 rounded-[2px] border border-zup-line bg-white p-4"
                >
                  <div>
                    <p className="text-[16px] font-bold">
                      {toBanglaDigits(b.qty)} {pub.bundleUnitLabel}
                    </p>
                    {b.saving > 0 ? (
                      <p className="mt-0.5 text-[12.5px] font-semibold text-zup-orange">
                        {formatBDT(b.saving)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    {b.wasTotal > b.total ? (
                      <p className="text-[13px] text-zup-soft line-through">
                        {formatBDT(b.wasTotal)}
                      </p>
                    ) : null}
                    <p className="text-[19px] font-bold">{formatBDT(b.total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Inner>
        </Section>
      ) : null}

      {/* ── 6. Quality control / anti-counterfeit ───────────────────────── */}
      {pub.qcTitle || pub.qcBody || qcPhotos.length ? (
        <Section bg={theme.tintBg}>
          <Inner>
            {/* The uploaded pictures when the campaign has any; the striped
                wireframe, captioned with the art direction, until it does.
                One photo renders as a plain image — a carousel of one is a
                slider that cannot slide, and it would ship client JS to say
                so. */}
            {qcPhotos.length > 1 ? (
              <CampaignMediaCarousel
                items={qcPhotos.map((url) => ({
                  url,
                  kind: "image" as const,
                  alt: pub.qcImageHint,
                }))}
                label={pub.qcTitle || product.name}
                fallbackAlt={pub.qcTitle || product.name}
              />
            ) : qcPhotos[0] ? (
              <Image
                src={qcPhotos[0]}
                alt={pub.qcImageHint || pub.qcTitle || product.name}
                width={720}
                height={405}
                unoptimized={!isOptimizableImageSrc(qcPhotos[0])}
                className="h-auto w-full rounded-[2px] border border-zup-line object-cover"
              />
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center rounded-[2px] border border-zup-line bg-[repeating-linear-gradient(135deg,#f4f5f7_0_12px,#eceef1_12px_24px)]">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[12px] text-zup-soft">
                  {pub.qcImageHint}
                </span>
              </div>
            )}
            {pub.qcTitle ? (
              <h2 className="mt-5 text-[21px] font-bold leading-snug">{pub.qcTitle}</h2>
            ) : null}
            {pub.qcBody ? (
              <p className="mt-3 text-[14.5px] leading-relaxed text-zup-gray">{pub.qcBody}</p>
            ) : null}
            {pub.qcPoints.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {pub.qcPoints.map((pt) => (
                  <li key={pt} className="flex gap-2.5 text-[14.5px] text-zup-body">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-zup-blue" aria-hidden />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <OrderCta
              label={pub.buttonLabel}
              at="quality"
              ctaBg={theme.ctaBg}
              ctaText={theme.ctaText}
            />
          </Inner>
        </Section>
      ) : null}

      {/* ── 7. Urgency ──────────────────────────────────────────────────── */}
      {pub.countdownTitle ? (
        <Section bg={theme.bandBg} color={theme.bandText}>
          <Inner>
            <h2 className="text-center text-[22px] font-bold">{pub.countdownTitle}</h2>
            {pub.countdownEndsAt ? (
              <div className="mt-5">
                <CampaignCountdown
                  endsAt={pub.countdownEndsAt}
                  /* The server's clock, stamped per request so the first paint
                     shows the real remaining time instead of ০০ ০০ ০০. Safe
                     because this route renders on demand — the landing page
                     fetch is uncached, so there is no build-time value to go
                     stale. */
                  nowIso={new Date().toISOString()}
                  labels={["দিন", "ঘণ্টা", "মিনিট", "সেকেন্ড"]}
                />
              </div>
            ) : null}
            {pub.countdownNote ? (
              <p className="mt-5 text-center text-[14.5px] leading-relaxed text-white/80">
                {pub.countdownNote}
              </p>
            ) : null}
            <OrderCta
              label={pub.countdownCtaLabel}
              note={pub.countdownAssurance}
              at="countdown"
              ctaBg={theme.ctaBg}
              ctaText={theme.ctaText}
              className="mx-auto max-w-[360px]"
            />
          </Inner>
        </Section>
      ) : null}

      {/* ── 8. Testimonials ─────────────────────────────────────────────── */}
      {pub.testimonials.length ? (
        <Section>
          <Inner>
            {pub.testimonialsTitle ? (
              <h2 className="mb-6 text-center text-[22px] font-bold">{pub.testimonialsTitle}</h2>
            ) : null}
            <ul className="flex flex-col gap-3.5">
              {pub.testimonials.map((t, i) => (
                <li
                  key={`${t.name}-${i}`}
                  className="rounded-[2px] border border-zup-line bg-white p-4 sm:p-5"
                >
                  <p className="text-[13px] text-zup-orange" aria-label="5 out of 5">
                    ★★★★★
                  </p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-zup-body">{t.quote}</p>
                  <p className="mt-3 text-[13px] font-semibold text-zup-gray">
                    {t.name}
                    {t.location ? ` — ${t.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Inner>
        </Section>
      ) : null}

      {/* ── 9. Order form ───────────────────────────────────────────────── */}
      <Section bg={theme.tintBg}>
        <Inner>
          <div id="order" className="scroll-mt-20" />
          <CampaignOrderForm
            productId={product.id}
            bundles={pub.bundles}
            labels={pub.formLabels}
            title={pub.formTitle}
            intro={pub.formIntro}
            unitLabel={pub.bundleUnitLabel}
            campaignSlug={slug}
            productName={product.name}
            payMethod={payMethod}
            theme={{ ctaBg: theme.ctaBg, ctaText: theme.ctaText }}
          />
        </Inner>
      </Section>

      {/* ── 9b. Product row ───────────────────────────────────────────────
          Other products, after the order form and above the footer.

          It sat above the page body until now, which put a rack of exits
          between the visitor and the offer they had just clicked an ad for.
          Down here it catches the people who scrolled the whole page without
          ordering, instead of competing with the hero for the ones who would
          have. Hidden entirely when the admin has picked none, so a campaign
          stays single-product by default — which is the point of one. */}
      {productRow.length > 0 ? (
        <Section bg={theme.tintBg}>
          <Inner>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3">
              {productRow.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </Inner>
        </Section>
      ) : null}

      {/* ── 10. Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-zup-ink py-10 text-white">
        <Inner>
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/zup-mark.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-[16px] font-extrabold tracking-[0.05em]">ZUP TECH</span>
          </div>
          {pub.footerTagline ? (
            <p className="mt-1 text-[12px] uppercase tracking-[0.1em] text-white/50">
              {pub.footerTagline}
            </p>
          ) : null}
          {pub.footerAbout ? (
            <p className="mt-4 text-[14px] leading-relaxed text-white/70">{pub.footerAbout}</p>
          ) : null}
          {pub.footerLines.length ? (
            <ul className="mt-4 flex flex-col gap-2 text-[14px] text-white/70">
              {pub.footerLines.map((l) => (
                <li key={l} className="flex gap-2">
                  <Phone className="mt-1 h-3.5 w-3.5 flex-none text-white/40" aria-hidden />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {pub.footerNote ? (
            <p className="mt-6 border-t border-white/10 pt-4 text-[12.5px] text-white/50">
              {pub.footerNote}
            </p>
          ) : null}
        </Inner>
      </footer>
    </div>
  );
}
