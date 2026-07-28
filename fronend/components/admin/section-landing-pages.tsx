"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Eye, Copy, ExternalLink } from "lucide-react";
import { useAdmin, taka, tempId, type AdminProduct } from "@/lib/admin";
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

  const addPage = async () => {
    const firstProduct = state.products[0];
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
        products={state.products}
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
      benefitBullets: bulletsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
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
              <Button variant="outline" size="sm" onClick={() => void togglePublish()}>
                {draft.published ? "Unpublish" : "Publish"}
              </Button>
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
