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
  type LandingPage,
  type LandingPageDraft,
} from "@/lib/admin-landing-pages";
import { site } from "@/lib/site";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [draft, setDraft] = useState<LandingPage>(page);
  const [bulletsText, setBulletsText] = useState(page.benefitBullets.join("\n"));
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
    };
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

      <Card className="flex flex-col gap-3.5 px-5 py-5 sm:px-6">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Internal title">
            <Input
              value={draft.title}
              disabled={readOnly}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
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
              The internal title above is never shown publicly.
            </p>
          </Field>
          <Field label="Link slug">
            <Input
              value={draft.slug}
              disabled={readOnly}
              onChange={(e) => set("slug", e.target.value)}
              className="font-mono"
            />
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
          <Field label="Offer price (৳)">
            <Input
              type="number"
              value={draft.offerPrice}
              disabled={readOnly}
              onChange={(e) => set("offerPrice", Number(e.target.value))}
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
              onChange={(e) => set("compareAtPrice", Number(e.target.value))}
            />
          </Field>
          <Field label="Ribbon / urgency badge">
            <Input
              value={draft.ribbonText}
              disabled={readOnly}
              onChange={(e) => set("ribbonText", e.target.value)}
            />
          </Field>
          <Field label="Button label">
            <Input
              value={draft.buttonLabel}
              disabled={readOnly}
              onChange={(e) => set("buttonLabel", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Image placeholder hint">
          <Input
            value={draft.imageHint}
            disabled={readOnly}
            onChange={(e) => set("imageHint", e.target.value)}
            placeholder="e.g. IPS unit + battery photo"
          />
        </Field>
        <Field label="Benefit bullets (one per line)">
          <Textarea
            value={bulletsText}
            disabled={readOnly}
            onChange={(e) => setBulletsText(e.target.value)}
            rows={5}
          />
        </Field>
        <Field label="Footer note">
          <Input
            value={draft.footerNote}
            disabled={readOnly}
            onChange={(e) => set("footerNote", e.target.value)}
          />
        </Field>


        {/* ===== Campaign page content =====
            Every string a visitor reads on /lp/:slug. Bundle prices are NOT
            here on purpose — they are derived from the product's quantity
            offers, so the page can only ever advertise what the cart charges. */}
        <div className="mt-6 border-t border-zup-line pt-5">
          <h3 className="text-ui-sm font-bold text-zup-ink">Campaign page content</h3>
          <p className="mt-1 text-ui-micro text-zup-soft">
            Write these in whatever language the campaign runs in — the layout does not
            assume English. Leave a section blank and it is left off the page entirely.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hotline label">
            <Input value={draft.hotlineLabel ?? ""} disabled={readOnly}
              onChange={(e) => set("hotlineLabel", e.target.value)}
              placeholder="হটলাইন (১০টা–১০টা)" />
          </Field>
          <Field label="Hotline number">
            <Input value={draft.hotlineNumber ?? ""} disabled={readOnly}
              onChange={(e) => set("hotlineNumber", e.target.value)}
              placeholder="০৯৬৩৮-৪৪৫৫৬৬" />
          </Field>
          <Field label="Header button">
            <Input value={draft.headerCtaLabel ?? ""} disabled={readOnly}
              onChange={(e) => set("headerCtaLabel", e.target.value)}
              placeholder="অর্ডার করুন" />
          </Field>
          <Field label="Discount badge">
            <Input value={draft.discountBadge ?? ""} disabled={readOnly}
              onChange={(e) => set("discountBadge", e.target.value)}
              placeholder="৩৩% ছাড়" />
          </Field>
        </div>

        <Field label="Sub-headline">
          <Textarea value={draft.subheadline ?? ""} disabled={readOnly} rows={3}
            onChange={(e) => set("subheadline", e.target.value)} />
        </Field>
        <Field label="Trust badges (one per line)">
          <Textarea value={lists.trustBadges} disabled={readOnly} rows={3}
            onChange={(e) => setLists({ ...lists, trustBadges: e.target.value })}
            placeholder={"১০০% অরিজিনাল\n০৬ মাস ওয়ারেন্টি\nক্যাশ অন ডেলিভারি"} />
        </Field>
        <Field label="Note under the hero button">
          <Input value={draft.heroCtaNote ?? ""} disabled={readOnly}
            onChange={(e) => set("heroCtaNote", e.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Brand strip title">
            <Input value={draft.brandStripTitle ?? ""} disabled={readOnly}
              onChange={(e) => set("brandStripTitle", e.target.value)}
              placeholder="যাদের সাথে আমরা কাজ করি" />
          </Field>
          <Field label="Brand names (one per line)">
            <Textarea value={lists.brandLogos} disabled={readOnly} rows={3}
              onChange={(e) => setLists({ ...lists, brandLogos: e.target.value })}
              placeholder={"bKash\nNagad\nSteadFast"} />
          </Field>
          <Field label="Video section title">
            <Input value={draft.videoTitle ?? ""} disabled={readOnly}
              onChange={(e) => set("videoTitle", e.target.value)} />
          </Field>
          <Field label="Video URL (blank hides the section)">
            <Input value={draft.videoUrl ?? ""} disabled={readOnly}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://youtube.com/watch?v=…" />
          </Field>
        </div>

        <Field label="Features title">
          <Input value={draft.featuresTitle ?? ""} disabled={readOnly}
            onChange={(e) => set("featuresTitle", e.target.value)} />
        </Field>
        <Field label="Features — one per line, “title | description”">
          <Textarea value={blocks.features} disabled={readOnly} rows={5}
            onChange={(e) => setBlocks({ ...blocks, features: e.target.value })}
            placeholder={"২২.৫W সুপার ফাস্ট চার্জ | ৩০ মিনিটে ফোনে ৬০% চার্জ"} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
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
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
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
            <Input type="number" value={draft.bundleMaxQty ?? 3} disabled={readOnly}
              onChange={(e) => set("bundleMaxQty", Number(e.target.value))} />
            <p className="mt-1 text-ui-micro text-zup-soft">
              Prices come from the product&apos;s quantity offers, so what the page
              advertises is always what checkout charges.
            </p>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
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

        <Field label="Testimonials title">
          <Input value={draft.testimonialsTitle ?? ""} disabled={readOnly}
            onChange={(e) => set("testimonialsTitle", e.target.value)} />
        </Field>
        <Field label="Testimonials — one per line, “quote | name | place”">
          <Textarea value={blocks.testimonials} disabled={readOnly} rows={5}
            onChange={(e) => setBlocks({ ...blocks, testimonials: e.target.value })}
            placeholder={"লোডশেডিংয়ের সময়ও ফোন চলে | সাইফুল ইসলাম | রাজশাহী"} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Footer tagline">
            <Input value={draft.footerTagline ?? ""} disabled={readOnly}
              onChange={(e) => set("footerTagline", e.target.value)}
              placeholder="MAKES LIFE SIMPLE" />
          </Field>
          <Field label="Footer contact lines (one per line)">
            <Textarea value={lists.footerLines} disabled={readOnly} rows={3}
              onChange={(e) => setLists({ ...lists, footerLines: e.target.value })} />
          </Field>
        </div>
        <Field label="Footer about">
          <Textarea value={draft.footerAbout ?? ""} disabled={readOnly} rows={3}
            onChange={(e) => set("footerAbout", e.target.value)} />
        </Field>

        {!readOnly ? (
          <div className="mt-1">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
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
