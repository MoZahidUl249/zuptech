"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import {
  useAdmin,
  GTM_ID_RE,
  type AdminProduct,
  type HeroSlide,
  type SiteCopy,
  type SiteContact,
  tempId,
} from "@/lib/admin";
import { uploadSlideImage } from "@/lib/admin-api";
import { DEFAULT_COPY } from "@/lib/site-copy";
import {
  bannerDimensionWarning,
  checkImageFile,
  describeImage,
  IMAGE_ACCEPT,
  IMAGE_FORMATS_LABEL,
  readImageDimensions,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import {
  Card,
  Field,
  Pill,
  Segmented,
  Toggle,
  BtnPrimary,
  BtnGhost,
  BtnDanger,
  inputCls,
  selectCls,
} from "./ui";

/* ===== Home page (hero banner slides — image + CTA, as the store renders) ===== */

const CTA_TARGETS = ["/shop", "/services", "/industrial", "/contact"];

/** Mirrors uploadSlideImageDto's maxSize ("8m") in content.dto.ts. */
const MAX_SLIDE_BYTES = 8_000_000;
/** Hero clips get a far higher ceiling than stills — mirrors the video branch
 *  of uploadSlideImageDto in backend/src/dtos/content.dto.ts. */
const MAX_SLIDE_VIDEO_BYTES = 60_000_000;

const FIT_OPTIONS = [
  { value: "cover" as const, label: "Cover" },
  { value: "contain" as const, label: "Contain" },
];

export function HomePageSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("homepage") !== "manage";

  const setSlide = (id: string, patch: Partial<HeroSlide>) =>
    update({
      slides: state.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const addSlide = () => {
    update({
      slides: [
        ...state.slides,
        {
          id: tempId("slide"),
          image: null,
          cta: "Shop Now",
          href: "/shop",
          active: false,
          fit: "cover",
          bg: "",
        },
      ],
    });
    toast("Slide added — upload a banner image and activate it");
  };

  /* Order is positional: PUT /admin/api/slides rewrites `sort` from the array
   * index, so moving a slide is pure local array manipulation. */
  const move = (index: number, dir: -1 | 1) => {
    const next = [...state.slides];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    update({ slides: next });
  };

  const activeCount = state.slides.filter((s) => s.active && s.image).length;

  return (
    <div className="flex flex-col gap-5">
      <FeaturedRowEditor />

    <Card className="px-5 py-5 sm:px-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ui-base font-bold">Hero banner slides</h2>
          <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
            These slides rotate in the store&apos;s home-page banner, in the order shown
            below. Each is a wide image with one button — 2000×800 works well.{" "}
            {IMAGE_FORMATS_LABEL}, under 8 MB. Banners are served at full resolution, so
            aim for 200–400 KB.
          </p>
        </div>
        {!readOnly ? (
          <BtnPrimary onClick={addSlide}>
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add slide
          </BtnPrimary>
        ) : null}
      </div>
      {activeCount === 0 ? (
        <p className="mt-2 rounded-xl bg-warn-bg px-3.5 py-2.5 text-ui-sm font-semibold text-warn-fg">
          No active slides with an image — the store shows its default banners.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {state.slides.map((s, i) => (
          <div key={s.id} className="rounded-2xl border border-zup-body/8 p-4 sm:p-5">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-zup-soft">
                Slide {i + 1}
              </p>
              <div className="flex items-center gap-2">
                {readOnly ? (
                  <Pill tone={s.active ? "green" : "gray"}>{s.active ? "Active" : "Off"}</Pill>
                ) : (
                  <>
                    <BtnGhost
                      aria-label={`Move slide ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </BtnGhost>
                    <BtnGhost
                      aria-label={`Move slide ${i + 1} down`}
                      disabled={i === state.slides.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </BtnGhost>
                    <button
                      type="button"
                      onClick={() => setSlide(s.id, { active: !s.active })}
                      aria-pressed={s.active}
                      aria-label={`Toggle slide ${i + 1}`}
                      className="cursor-pointer"
                    >
                      <Pill tone={s.active ? "green" : "gray"}>
                        {s.active ? "Active" : "Off"}
                      </Pill>
                    </button>
                    <ConfirmDialog
                      trigger={<BtnDanger>Remove</BtnDanger>}
                      title="Remove this slide?"
                      description="It will disappear from the home-page banner immediately."
                      confirmLabel="Remove"
                      onConfirm={() => {
                        update({ slides: state.slides.filter((x) => x.id !== s.id) });
                        toast("Slide removed");
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <BannerImagePicker
                value={s.image}
                mediaType={s.mediaType}
                disabled={readOnly}
                onPick={(v, kind) =>
                  // Clearing the media resets the kind too, so a removed video
                  // can't leave the next upload mislabelled.
                  setSlide(s.id, { image: v, mediaType: v ? (kind ?? "image") : "image" })
                }
              />
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <Field label="Button label">
                  <input
                    value={s.cta}
                    maxLength={80}
                    disabled={readOnly}
                    onChange={(e) => setSlide(s.id, { cta: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <SlideHrefField
                  href={s.href}
                  disabled={readOnly}
                  onChange={(href) => setSlide(s.id, { href })}
                />
                <Field label="Image fit">
                  <div className="flex flex-col gap-1.5">
                    <Segmented
                      size="sm"
                      options={FIT_OPTIONS}
                      value={s.fit ?? "cover"}
                      disabled={readOnly}
                      onChange={(fit) => setSlide(s.id, { fit })}
                    />
                    <span className="text-ui-micro text-zup-faint">
                      {(s.fit ?? "cover") === "cover"
                        ? "Fills the banner, cropping the edges."
                        : "Shows the whole image on the background colour."}
                    </span>
                  </div>
                </Field>
                <Field label="Background colour">
                  <div className="flex items-center gap-2">
                    <input
                      value={s.bg ?? ""}
                      maxLength={300}
                      disabled={readOnly}
                      placeholder="#0B1F3A or a gradient"
                      onChange={(e) => setSlide(s.id, { bg: e.target.value })}
                      className={inputCls}
                    />
                    <span
                      aria-hidden
                      title="Background preview"
                      style={{ background: s.bg || undefined }}
                      className="h-8 w-8 shrink-0 rounded-lg border border-zup-body/15 bg-zup-bg"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
    </div>
  );
}

/**
 * The home page's "Featured products" row.
 *
 * Order is the whole point: `featuredIds` is an ordered array and the
 * storefront renders the row in exactly that sequence, but the only control
 * used to be the star toggle on the Products screen — which appends, so the
 * row's order was whatever sequence someone happened to click in and could
 * never be changed afterwards.
 */
function FeaturedRowEditor() {
  const { state, update, can } = useAdmin();
  const readOnly = can("homepage") !== "manage";

  // Resolve against the catalog, dropping ids whose product no longer exists
  // (deleted product, or one hidden since it was featured).
  const featured = state.featuredIds
    .map((id) => state.products.find((p) => p.id === id))
    .filter((p): p is AdminProduct => Boolean(p));

  const available = state.products
    .filter((p) => !state.featuredIds.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const setIds = (ids: string[]) => update({ featuredIds: ids });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...state.featuredIds];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setIds(next);
  };

  return (
    <Card className="px-5 py-5 sm:px-6">
      <h2 className="text-ui-base font-bold">Featured products</h2>
      <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
        The row under the hero banner, shown left to right in the order below.
        Starring a product on the Products screen adds it to the end — reorder
        it here.
      </p>

      {featured.length === 0 ? (
        <p className="mt-4 text-ui-sm text-zup-soft">
          Nothing featured yet — the home page hides the row.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {featured.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-zup-body/8 px-3.5 py-2.5"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-zup-body/6 text-ui-xs font-bold text-zup-gray">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui-base font-bold">{p.name}</span>
                <span className="block text-ui-micro text-zup-soft">
                  {p.category || "—"}
                  {p.visible ? "" : " · hidden from the storefront"}
                </span>
              </span>
              {readOnly ? null : (
                <span className="flex items-center gap-1">
                  <BtnGhost
                    aria-label={`Move ${p.name} earlier`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </BtnGhost>
                  <BtnGhost
                    aria-label={`Move ${p.name} later`}
                    disabled={i === featured.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </BtnGhost>
                  <BtnGhost
                    aria-label={`Remove ${p.name} from featured`}
                    onClick={() => {
                      setIds(state.featuredIds.filter((id) => id !== p.id));
                      toast(`${p.name} removed from Featured products`);
                    }}
                  >
                    <X className="h-3.5 w-3.5 text-destructive" aria-hidden />
                  </BtnGhost>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {readOnly ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="feat-add" className="text-ui-sm font-semibold text-zup-gray">
            Add a product
          </label>
          <select
            id="feat-add"
            // Stays on the placeholder so the same control can be used
            // repeatedly without first resetting it.
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const picked = state.products.find((p) => p.id === e.target.value);
              setIds([...state.featuredIds, e.target.value]);
              if (picked) toast(`${picked.name} added to Featured products`);
            }}
            className={selectCls}
          >
            <option value="">Select…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.visible ? "" : " (hidden)"}
              </option>
            ))}
          </select>
        </div>
      )}
    </Card>
  );
}

function SlideHrefField({
  href,
  disabled,
  onChange,
}: {
  href: string;
  disabled?: boolean;
  onChange: (href: string) => void;
}) {
  const isPreset = CTA_TARGETS.includes(href);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <Field label="Button links to">
      <div className="flex flex-col gap-1.5">
        <select
          value={custom ? "__custom" : href}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === "__custom") {
              setCustom(true);
              return;
            }
            setCustom(false);
            onChange(e.target.value);
          }}
          className={selectCls}
        >
          <option value="/shop">Shop (/shop)</option>
          <option value="/services">Services (/services)</option>
          <option value="/industrial">Industrial (/industrial)</option>
          <option value="/contact">Contact (/contact)</option>
          <option value="__custom">Custom URL…</option>
        </select>
        {custom ? (
          <input
            value={href}
            maxLength={300}
            disabled={disabled}
            placeholder="/campaign/eid or https://…"
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && !v.startsWith("/") && !v.startsWith("https://")) {
                toast("Links must start with / or https://");
              }
            }}
            className={inputCls}
          />
        ) : null}
      </div>
    </Field>
  );
}

/**
 * Banner image upload. Unlike the old picker this posts to the media-storage
 * service via POST /admin/api/slides/image and stores the returned URL —
 * base64 data-URLs used to be inlined into the slide row, which meant every
 * public /api/site-config response carried the image bytes.
 */
function BannerImagePicker({
  value,
  mediaType,
  disabled,
  onPick,
}: {
  value: string | null;
  mediaType?: "image" | "video";
  disabled?: boolean;
  /** Reports the media kind alongside the URL — a video slide needs a player,
   *  not an <img>, and the server tells us which it stored. */
  onPick: (v: string | null, kind?: "image" | "video") => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);

  return (
    <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-48">
      <div className="relative flex h-24 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-zup-bg text-center">
        {value ? (
          <>
            {mediaType === "video" ? (
              <video src={value} muted loop playsInline className="h-full w-full object-cover" />
            ) : (
              <Image src={value} alt="Banner preview" fill unoptimized className="object-cover" />
            )}
            {!disabled ? (
              <button
                type="button"
                onClick={() => {
                  onPick(null);
                  setCaption(null);
                }}
                aria-label="Remove banner image"
                className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-1.5 text-ui-micro font-bold text-white"
              >
                ✕
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-xs font-semibold text-zup-gray">
            {busy ? "Uploading…" : "Banner image"}
          </span>
        )}
        {!disabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => ref.current?.click()}
            className={cn(
              "cursor-pointer text-ui-micro text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline",
              value && "absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-white no-underline",
            )}
          >
            {busy ? "Uploading…" : value ? "Replace" : "browse files"}
          </button>
        ) : null}
        <input
          ref={ref}
          type="file"
          accept={`${IMAGE_ACCEPT},video/*`}
          className="hidden"
          aria-label="Upload banner image or video"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;

            const isVideo = f.type.startsWith("video/");
            // Stills keep the tighter image checks; a clip only has to fit the
            // video ceiling, since dimension advice is meaningless for one.
            if (isVideo) {
              if (f.size > MAX_SLIDE_VIDEO_BYTES) {
                toast("Video too large — keep hero clips under 60 MB");
                return;
              }
            } else {
              const problem = checkImageFile(f, MAX_SLIDE_BYTES);
              if (problem) {
                toast(problem);
                return;
              }
            }

            setBusy(true);
            try {
              const dims = isVideo ? null : await readImageDimensions(f);
              const { url, mediaType: kind } = await uploadSlideImage(f);
              onPick(url, kind);
              setCaption(isVideo ? describeImage(null, f.size, f.type) : describeImage(dims, f.size, f.type));
              // Advisory only — a slightly-small banner is the admin's call.
              const warning = dims ? bannerDimensionWarning(dims) : null;
              toast(warning ?? (isVideo ? "Banner video updated" : "Banner image updated"));
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't upload that image");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <p className="text-ui-micro leading-tight text-zup-faint">
        {caption ??
          `2000×800 recommended · ${IMAGE_FORMATS_LABEL} under 8 MB · or MP4/WebM under 60 MB`}
      </p>
    </div>
  );
}

/* ===== Site content (copywriting) ===== */

interface CopyField {
  key: keyof SiteCopy;
  label: string;
  multiline?: boolean;
}

/** Grouped by the page each field appears on. Leaving a field blank falls back
 *  to the site's built-in default (DEFAULT_COPY in lib/admin-bridge.ts), which
 *  is what the placeholder shows. */
const COPY_GROUPS: { group: string; fields: CopyField[] }[] = [
  {
    group: "Home page",
    fields: [
      { key: "homeHeroEyebrow", label: "Hero eyebrow" },
      { key: "homeHeroHeadline", label: "Hero headline" },
      { key: "homeHeroSubhead", label: "Hero subhead", multiline: true },
      { key: "featuredHeading", label: "Featured section heading" },
      { key: "homeCapabilitiesEyebrow", label: "Capabilities eyebrow" },
      { key: "homeCapabilitiesHeading", label: "Capabilities heading" },
      { key: "homeCtaHeading", label: "Closing CTA heading" },
      { key: "homeCtaSubtext", label: "Closing CTA subtext", multiline: true },
      { key: "homeCtaButton", label: "Closing CTA button label" },
    ],
  },
  {
    group: "Industrial page",
    fields: [
      { key: "industrialHeroEyebrow", label: "Hero eyebrow" },
      { key: "industrialHeroHeadline", label: "Hero headline" },
      { key: "industrialHeroSubhead", label: "Hero subhead", multiline: true },
      { key: "industrialGridHeading", label: "Grid solutions heading" },
      { key: "industrialGridBody", label: "Grid solutions body", multiline: true },
      { key: "industrialServicesHeading", label: "Services heading" },
      { key: "industrialServicesSubtitle", label: "Services subtitle", multiline: true },
      { key: "industrialStandardsHeading", label: "Standards heading" },
      { key: "industrialStandardsBody", label: "Standards body", multiline: true },
    ],
  },
  {
    group: "Contact page",
    fields: [
      { key: "contactHeading", label: "Page heading" },
      { key: "contactFormHeading", label: "Form heading" },
      { key: "contactOfficeHeading", label: "Office card heading" },
      // No "Team section heading" field: the team section itself is not
      // rendered (see app/(site)/contact/page.tsx), and offering an editor for
      // a heading nobody can see is how this admin ends up full of controls
      // that do nothing. The column stays in SiteConfig for when it returns.
      { key: "contactServiceLine", label: "Service line number" },
      { key: "contactTendersEmail", label: "Tenders email" },
    ],
  },
  {
    group: "Services page & footer",
    fields: [
      { key: "servicesHeading", label: "Services section heading" },
      { key: "servicesSubtitle", label: "Services section subtitle", multiline: true },
      { key: "footerDescription", label: "Footer description", multiline: true },
    ],
  },
];

const CONTACT_FIELDS: { key: keyof SiteContact; label: string; hint?: string }[] = [
  { key: "phone", label: "Phone (dialable)", hint: "+8801XXXXXXXXX" },
  { key: "phoneDisplay", label: "Phone (as shown)" },
  { key: "hotline", label: "Support hotline" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp number (digits)", hint: "8801XXXXXXXXX" },
  { key: "street", label: "Street address" },
  { key: "city", label: "City" },
  { key: "postalCode", label: "Postal code" },
  { key: "hours", label: "Opening hours" },
];

export function SiteContentSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";
  const gtm = state.integrations;
  const gtmIdOk = GTM_ID_RE.test(gtm.gtmId.trim().toUpperCase());
  const gtmLive = gtm.gtmEnabled && gtmIdOk;

  return (
    <div className="flex flex-col gap-5">
      <Card className="px-5 py-5 sm:px-6">
        <h2 className="text-ui-base font-bold">Contact information</h2>
        <p className="mt-0.5 text-ui-sm text-zup-gray">
          Shown in the site footer, the contact page and the floating WhatsApp button.
        </p>
        <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTACT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <input
                value={state.contact[f.key]}
                disabled={readOnly}
                placeholder={f.hint}
                inputMode={
                  f.key === "phone" || f.key === "whatsapp" || f.key === "hotline"
                    ? "tel"
                    : undefined
                }
                onChange={(e) =>
                  update({ contact: { ...state.contact, [f.key]: e.target.value } })
                }
                className={inputCls}
              />
            </Field>
          ))}
        </div>
        {!readOnly ? (
          <p className="mt-5 text-ui-sm text-zup-soft">
            Changes save on their own — watch the top of the screen.
          </p>
        ) : null}
      </Card>

      <Card className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-ui-base font-bold">Google Tag Manager</h2>
            <p className="mt-0.5 text-ui-sm text-zup-gray">
              Paste your container id to load GTM on the storefront. Nothing loads
              while this is off or the id is invalid.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Pill tone={gtmLive ? "green" : "gray"}>{gtmLive ? "Live" : "Off"}</Pill>
            <Toggle
              on={gtm.gtmEnabled}
              disabled={readOnly}
              label="Enable Google Tag Manager"
              onChange={(on) => {
                update({ integrations: { ...gtm, gtmEnabled: on } });
                toast(on ? "GTM enabled" : "GTM disabled");
              }}
            />
          </div>
        </div>
        <div className="mt-4 max-w-[340px]">
          <Field label="Container ID">
            <input
              value={gtm.gtmId}
              disabled={readOnly}
              placeholder="GTM-XXXXXXX"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) =>
                update({
                  integrations: { ...gtm, gtmId: e.target.value.toUpperCase().trim() },
                })
              }
              className={`${inputCls} font-mono`}
            />
          </Field>
          {gtm.gtmId && !gtmIdOk ? (
            <p className="mt-1.5 text-ui-sm font-medium text-destructive" role="alert">
              That doesn&apos;t look like a GTM container id — expected GTM-XXXXXXX.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="px-5 py-5 sm:px-6">
        <h2 className="text-ui-base font-bold">Copywriting</h2>
        <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
          Every headline and text block on the store, editable in one place.
          Leave a field blank to use the site&apos;s built-in wording (shown as
          the placeholder).
        </p>
        {COPY_GROUPS.map((g) => (
          <div key={g.group} className="mt-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-zup-soft">
              {g.group}
            </h3>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.multiline ? (
                    <textarea
                      value={state.copy[f.key] ?? ""}
                      rows={3}
                      disabled={readOnly}
                      placeholder={DEFAULT_COPY[f.key]}
                      onChange={(e) =>
                        update({ copy: { ...state.copy, [f.key]: e.target.value } })
                      }
                      className={cn(inputCls, "min-h-20 resize-y")}
                    />
                  ) : (
                    <input
                      value={state.copy[f.key] ?? ""}
                      disabled={readOnly}
                      placeholder={DEFAULT_COPY[f.key]}
                      onChange={(e) =>
                        update({ copy: { ...state.copy, [f.key]: e.target.value } })
                      }
                      className={inputCls}
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        ))}
        {!readOnly ? (
          <p className="mt-5 text-ui-sm text-zup-soft">
            Changes save on their own — watch the top of the screen.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
