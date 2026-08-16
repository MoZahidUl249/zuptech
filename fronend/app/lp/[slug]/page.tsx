import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check, Phone } from "lucide-react";
import { getLandingPage, getProductsByIds, getSiteConfig } from "@/lib/api";
import { formatBDTBangla as formatBDT, toBanglaDigits } from "@/lib/site";
import { LandingPageGtm } from "@/components/marketing/landing-page-gtm";
import { ProductCard } from "@/components/product-card";
import { CampaignOrderForm } from "@/components/marketing/campaign-order-form";
import { ProductVideo } from "@/components/product-video";
import { parseProductVideo } from "@/lib/video";
import { CampaignCountdown } from "@/components/marketing/campaign-countdown";

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

/**
 * One band of the page.
 *
 * Colours arrive as inline `style`, not Tailwind classes, because they are
 * per-campaign values from the database — a class name cannot be built from a
 * runtime hex and have Tailwind emit it. They are hex-validated at the DTO
 * (`hexColor` in landing-pages.dto.ts), which is what makes interpolating them
 * here safe; nothing else in this file re-checks them.
 *
 * Declared at module scope so React keeps the same component identity across
 * renders instead of remounting the whole section.
 */
function Section({
  children,
  className = "",
  bg,
  color,
}: {
  children: React.ReactNode;
  className?: string;
  bg?: string;
  color?: string;
}) {
  return (
    <section
      className={`px-5 py-10 sm:py-12 ${className}`}
      style={{ backgroundColor: bg, color }}
    >
      {children}
    </section>
  );
}

/**
 * A full-width band of flat colour carrying one loud line.
 *
 * The reference design leans on these hard — the price, the bundle saving and
 * the product statement each get their own coloured strip rather than sitting
 * in a card. That is what makes the page read as a direct-response page rather
 * than a catalogue page, so it is a component here rather than a one-off.
 */
function ColourBand({
  children,
  bg,
  color,
  className = "",
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
  className?: string;
}) {
  return (
    <section className={`px-5 py-7 text-center ${className}`} style={{ backgroundColor: bg, color }}>
      <div className="mx-auto w-full max-w-[720px]">{children}</div>
    </section>
  );
}

