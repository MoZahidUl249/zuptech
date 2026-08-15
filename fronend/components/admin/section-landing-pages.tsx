"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Eye, Copy, ExternalLink } from "lucide-react";
import { isUnsaved, useAdmin, taka, tempId, type AdminProduct } from "@/lib/admin";
import {
  useLandingPages,
  createLandingPage,
  patchLandingPage,
  deleteLandingPage,
  publishLandingPage,
  unpublishLandingPage,
  duplicateLandingPage,
  campaignProblems,
  BUNDLE_MAX_ROWS,
  type ColorKey,
  type LandingPage,
  type LandingPageDraft,
} from "@/lib/admin-landing-pages";
import { site } from "@/lib/site";
import { numberInput } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductPicker } from "./products/product-picker";
import { OfferTierEditor } from "./products/offer-tier-editor";
import { ConfirmDialog } from "./confirm-dialog";

function shareUrl(slug: string): string {
  return `${site.url}/lp/${slug}`;
}

export function LandingPagesSection() {
  const { state, can } = useAdmin();
  const readOnly = can("landingpages") !== "manage";
  const { pages, loading, error, reload } = useLandingPages();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pages.find((p) => p.id === selectedId) ?? null;
  // Staged products have no server id yet, so a campaign can't point at one —
  // the POST would carry an id the server has never seen.
  const savedProducts = state.products.filter((p) => !isUnsaved(p));

  const addPage = async () => {
    const firstProduct = savedProducts[0];
    if (!firstProduct) {
      toast.error("Add a product to the catalog first");
      return;
    }
    try {
      const created = await createLandingPage({
        title: "New landing page",
        headline: "",
        slug: tempId("lp"),
        productId: firstProduct.id,
        offerPrice: firstProduct.price,
        compareAtPrice: firstProduct.price,
        ribbonText: "",
        buttonLabel: "Order Now",
        footerNote: "",
        benefitBullets: [],
        imageHint: "",
        gtmId: "",
        published: false,
      });
      await reload();
      setSelectedId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create landing page");
    }
  };

  if (selected) {
    return (
      <LandingPageEditor
        key={selected.id}
        page={selected}
        readOnly={readOnly}
        products={savedProducts}
        onBack={() => setSelectedId(null)}
        onChanged={reload}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[560px] text-ui-sm leading-relaxed text-zup-gray">
          Product-specific campaign pages. They are never linked from the store,
          never appear in search or navigation — the only way in is the share
          link. Each page carries its own GTM container so ad spend is tracked
          separately.
        </p>
        {!readOnly ? (
          <Button onClick={() => void addPage()}>
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> New landing page
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zup-gray">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Couldn&apos;t load landing pages.</p>
      ) : pages.length === 0 ? (
        <Card className="px-6 py-8 text-center text-sm text-zup-gray">
          No landing pages yet.
        </Card>
      ) : (
        pages.map((page) => (
          <Card
            key={page.id}
            className="cursor-pointer px-5 py-5 transition-shadow hover:shadow-md sm:px-6"
            onClick={() => setSelectedId(page.id)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge variant={page.published ? "default" : "secondary"} className="mb-2">
                  {page.published ? "Live via link" : "Draft"}
                </Badge>
                <p className="text-ui-base font-bold">{page.title}</p>
                <p className="text-ui-sm text-zup-gray">
                  {page.productName}
                  {!page.productVisible ? (
                    <span
                      className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-ui-micro font-bold text-warn-fg"
                      title="This product is not on the storefront — this landing page is the only way to buy it."
                    >
                      Off-catalogue
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 font-mono text-xs text-zup-soft">
                  /lp/{page.slug} · {page.viewCount.toLocaleString()} views ·{" "}
                  {page.orderCount.toLocaleString()} orders
                </p>
              </div>
              <span className="whitespace-nowrap text-ui-base font-bold">
                {taka(page.offerPrice)}
              </span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}


/* ===== Campaign content editing helpers =====
 *
 * The repeatable blocks are edited as plain text — one item per line, and for
 * the two-part blocks a `left | right` split. It reads as typing rather than
 * as a form, which is what writing ad copy actually is, and it keeps a
 * thirty-field page from becoming thirty nested repeater widgets.
 */

const toLines = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean);

/** "Fast charging | 30 minutes to 60%" -> { title, body } */
function parsePairs<A extends string, B extends string>(text: string, a: A, b: B) {
  return toLines(text).map((line) => {
    const [first = "", ...rest] = line.split("|");
    return { [a]: first.trim(), [b]: rest.join("|").trim() } as Record<A | B, string>;
  });
}

/** "Quote | Name | Location" -> { quote, name, location } */
function parseTestimonials(text: string) {
  return toLines(text).map((line) => {
    const [quote = "", name = "", location = ""] = line.split("|");
    return { quote: quote.trim(), name: name.trim(), location: location.trim() };
  });
}

const joinPairs = (rows: { [k: string]: string }[], a: string, b: string) =>
  rows.map((r) => `${r[a] ?? ""} | ${r[b] ?? ""}`).join("\n");

function linesOf(p: LandingPage) {
  return {
    trustBadges: (p.trustBadges ?? []).join("\n"),
    brandLogos: (p.brandLogos ?? []).join("\n"),
    qcPoints: (p.qcPoints ?? []).join("\n"),
    footerLines: (p.footerLines ?? []).join("\n"),
  };
}

function blocksOf(p: LandingPage) {
  return {
    features: joinPairs(p.features ?? [], "title", "body"),
    specs: joinPairs(p.specs ?? [], "value", "label"),
    testimonials: (p.testimonials ?? [])
      .map((t) => `${t.quote} | ${t.name} | ${t.location}`)
      .join("\n"),
  };
}

function LandingPageEditor({
  page,
  readOnly,
  products,
  onBack,
  onChanged,
}: {
  page: LandingPage;
  readOnly: boolean;
  products: AdminProduct[];
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const { state, update } = useAdmin();
  const [draft, setDraft] = useState<LandingPage>(page);
  const [bulletsText, setBulletsText] = useState(page.benefitBullets.join("\n"));

  /*
   * The product this campaign sells, read live from the store rather than
   * from the `products` prop — the tier editor below writes to it, and the
   * rows have to come back changed for the count and the preview to move.
   */
  const campaignProduct = state.products.find((p) => p.id === draft.productId) ?? null;

  /*
   * Bundle tiers belong to the PRODUCT, not to this campaign, and editing
   * them here edits them everywhere the product is sold.
   *
   * That is the point rather than a compromise. The page's bundle prices are
   * computed from these tiers at render time precisely so a campaign cannot
   * advertise a total the cart will not charge; a per-campaign copy of them
   * would be the one way back to that bug. Adding the control here means the
   * ladder can be built without leaving the campaign, while the numbers stay
   * derived from the single source that checkout also reads.
   *
   * It saves through the admin's own diff engine (Rule A in lib/admin.tsx),
   * not this screen's Save button — the note under the editor says so,
   * because a control that saves on a different schedule to the one above it
   * is otherwise a trap.
   */
  const setTiers = (quantityOffers: AdminProduct["quantityOffers"]) => {
    if (!campaignProduct) return;
    update({
      products: state.products.map((p) =>
        p.id === campaignProduct.id ? { ...p, quantityOffers } : p,
      ),
    });
  };
  /* Campaign list fields are edited as one-per-line text — a repeater widget
     per list would be five widgets for what is, in practice, typing. */
  const [lists, setLists] = useState(() => linesOf(page));
  const [blocks, setBlocks] = useState(() => blocksOf(page));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Re-sync local draft state when the `page` prop changes to a genuinely
  // different object (e.g. after save/publish/duplicate re-fetches the
  // list) — adjusting state during render instead of an effect, per React's
  // guidance for "resetting state when a prop changes" (avoids an extra
  // commit + the set-state-in-effect lint rule).
  const [syncedPage, setSyncedPage] = useState(page);
  if (page !== syncedPage) {
    setSyncedPage(page);
    setDraft(page);
    setBulletsText(page.benefitBullets.join("\n"));
    setLists(linesOf(page));
    setBlocks(blocksOf(page));
  }

  const set = <K extends keyof LandingPage>(key: K, value: LandingPage[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setSaving(true);
    const patch: Partial<LandingPageDraft> = {
      title: draft.title,
      headline: draft.headline,
      slug: draft.slug,
      productId: draft.productId,
      offerPrice: Number(draft.offerPrice) || 0,
      compareAtPrice: Number(draft.compareAtPrice) || 0,
      ribbonText: draft.ribbonText,
      buttonLabel: draft.buttonLabel,
      footerNote: draft.footerNote,
      imageHint: draft.imageHint,
      gtmId: draft.gtmId,
      /*
       * Sent, but no longer editable. The rebuilt template renders `features`
       * and reads this column nowhere, so its control was copy going nowhere —
       * the worst thing to leave on a screen whose job is to say what each
       * line changes. Still written back untouched so an existing campaign's
       * text survives a save, and so restoring the control is a one-line
       * change if the column ever earns a renderer again.
       */
      benefitBullets: toLines(bulletsText),

      /* Campaign content. Everything a visitor reads, saved with the rest —
         there is no second save button for "the page itself". */
      hotlineLabel: draft.hotlineLabel,
      hotlineNumber: draft.hotlineNumber,
      headerCtaLabel: draft.headerCtaLabel,
      trustBadges: toLines(lists.trustBadges),
      subheadline: draft.subheadline,
      discountBadge: draft.discountBadge,
      heroCtaNote: draft.heroCtaNote,
      brandStripTitle: draft.brandStripTitle,
      brandLogos: toLines(lists.brandLogos),
      heroVideoUrl: draft.heroVideoUrl,
      videoTitle: draft.videoTitle,
      videoUrl: draft.videoUrl,
      featuresTitle: draft.featuresTitle,
      features: parsePairs(blocks.features, "title", "body"),
      specTitle: draft.specTitle,
      specMeta: draft.specMeta,
      specs: parsePairs(blocks.specs, "value", "label"),
      bundlesTitle: draft.bundlesTitle,
      bundlesSubtitle: draft.bundlesSubtitle,
      bundleUnitLabel: draft.bundleUnitLabel,
      bundleMaxQty: Number(draft.bundleMaxQty) || 1,
      qcTitle: draft.qcTitle,
      qcBody: draft.qcBody,
      qcPoints: toLines(lists.qcPoints),
      qcImageHint: draft.qcImageHint,
      countdownTitle: draft.countdownTitle,
      countdownNote: draft.countdownNote,
      countdownEndsAt: draft.countdownEndsAt,
      countdownCtaLabel: draft.countdownCtaLabel,
      countdownAssurance: draft.countdownAssurance,
      testimonialsTitle: draft.testimonialsTitle,
      testimonials: parseTestimonials(blocks.testimonials),
      formTitle: draft.formTitle,
      formIntro: draft.formIntro,
      formLabels: draft.formLabels,
      footerTagline: draft.footerTagline,
      footerAbout: draft.footerAbout,
      footerLines: toLines(lists.footerLines),

      /* Theme + the row above the page. Saved with everything else — a colour
         change is an edit to the campaign, not a separate mode. */
      colorHeroBg: draft.colorHeroBg,
      colorHeroText: draft.colorHeroText,
      colorBandBg: draft.colorBandBg,
      colorBandText: draft.colorBandText,
      colorTintBg: draft.colorTintBg,
      colorPageBg: draft.colorPageBg,
      colorPageText: draft.colorPageText,
      colorAccent: draft.colorAccent,
      colorHighlight: draft.colorHighlight,
      colorCtaBg: draft.colorCtaBg,
      colorCtaText: draft.colorCtaText,
      productRowIds: draft.productRowIds ?? [],
      priceCompareLabel: draft.priceCompareLabel,
      priceOfferLabel: draft.priceOfferLabel,
    };
    /*
     * Catch what the server would reject, while the copy is still on screen.
     *
     * Every one of these rules answers 422 with a schema dump — it names the
     * field as the DTO spells it and says nothing about the limit. On a page
     * of unsaved ad copy that is the worst possible moment to be unhelpful,
     * so the same rules are checked here, reported in words, and nothing is
     * sent until they pass.
     */
    const problems = campaignProblems(patch);
    if (problems.length > 0) {
      setSaving(false);
      toast.error(problems.join(" "));
      return;
    }

    try {
      await patchLandingPage(page.id, patch);
      await onChanged();
      toast.success("Landing page saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    try {
      if (draft.published) await unpublishLandingPage(page.id);
      else await publishLandingPage(page.id);
      await onChanged();
      toast.success(draft.published ? "Unpublished" : "Published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    }
  };

  const duplicate = async () => {
    try {
      await duplicateLandingPage(page.id);
      await onChanged();
      toast.success("Duplicated as a draft");
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't duplicate");
    }
  };

  const remove = async () => {
    try {
      await deleteLandingPage(page.id);
      await onChanged();
      toast.success("Landing page deleted");
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(page.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to landing pages
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer" />}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> Preview
          </Button>
          {!readOnly ? (
            <>
              {draft.published ? (
                // Taking a live page down closes the only checkout route for a
                // product that is hidden from the storefront, so it asks first.
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      Unpublish
                    </Button>
                  }
                  title="Take this campaign page down?"
                  description="The link stops working immediately. If its product isn't listed on the storefront, this is the only way anyone could buy it."
                  confirmLabel="Unpublish"
                  onConfirm={() => void togglePublish()}
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => void togglePublish()}>
                  Publish
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => void duplicate()}>
                Duplicate
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                }
                title="Delete this landing page?"
                description={`"${page.title}" and its share link will stop working immediately. This can't be undone.`}
                confirmLabel="Delete"
                onConfirm={() => void remove()}
              />
            </>
          ) : null}
        </div>
      </div>

      <Card
        className={`px-5 py-4 sm:px-6 ${draft.published ? "ring-zup-green/30" : "ring-transparent"}`}
      >
        <p className="mb-2 text-ui-sm font-bold text-zup-gray">
          {draft.published ? (
            <span className="text-zup-green">Live — anyone with the link can order</span>
          ) : (
            "Draft — not reachable yet"
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-ui-xs">
            {shareUrl(draft.slug)}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
            <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied!" : "Copy share link"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer" />}
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </Card>

      {/*
        The page, section by section, in the order a visitor meets them.

        Each band says what it controls and opens on its own; the first is open
        because a new campaign always starts there. "Benefit bullets" is
        deliberately absent — the rebuilt template renders `features` instead
        and never read that column, so the control was copy going nowhere. The
        stored value still round-trips on save, so nothing is lost if the
        column comes back.
      */}
      <div className="flex flex-col gap-2.5">
        <Group
          step={1}
          title="Setup"
          hint="Names and wiring. None of this is shown to visitors."
          defaultOpen
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Internal title">
              <Input
                value={draft.title}
                disabled={readOnly}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label="Link slug">
              <Input
                value={draft.slug}
                disabled={readOnly}
                onChange={(e) => set("slug", e.target.value)}
                className="font-mono"
              />
              {/*
                The slug IS the ad's destination. Editing it on a published
                campaign retires the old URL the moment it saves, and every
                ad, post and message already pointing there starts 404ing —
                money still being spent, traffic landing nowhere, and nothing
                anywhere to say so.
              */}
              {draft.published && draft.slug !== page.slug ? (
                <p className="mt-1 text-ui-micro font-semibold leading-snug text-warn-fg">
                  This campaign is live. Saving this breaks the old link
                  (/lp/{page.slug}) — any ad pointing at it will 404. Duplicate
                  the page instead if the old link must keep working.
                </p>
              ) : null}
            </Field>
            <Field label="Product">
              <select
                value={draft.productId}
                disabled={readOnly}
                onChange={(e) => set("productId", e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.visible ? "" : " — off-catalogue"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="GTM container id">
              <Input
                value={draft.gtmId}
                disabled={readOnly}
                onChange={(e) => set("gtmId", e.target.value)}
                placeholder="GTM-XXXXXXX"
                className="font-mono"
              />
            </Field>
          </div>
        </Group>

        <Group
          step={2}
          title="Product row"
          hint="A strip of other products across the top of the page. Leave empty to hide it."
        >
          <ProductPicker
            ids={draft.productRowIds ?? []}
            onChange={(ids) => set("productRowIds", ids)}
            label="the product row"
            addLabel="Add a product to the row"
            emptyNote="No row — the page opens straight into the campaign."
            readOnly={readOnly}
            // The page is already about this product; listing it in its own
            // row is noise, and the same rule the recommendations picker uses.
            excludeId={draft.productId}
            selectId="lp-product-row"
          />
        </Group>

        <Group
          step={3}
          title="Header strip"
          hint="The thin bar at the very top: hotline and the button beside it."
        >
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Hotline label">
              <Input value={draft.hotlineLabel ?? ""} disabled={readOnly}
                onChange={(e) => set("hotlineLabel", e.target.value)}
                placeholder="হটলাইন (১০টা–১০টা)" />
            </Field>
            <Field label="Hotline number">
              <Input value={draft.hotlineNumber ?? ""} disabled={readOnly}
                onChange={(e) => set("hotlineNumber", e.target.value)}
                placeholder="০৯৬৩৪-৪৪৫৫৬৬" />
            </Field>
            <Field label="Header button">
              <Input value={draft.headerCtaLabel ?? ""} disabled={readOnly}
                onChange={(e) => set("headerCtaLabel", e.target.value)}
                placeholder="অর্ডার করুন" />
            </Field>
          </div>
        </Group>

        <Group
          step={4}
          title="Hero"
          hint="The first screen: headline, the badges around it, and the main button."
        >
          <Field label="Public headline">
            <Input
              value={draft.headline}
              disabled={readOnly}
              // Blank is fine and common — the backend falls back to the
              // product name, which is a better ad headline than an internal
              // working title ever is.
              placeholder={page.productName}
              onChange={(e) => set("headline", e.target.value)}
            />
            <p className="mt-1 text-ui-micro leading-snug text-zup-soft">
              The &lt;h1&gt; visitors see. Leave blank to use the product name.
              The internal title in step 1 is never shown publicly.
            </p>
          </Field>
          <Field label="Sub-headline">
            <Textarea value={draft.subheadline ?? ""} disabled={readOnly} rows={3}
              onChange={(e) => set("subheadline", e.target.value)} />
          </Field>
          <Field label="Trust badges (one per line)">
            <Textarea value={lists.trustBadges} disabled={readOnly} rows={3}
              onChange={(e) => setLists({ ...lists, trustBadges: e.target.value })}
              placeholder={"১০০% অরিজিনাল\n০৬ মাস ওয়ারেন্টি\nক্যাশ অন ডেলিভারি"} />
            <LimitNote count={toLines(lists.trustBadges).length} max={6} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Discount badge (on the photo)">
              <Input value={draft.discountBadge ?? ""} disabled={readOnly}
                onChange={(e) => set("discountBadge", e.target.value)}
                placeholder="৩৩% ছাড়" />
            </Field>
            <Field label="Ribbon / urgency badge">
              <Input
                value={draft.ribbonText}
                disabled={readOnly}
                onChange={(e) => set("ribbonText", e.target.value)}
              />
            </Field>
            <Field label="Main button label">
              <Input
                value={draft.buttonLabel}
                disabled={readOnly}
                onChange={(e) => set("buttonLabel", e.target.value)}
              />
            </Field>
            <Field label="Note under the button">
              <Input value={draft.heroCtaNote ?? ""} disabled={readOnly}
                onChange={(e) => set("heroCtaNote", e.target.value)} />
            </Field>
          </div>
          <Field label="Hero video (blank = show the product photo)">
            <Input
              value={draft.heroVideoUrl ?? ""}
              disabled={readOnly}
              onChange={(e) => set("heroVideoUrl", e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
            <p className="mt-1 text-ui-micro leading-snug text-zup-soft">
              Replaces the photo at the top of the page. It loads as a
              thumbnail and only plays when tapped. The longer video in step 7
              is separate — a campaign can use either, both or neither.
            </p>
          </Field>
          <Field label="Image placeholder hint">
            <Input
              value={draft.imageHint}
              disabled={readOnly}
              onChange={(e) => set("imageHint", e.target.value)}
              placeholder="e.g. IPS unit + battery photo"
            />
          </Field>
        </Group>

        <Group
          step={5}
          title="Prices"
          hint="The two figures in the coloured bands — advertising copy, not what the cart charges."
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Offer price (৳)">
              <Input
                type="number"
                value={draft.offerPrice}
                disabled={readOnly}
                onChange={(e) => set("offerPrice", numberInput(e.target.value))}
              />
              {/* Money is always recomputed from the catalog at checkout
                  (cal-bk.md §3) — this field is ad copy. Without this warning
                  a campaign can advertise a price the cart silently won't
                  honour, which is a refund conversation, not a bug report. */}
              {Number(draft.offerPrice) !== page.productSellingPrice ? (
                <p className="mt-1 text-ui-micro font-semibold leading-snug text-warn-fg">
                  Checkout will charge {taka(page.productSellingPrice)} — set the
                  product&apos;s sale price to match, or buyers see one price and pay
                  another.
                </p>
              ) : null}
            </Field>
            <Field label="Compare-at price (৳)">
              <Input
                type="number"
                value={draft.compareAtPrice}
                disabled={readOnly}
                onChange={(e) => set("compareAtPrice", numberInput(e.target.value))}
              />
            </Field>
            <Field label="Label for the compare-at price">
              <Input value={draft.priceCompareLabel ?? ""} disabled={readOnly}
                onChange={(e) => set("priceCompareLabel", e.target.value)}
                placeholder="পূর্বের দাম" />
              <p className="mt-1 text-ui-micro leading-snug text-zup-soft">
                Blank shows English wording.
              </p>
            </Field>
            <Field label="Label for the offer price">
              <Input value={draft.priceOfferLabel ?? ""} disabled={readOnly}
                onChange={(e) => set("priceOfferLabel", e.target.value)}
                placeholder="অফার প্রাইস" />
            </Field>
          </div>
        </Group>

        <Group step={6} title="Brand strip" hint="The logos row: payment and courier partners.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Brand strip title">
              <Input value={draft.brandStripTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("brandStripTitle", e.target.value)}
                placeholder="যাদের সাথে আমরা কাজ করি" />
            </Field>
            <Field label="Brand names (one per line)">
              <Textarea value={lists.brandLogos} disabled={readOnly} rows={3}
                onChange={(e) => setLists({ ...lists, brandLogos: e.target.value })}
                placeholder={"bKash\nNagad\nSteadFast"} />
              <LimitNote count={toLines(lists.brandLogos).length} max={10} />
            </Field>
          </div>
        </Group>

        <Group step={7} title="Video" hint="Leave the URL blank and the whole section disappears.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Video section title">
              <Input value={draft.videoTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("videoTitle", e.target.value)} />
            </Field>
            <Field label="Video URL">
              <Input value={draft.videoUrl ?? ""} disabled={readOnly}
                onChange={(e) => set("videoUrl", e.target.value)}
                placeholder="https://youtube.com/watch?v=…" />
            </Field>
          </div>
        </Group>

        <Group step={8} title="Features" hint="The numbered selling points down the page.">
          <Field label="Features title">
            <Input value={draft.featuresTitle ?? ""} disabled={readOnly}
              onChange={(e) => set("featuresTitle", e.target.value)} />
          </Field>
          <Field label="Features — one per line, “title | description”">
            <Textarea value={blocks.features} disabled={readOnly} rows={5}
              onChange={(e) => setBlocks({ ...blocks, features: e.target.value })}
              placeholder={"২২.৫ W সুপার ফাস্ট চার্জ | ৩০ মিনিটে ফোনে ৬০% চার্জ"} />
            <LimitNote count={toLines(blocks.features).length} max={12} />
          </Field>
        </Group>

        <Group step={9} title="Spec sheet" hint="The grid of numbers under the features.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Spec sheet title">
              <Input value={draft.specTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("specTitle", e.target.value)} />
            </Field>
            <Field label="Spec sheet meta line">
              <Input value={draft.specMeta ?? ""} disabled={readOnly}
                onChange={(e) => set("specMeta", e.target.value)}
                placeholder="ZT-PC20 · REV 2.4" />
            </Field>
          </div>
          <Field label="Specs — one per line, “value | label”">
            <Textarea value={blocks.specs} disabled={readOnly} rows={5}
              onChange={(e) => setBlocks({ ...blocks, specs: e.target.value })}
              placeholder={"২০,০০০ mAh | ক্যাপাসিটি"} />
            <LimitNote count={toLines(blocks.specs).length} max={10} />
          </Field>
        </Group>

        <Group
          step={10}
          title="Bundles"
          hint="Buy-more rows. Only the wording is here — every price comes from the product's quantity offers."
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Bundle section title">
              <Input value={draft.bundlesTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("bundlesTitle", e.target.value)} />
            </Field>
            <Field label="Bundle subtitle">
              <Input value={draft.bundlesSubtitle ?? ""} disabled={readOnly}
                onChange={(e) => set("bundlesSubtitle", e.target.value)} />
            </Field>
            <Field label="Unit word">
              <Input value={draft.bundleUnitLabel ?? ""} disabled={readOnly}
                onChange={(e) => set("bundleUnitLabel", e.target.value)}
                placeholder="পিস" />
            </Field>
            <Field label="How many bundle rows">
              <Input type="number" min={1} max={BUNDLE_MAX_ROWS} value={draft.bundleMaxQty ?? 3}
                disabled={readOnly}
                onChange={(e) => set("bundleMaxQty", numberInput(e.target.value))} />
              <p className="mt-1 text-ui-micro text-zup-soft">
                How many rows to draw, from 1 up. Prices are never typed here —
                they come from the offers below.
              </p>
            </Field>
          </div>

          {campaignProduct ? (
            <div className="rounded-lg border border-zup-line bg-secondary/40 p-3.5">
              <OfferTierEditor
                label={`Bundle offers — ${campaignProduct.name}`}
                hint="Add a tier for each quantity worth rewarding. Only the highest tier the order reaches applies; tiers never stack, and the customer always gets whichever is cheaper — this or the sale price."
                unitLabel="৳ off each unit"
                tiers={campaignProduct.quantityOffers}
                onChange={setTiers}
              />
              <p className="mt-2.5 text-ui-micro leading-snug text-warn-fg">
                These belong to the product, so they change it everywhere it is
                sold — and they save on their own, not with the button at the
                bottom of this page.
              </p>
              {/* The trap this page can otherwise walk an admin into: a sale
                  deeper than every tier makes the whole ladder show no saving,
                  because the customer already has the better price. Worth
                  saying here, where the tiers are typed. */}
              {campaignProduct.onSale &&
              campaignProduct.quantityOffers.length > 0 &&
              campaignProduct.quantityOffers.every(
                (t) => t.amount <= campaignProduct.price - campaignProduct.salePrice,
              ) ? (
                <p className="mt-2 text-ui-micro font-semibold leading-snug text-warn-fg">
                  Every tier here is smaller than this product&apos;s sale
                  discount ({taka(campaignProduct.price - campaignProduct.salePrice)} off),
                  so the bundle rows will all show no extra saving. Raise a tier
                  above that to make the ladder do anything.
                </p>
              ) : null}
            </div>
          ) : null}
        </Group>

        <Group step={11} title="Quality / anti-counterfeit" hint="The reassurance block with the photo.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Quality section title">
              <Input value={draft.qcTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("qcTitle", e.target.value)} />
            </Field>
            <Field label="Quality image hint">
              <Input value={draft.qcImageHint ?? ""} disabled={readOnly}
                onChange={(e) => set("qcImageHint", e.target.value)} />
            </Field>
          </div>
          <Field label="Quality section body">
            <Textarea value={draft.qcBody ?? ""} disabled={readOnly} rows={4}
              onChange={(e) => set("qcBody", e.target.value)} />
          </Field>
          <Field label="Quality points (one per line)">
            <Textarea value={lists.qcPoints} disabled={readOnly} rows={4}
              onChange={(e) => setLists({ ...lists, qcPoints: e.target.value })} />
            <LimitNote count={toLines(lists.qcPoints).length} max={8} />
          </Field>
        </Group>

        <Group step={12} title="Countdown" hint="Urgency block. Leave the deadline blank to keep the copy without a clock.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Countdown title">
              <Input value={draft.countdownTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("countdownTitle", e.target.value)}
                placeholder="অফার আজই শেষ!" />
            </Field>
            <Field label="Countdown ends at (blank = no clock)">
              <Input type="datetime-local" disabled={readOnly}
                value={(draft.countdownEndsAt ?? "").slice(0, 16)}
                onChange={(e) =>
                  set("countdownEndsAt", e.target.value ? new Date(e.target.value).toISOString() : "")
                } />
            </Field>
            <Field label="Countdown button">
              <Input value={draft.countdownCtaLabel ?? ""} disabled={readOnly}
                onChange={(e) => set("countdownCtaLabel", e.target.value)} />
            </Field>
            <Field label="Countdown assurance line">
              <Input value={draft.countdownAssurance ?? ""} disabled={readOnly}
                onChange={(e) => set("countdownAssurance", e.target.value)} />
            </Field>
          </div>
          <Field label="Countdown note">
            <Textarea value={draft.countdownNote ?? ""} disabled={readOnly} rows={2}
              onChange={(e) => set("countdownNote", e.target.value)} />
          </Field>
        </Group>

        <Group step={13} title="Testimonials" hint="Customer quotes.">
          <Field label="Testimonials title">
            <Input value={draft.testimonialsTitle ?? ""} disabled={readOnly}
              onChange={(e) => set("testimonialsTitle", e.target.value)} />
          </Field>
          <Field label="Testimonials — one per line, “quote | name | place”">
            <Textarea value={blocks.testimonials} disabled={readOnly} rows={5}
              onChange={(e) => setBlocks({ ...blocks, testimonials: e.target.value })}
              placeholder={"লোডশেডিংয়ের সময়ু ফোন চলে | সাইফুল ইসলাম | রাজশাহী"} />
            <LimitNote count={toLines(blocks.testimonials).length} max={12} />
          </Field>
        </Group>

        <Group step={14} title="Order form" hint="The cash-on-delivery form. Every label is yours, including the button.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Order form title">
              <Input value={draft.formTitle ?? ""} disabled={readOnly}
                onChange={(e) => set("formTitle", e.target.value)}
                placeholder="অর্ডারের তথ্য" />
            </Field>
            <Field label="Order form intro">
              <Input value={draft.formIntro ?? ""} disabled={readOnly}
                onChange={(e) => set("formIntro", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["name", "Name label"],
              ["phone", "Phone label"],
              ["address", "Address label"],
              ["packageLabel", "Package label"],
              ["deliveryLabel", "Delivery row"],
              ["totalLabel", "Total row"],
              ["submit", "Submit button"],
              ["namePlaceholder", "Name placeholder"],
              ["phonePlaceholder", "Phone placeholder"],
              ["addressPlaceholder", "Address placeholder"],
              ["successMessage", "Success message"],
            ] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  value={draft.formLabels?.[key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    set("formLabels", {
                      ...(draft.formLabels ?? ({} as LandingPage["formLabels"])),
                      [key]: e.target.value,
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </Group>

        <Group step={15} title="Footer" hint="The last block on the page.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Footer tagline">
              <Input value={draft.footerTagline ?? ""} disabled={readOnly}
                onChange={(e) => set("footerTagline", e.target.value)}
                placeholder="MAKES LIFE SIMPLE" />
            </Field>
            <Field label="Footer contact lines (one per line)">
              <Textarea value={lists.footerLines} disabled={readOnly} rows={3}
                onChange={(e) => setLists({ ...lists, footerLines: e.target.value })} />
              <LimitNote count={toLines(lists.footerLines).length} max={8} />
            </Field>
          </div>
          <Field label="Footer about">
            <Textarea value={draft.footerAbout ?? ""} disabled={readOnly} rows={3}
              onChange={(e) => set("footerAbout", e.target.value)} />
          </Field>
          <Field label="Footer note">
            <Input
              value={draft.footerNote}
              disabled={readOnly}
              onChange={(e) => set("footerNote", e.target.value)}
            />
          </Field>
        </Group>

        <Group
          step={16}
          title="Colours"
          hint="The whole palette, for this campaign only. Nothing here touches the main site."
        >
          {/* The preview is the point of putting all eleven on one screen:
              a palette is judged as a whole, and reading eleven hex codes
              tells you nothing about whether the button will be legible on
              the band behind it. */}
          <ThemePreview draft={draft} />
          <div className="grid gap-3.5 sm:grid-cols-2">
            {([
              ["colorPageBg", "Page background", "Behind everything."],
              ["colorPageText", "Body text", "Ordinary paragraph text."],
              ["colorHeroBg", "Hero band", "The deep block behind the headline, and the quality section."],
              ["colorHeroText", "Hero text", "Text sitting on the hero band."],
              ["colorBandBg", "Price bands", "The price strips and the countdown block."],
              ["colorBandText", "Price band text", "Text on those strips."],
              ["colorTintBg", "Quiet sections", "The soft alternating background: video, specs, testimonials."],
              ["colorAccent", "Accent", "Links, ticks and emphasis."],
              ["colorHighlight", "Highlight", "The bundle saving line — the one figure meant to catch the eye."],
              ["colorCtaBg", "Order button", "Every order button on the page."],
              ["colorCtaText", "Order button text", "The label on those buttons."],
            ] as const).map(([key, label, paints]) => (
              <ColorField
                key={key}
                label={label}
                paints={paints}
                value={draft[key] ?? ""}
                disabled={readOnly}
                onChange={(hex) => set(key, hex)}
              />
            ))}
          </div>
        </Group>
      </div>

      {!readOnly ? (
        <Card className="sticky bottom-3 z-10 flex items-center gap-3 px-4 py-3">
          {/* One save for the whole page. It follows the screen because the
              colour controls are sixteen sections below the first field, and
              a save button you have to scroll back to gets forgotten. */}
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <span className="text-ui-micro text-zup-soft">
            Saves every section above.
          </span>
        </Card>
      ) : null}
    </div>
  );
}

/** "3 of 6" under a list, turning red once the server would refuse it. */
function LimitNote({ count, max }: { count: number; max: number }) {
  const over = count > max;
  return (
    <p
      className={`mt-1 text-ui-micro leading-snug ${over ? "font-semibold text-warn-fg" : "text-zup-soft"}`}
    >
      {count} of {max}
      {over ? " — remove some, or the save is refused." : ""}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.04em] text-zup-soft">
        {label}
      </Label>
      {children}
    </div>
  );
}

/*
 * One numbered, collapsible band per section of the public page, in the order
 * a visitor scrolls through them.
 *
 * The editor was a single card of ~40 fields. Every one of them was labelled,
 * and it was still guesswork which part of the page any given line moved —
 * "Ribbon text" and "Discount badge" are both small text on a coloured chip.
 * Numbering them in page order answers "where does this land?" before the
 * question is asked, and collapsing means the section being written is the
 * only one on screen.
 *
 * Built on <details>, so it needs no state, survives a re-render mid-edit, and
 * the browser's own find-in-page can open a closed section.
 */
function Group({
  step,
  title,
  hint,
  defaultOpen,
  children,
}: {
  step: number;
  title: string;
  hint: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-zup-line bg-white [&[open]]:pb-5"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-secondary text-ui-micro font-bold text-zup-gray">
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-ui-sm font-bold text-zup-ink">{title}</span>
          <span className="mt-0.5 block text-ui-micro leading-snug text-zup-soft">{hint}</span>
        </span>
        <span
          className="mt-1 text-ui-micro font-bold text-zup-soft transition-transform group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-3.5 px-4">{children}</div>
    </details>
  );
}

/**
 * A miniature of the page, painted with the draft's own colours.
 *
 * Eleven hex codes do not tell you whether the order button will be readable
 * on the band behind it, or whether the highlight still reads as a highlight
 * against the new page background. The only reliable check is looking at them
 * together, and the alternative — save, open the campaign in another tab,
 * come back — is slow enough that nobody does it per adjustment.
 *
 * Deliberately schematic rather than a faithful render: it is a colour check,
 * and a small honest diagram survives changes to the real template that a
 * half-copy of it would not.
 */
function ThemePreview({ draft }: { draft: Pick<LandingPage, ColorKey> }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-zup-line text-[10px] font-bold leading-none"
      style={{ backgroundColor: draft.colorPageBg }}
    >
      <div className="px-3 py-3" style={{ backgroundColor: draft.colorHeroBg }}>
        <span style={{ color: draft.colorHeroText }}>Headline on the hero band</span>
        <span
          className="ml-2 inline-block rounded px-1.5 py-1"
          style={{ backgroundColor: draft.colorBandBg, color: draft.colorBandText }}
        >
          ৳1,990
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: draft.colorTintBg }}>
        <span style={{ color: draft.colorPageText }}>Body text in a quiet section</span>
        <span style={{ color: draft.colorAccent }}>· accent</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="inline-block rounded px-2 py-1.5"
          style={{ backgroundColor: draft.colorCtaBg, color: draft.colorCtaText }}
        >
          Order button
        </span>
        <span
          className="inline-block rounded px-1.5 py-1"
          style={{ backgroundColor: draft.colorHighlight, color: draft.colorPageText }}
        >
          Save ৳400
        </span>
      </div>
    </div>
  );
}

/**
 * A colour, edited either by swatch or by typing the hex.
 *
 * Both are here because they answer different questions: the swatch is how you
 * find a colour, the hex box is how you match one an ad already uses. The text
 * box holds what is being typed — including the half-finished "#4a" — and only
 * commits when it parses, so the draft can never carry a value the DTO will
 * reject. Leaving the box mid-edit restores the live value rather than
 * silently keeping something that was never saved.
 */
function ColorField({
  label,
  paints,
  value,
  disabled,
  onChange,
}: {
  label: string;
  /** What this colour actually paints — the reason the role names are opaque. */
  paints: string;
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  const commit = (raw: string) => {
    const hex = raw.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return onChange(hex.toUpperCase());
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      const [r, g, b] = hex.slice(1);
      return onChange(`#${r}${r}${g}${g}${b}${b}`.toUpperCase());
    }
    setText(value); // unparseable — put the live value back
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.04em] text-zup-soft">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-10 flex-none cursor-pointer rounded-lg border border-input bg-transparent p-0.5 disabled:cursor-not-allowed"
        />
        <Input
          value={text}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
          className="font-mono uppercase"
        />
      </div>
      <p className="text-ui-micro leading-snug text-zup-soft">{paints}</p>
    </div>
  );
}