/** The reading column every band shares. */
function Inner({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[720px]">{children}</div>;
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
 * derived from the product's quantity offers — a campaign cannot advertise a
 * price the cart will refuse.
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
  const orderHref = "#order";

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

      {/* ── 1. Header: the site's own mark, hotline, and a jump to the form ── */}
      <header
        className="sticky top-0 z-30 border-b border-zup-line backdrop-blur"
        style={{ backgroundColor: theme.tintBg }}
      >
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/zup-mark.png"
              alt="ZUP TECH"
              width={30}
              height={30}
              className="h-[30px] w-[30px] object-contain"
              priority
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
                href={orderHref}
                className="rounded-[2px] px-4 py-2 text-[13.5px] font-semibold"
                style={{ backgroundColor: theme.ctaBg, color: theme.ctaText }}
              >
                {pub.headerCtaLabel}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── 2. Hero ─────────────────────────────────────────────────────── */}
      {/* The hero carries the campaign's own colours and a headline scaled to
          the reference design — clamp tops out near 44px rather than 34px,
          because on a direct-response page the headline is the argument, not a
          label above one. */}
      <Section className="pt-8" bg={theme.heroBg} color={theme.heroText}>
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
            under two competing things. The longer demo section further down
            is unaffected — a campaign can run either, both, or neither.

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
          */}
          {heroVideo ? (
            <div className="relative mt-6 overflow-hidden rounded-[2px] border border-white/15">
              <ProductVideo url={pub.heroVideoUrl} />
            </div>
          ) : (
          <div className="relative mt-6 overflow-hidden rounded-[2px] border border-white/15">
            {product.photos?.[0] ? (
              <Image
                src={product.photos[0]!}
                alt={product.name}
                width={720}
                height={540}
                className="h-auto w-full object-cover"
                priority
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-[repeating-linear-gradient(135deg,#f4f5f7_0_12px,#eceef1_12px_24px)]">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[12px] text-zup-soft">
                  {pub.imageHint || product.name}
                </span>
              </div>
            )}
            {pub.discountBadge ? (
              <span
                className="absolute right-3 top-3 rounded-[2px] px-3 py-1 text-[12.5px] font-extrabold"
                style={{ backgroundColor: theme.highlight, color: theme.pageText }}
              >
                {pub.discountBadge}
              </span>
            ) : null}
          </div>
          )}

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-[34px] font-bold leading-none">{formatBDT(one?.total ?? 0)}</span>
            {one && one.wasTotal > one.total ? (
              <span className="text-[19px] opacity-70 line-through">
                {formatBDT(one.wasTotal)}
              </span>
            ) : null}
          </div>

          <a
            href={orderHref}
            className="mt-5 block rounded-[2px] px-5 py-3.5 text-center text-[clamp(16px,3.6vw,22px)] font-extrabold"
            style={{ backgroundColor: theme.ctaBg, color: theme.ctaText }}
          >
            {pub.buttonLabel}
          </a>
          {pub.heroCtaNote ? (
            <p className="mt-2.5 text-center text-[12.5px] opacity-80">{pub.heroCtaNote}</p>
          ) : null}
        </Inner>
      </Section>

      {/* ── 2b. Price bands ───────────────────────────────────────────────
          Two coloured strips: what it used to cost, then what it costs now,
          the second set several times larger. The reference design gives the
          offer price a line of its own at roughly twice the heading size —
          on a direct-response page the price IS the headline, and burying it
          in a card beside the copy is what makes a campaign page read like a
          catalogue page. Both numbers are campaign copy; the cart still
          reprices through priceCart(). */}
      {pub.compareAtPrice > 0 ? (
        <ColourBand bg={theme.bandBg} color={theme.bandText} className="py-4">
          <p className="text-[clamp(17px,3.4vw,24px)] font-bold">
            {pub.priceCompareLabel || "Previous price"}{" "}
            <span className="line-through">{formatBDT(pub.compareAtPrice)}</span>
          </p>
        </ColourBand>
      ) : null}

      {pub.offerPrice > 0 ? (
        <ColourBand bg={theme.bandBg} color={theme.bandText}>
          <p className="text-[clamp(15px,2.8vw,20px)] font-bold uppercase tracking-[0.08em] opacity-90">
            {pub.priceOfferLabel || "Offer price"}
          </p>
          <p className="mt-1 text-[clamp(38px,9vw,72px)] font-extrabold leading-none tracking-[-0.02em]">
            {formatBDT(pub.offerPrice)}
          </p>
          {pub.ribbonText ? (
            <p className="mt-3 text-[clamp(17px,3.6vw,26px)] font-extrabold" style={{ color: theme.highlight }}>
              {pub.ribbonText}
            </p>
          ) : null}
          <a
            href={orderHref}
            className="mt-5 inline-flex items-center justify-center rounded-[2px] px-8 py-3.5 text-[clamp(16px,3.4vw,22px)] font-extrabold"
            style={{ backgroundColor: theme.ctaBg, color: theme.ctaText }}
          >
            {pub.buttonLabel || "Order now"}
          </a>
        </ColourBand>
      ) : null}

      {/* ── 3. Brand strip ──────────────────────────────────────────────── */}
      {pub.brandLogos.length ? (
        <Section className="border-y border-zup-line py-7" bg={theme.tintBg}>
          <Inner>
            {pub.brandStripTitle ? (
              <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-zup-soft">
                {pub.brandStripTitle}
              </p>
            ) : null}
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {pub.brandLogos.map((b) => (
                <li key={b} className="text-[13px] font-semibold text-zup-gray">
                  {b}
                </li>
              ))}
            </ul>
          </Inner>
        </Section>
      ) : null}

      {/* ── 4. Video ────────────────────────────────────────────────────── */}
      {pub.videoUrl ? (
        <Section>
          <Inner>
            {pub.videoTitle ? (
              <h2 className="mb-4 text-center text-[21px] font-bold leading-snug">
                {pub.videoTitle}
              </h2>
            ) : null}
            {/*
              The real player, not a picture of one.
             
              This was an <a> wrapping a grey box and a play glyph: it opened
              YouTube in a new tab and could never play on the page, so a
              campaign that set a video sent its traffic away at the moment it
              was most engaged. ProductVideo is what the product page and the
              hero above already use — a genuine thumbnail, and the iframe only
              after a click, so the embed still costs nothing to the visitors
              who never press play.
            */}
            <ProductVideo url={pub.videoUrl} />
          </Inner>
        </Section>
      ) : null}

      {/* ── 5. Numbered features ────────────────────────────────────────── */}
      {pub.features.length ? (
        <Section bg={theme.tintBg}>
          <Inner>
            {pub.featuresTitle ? (
              <h2 className="mb-6 text-center text-[22px] font-bold">{pub.featuresTitle}</h2>
            ) : null}
            <ol className="flex flex-col gap-3.5">
              {pub.features.map((f, i) => (
                <li
                  key={`${f.title}-${i}`}
                  className="rounded-2xl border border-zup-line bg-white p-4 sm:p-5"
                >
                  <span className="font-mono text-[12.5px] font-bold text-zup-blue">
                    {toBanglaDigits(String(i + 1).padStart(2, "0"))}
                  </span>
                  <h3 className="mt-1 text-[16.5px] font-bold leading-snug">{f.title}</h3>
                  {f.body ? (
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-zup-gray">{f.body}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Inner>
        </Section>
      ) : null}

      {/* ── 6. Spec sheet ───────────────────────────────────────────────── */}
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
                <div key={`${s.label}-${i}`} className="rounded-xl bg-white/5 p-4">
                  <dt className="font-mono text-[22px] font-bold leading-none">{s.value}</dt>
                  <dd className="mt-1.5 text-[12.5px] text-white/60">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Inner>
        </Section>
      ) : null}

      {/* ── 7. Bundle ladder — priced from the product, never from copy ─── */}
      {pub.bundles.length > 1 ? (
        <Section>
          <Inner>
            {pub.bundlesTitle ? (
              <h2 className="text-center text-[22px] font-bold">{pub.bundlesTitle}</h2>
            ) : null}
            {pub.bundlesSubtitle ? (
              <p className="mt-2 text-center text-[14.5px] text-zup-gray">{pub.bundlesSubtitle}</p>
            ) : null}
            <ul className="mt-6 flex flex-col gap-3">
              {pub.bundles.map((b) => (
                <li
                  key={b.qty}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-zup-line bg-white p-4"
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

      {/* ── 8. Quality control / anti-counterfeit ───────────────────────── */}
      {pub.qcTitle || pub.qcBody ? (
        <Section bg={theme.tintBg}>
          <Inner>
            <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border border-zup-line bg-[repeating-linear-gradient(135deg,#f4f5f7_0_12px,#eceef1_12px_24px)]">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[12px] text-zup-soft">
                {pub.qcImageHint}
              </span>
            </div>
            {pub.qcTitle ? (
              <h2 className="mt-5 text-[21px] font-bold leading-snug">{pub.qcTitle}</h2>
            ) : null}
            {pub.qcBody ? (
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-zup-gray">{pub.qcBody}</p>
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
          </Inner>
        </Section>
      ) : null}

      {/* ── 9. Urgency ──────────────────────────────────────────────────── */}
      {pub.countdownTitle ? (
        <Section bg={theme.bandBg} color={theme.bandText}>
          <Inner>
            <h2 className="text-center text-[22px] font-bold">{pub.countdownTitle}</h2>
            {pub.countdownEndsAt ? (
              <div className="mt-5">
                <CampaignCountdown
                  endsAt={pub.countdownEndsAt}
                  labels={["ঘণ্টা", "মিনিট", "সেকেন্ড"]}
                />
              </div>
            ) : null}
            {pub.countdownNote ? (
              <p className="mt-5 text-center text-[14.5px] leading-relaxed text-white/80">
                {pub.countdownNote}
              </p>
            ) : null}
            {pub.countdownCtaLabel ? (
              <a
                href={orderHref}
                className="mx-auto mt-5 block max-w-[360px] rounded-[2px] px-5 py-3.5 text-center text-[16px] font-extrabold"
                style={{ backgroundColor: theme.ctaBg, color: theme.ctaText }}
              >
                {pub.countdownCtaLabel}
              </a>
            ) : null}
            {pub.countdownAssurance ? (
              <p className="mt-3 text-center text-[12.5px] text-white/70">
                {pub.countdownAssurance}
              </p>
            ) : null}
          </Inner>
        </Section>
      ) : null}

      {/* ── 10. Testimonials ────────────────────────────────────────────── */}
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
                  className="rounded-2xl border border-zup-line bg-white p-4 sm:p-5"
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

      {/* ── 11. Order form ──────────────────────────────────────────────── */}
      <Section bg={theme.tintBg}>
        <Inner>
          <div id="order" className="scroll-mt-20" />
          <CampaignOrderForm
            productId={product.id}
            bundles={pub.bundles}
            labels={pub.formLabels}
            title={pub.formTitle}
            intro={pub.formIntro}
            deliveryFee={product.deliveryFeeInsideDhaka ?? 0}
            unitLabel={pub.bundleUnitLabel}
            campaignSlug={slug}
            payMethod={payMethod}
          />
        </Inner>
      </Section>

      {/* ── 11b. Product row ──────────────────────────────────────────────
          Other products, after the order form and above the footer.

          It sat above the page body until now, which put a rack of exits
          between the visitor and the offer they had just clicked an ad for.
          Down here it catches the people who scrolled the whole page without
          ordering, instead of competing with the hero for the ones who would
          have. Hidden entirely when the admin has picked none, so a campaign
          stays single-product by default — which is the point of one. */}
      {productRow.length > 0 ? (
        <Section bg={theme.tintBg}>
          <div className="mx-auto w-full max-w-[1120px]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3">
              {productRow.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── 12. Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-zup-ink px-5 py-10 text-white">
        <div className="mx-auto w-full max-w-[720px]">
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
            <ul className="mt-4 flex flex-col gap-1.5 text-[14px] text-white/70">
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
        </div>
      </footer>
    </div>
  );
}
