"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import {
  useAdmin,
  GTM_ID_RE,
  type HeroSlide,
  type SiteCopy,
  type SiteContact,
  tempId,
} from "@/lib/admin";
import { uploadSlideImage } from "@/lib/admin-api";
import { ProductPicker } from "@/components/admin/products/product-picker";
import { DEFAULT_COPY } from "@/lib/site-copy";
import { HERO_PAGE_LABELS, type HeroPage } from "@/lib/admin";
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

const CTA_TARGETS = ["/products", "/services", "/industrial", "/contact"];

/** Mirrors uploadSlideImageDto's maxSize ("8m") in content.dto.ts. */
const MAX_SLIDE_BYTES = 8_000_000;
/** Hero clips get a far higher ceiling than stills — mirrors the video branch
 *  of uploadSlideImageDto in backend/src/dtos/content.dto.ts. */
const MAX_SLIDE_VIDEO_BYTES = 60_000_000;

const FIT_OPTIONS = [
  { value: "cover" as const, label: "Cover" },
  { value: "contain" as const, label: "Contain" },
];

/**
 * The hero banners for ONE page.
 *
 * Each page's screen renders its own copy of this card, and it only ever sees
 * and writes the slides belonging to that page. The previous version put a
 * single list on the home screen with a "shows on" toggle per slide, which made
 * the three pages feel like one shared thing — editing the home banners looked
 * like it was editing the services page too, and deleting a slide from what
 * read as "the home page's banners" removed it everywhere.
 *
 * `state.slides` is still one flat array (it maps to one PUT), so every write
 * here recombines: the slides for other pages pass through untouched and only
 * this page's are replaced. That is what keeps the three genuinely independent.
 */
export function BannerSlidesCard({ page = "home" }: { page?: HeroPage }) {
  const { state, update, can } = useAdmin();
  const readOnly = can("homepage") !== "manage";

  // A slide with no pages is a home slide — that is where every slide lived
  // before pages existed, and rows written by an older client still look that way.
  const belongsHere = (s: HeroSlide) =>
    s.pages?.length ? s.pages.includes(page) : page === "home";

  const mine = state.slides.filter(belongsHere);
  const others = state.slides.filter((s) => !belongsHere(s));

  /** Write this page's slides back without disturbing any other page's. */
  const commit = (next: HeroSlide[]) => update({ slides: [...others, ...next] });

  const setSlide = (id: string, patch: Partial<HeroSlide>) =>
    commit(mine.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSlide = () => {
    commit([
      ...mine,
      {
        id: tempId("slide"),
        image: null,
        cta: "Shop Now",
        href: "/products",
        // Active on creation: you add a banner because you want it shown, and
        // the old default of `false` meant every new slide silently did nothing
        // until someone found the toggle.
        active: true,
        fit: "cover",
        bg: "",
        pages: [page],
      },
    ]);
    toast("Slide added — upload a banner image");
  };

  /* Order is positional: PUT /admin/api/slides rewrites `sort` from the array
   * index, so moving a slide is pure local array manipulation — within this
   * page's slides only. */
  const move = (index: number, dir: -1 | 1) => {
    const next = [...mine];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(next);
  };

  const activeCount = mine.filter((s) => s.active && s.image).length;

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ui-base font-bold">
            {HERO_PAGE_LABELS[page]} page banners
          </h2>
          <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
            These rotate in the banner at the top of the {HERO_PAGE_LABELS[page].toLowerCase()}{" "}
            page, in the order shown. They belong to this page only — the other pages have
            their own, and nothing you change here touches them. Each is a wide image with
            one button; 2000×800 works well. {IMAGE_FORMATS_LABEL}, under 8 MB, ideally
            200–400 KB.
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
          No active slides with an image — this page falls back to its built-in banner.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {mine.map((s, i) => (
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
                      disabled={i === mine.length - 1}
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
                        commit(mine.filter((x) => x.id !== s.id));
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
export function FeaturedRowEditor() {
  const { state, update, can } = useAdmin();
  const readOnly = can("homepage") !== "manage";

  return (
    <>
      <Card className="px-5 py-5 sm:px-6">
        <h2 className="text-ui-base font-bold">Featured products</h2>
        <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
          The row under the hero banner, shown left to right in the order below.
          Starring a product on the Products screen adds it to the end — reorder
          it here.
        </p>
        <ProductPicker
          selectId="feat-add"
          label="Featured products"
          emptyNote="Nothing featured yet — the home page hides the row."
          ids={state.featuredIds}
          onChange={(ids) => update({ featuredIds: ids })}
          readOnly={readOnly}
        />
      </Card>

      <Card className="px-5 py-5 sm:px-6">
        <h2 className="text-ui-base font-bold">Second product row</h2>
        <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
          A second row further down the home page, just above the two booking
          forms. It is a separate list from Featured products on purpose — put
          different things here, or the same eight products appear twice on one
          page. Empty hides the row.
        </p>
        <ProductPicker
          selectId="homerow-add"
          label="the second row"
          emptyNote="Nothing here yet — the home page hides this row."
          ids={state.homeRowIds}
          onChange={(ids) => update({ homeRowIds: ids })}
          readOnly={readOnly}
        />
      </Card>
    </>
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
          <option value="/products">Products (/products)</option>
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
 * Banner image upload. Unlike the old picker this posts to the media
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

export interface CopyField {
  key: keyof SiteCopy;
  label: string;
  multiline?: boolean;
}

/* One list per page, because the admin is now organised that way: each screen
 * imports the wording that belongs to the page it edits. Leaving a field blank
 * falls back to the site's built-in default (DEFAULT_COPY in
 * lib/admin-bridge.ts), which is what the placeholder shows. */

/** The homepage is the banner carousel, the product row and the service cards.
 *  Its hero text, capabilities band, stats and closing CTA were all removed
 *  from the layout, so the fields that fed them are gone from here too rather
 *  than left editing text nothing renders. The headline stays: it is the
 *  page's visually-hidden <h1>. */
export const HOME_COPY: CopyField[] = [
  { key: "homeHeroHeadline", label: "Hero headline (screen readers & search)" },
];

/** Both pages are the banner carousel plus their cards and a form, so the
 *  headline is all the wording they have. The six grid/standards fields that
 *  used to sit here went with the sections they fed. */
export const SERVICES_COPY: CopyField[] = [
  { key: "servicesHeroHeadline", label: "Hero headline (screen readers & search)" },
];

export const INDUSTRIAL_COPY: CopyField[] = [
  { key: "industrialHeroHeadline", label: "Hero headline (screen readers & search)" },
];

export const CONTACT_COPY: CopyField[] = [
  { key: "contactHeading", label: "Page heading" },
  { key: "contactFormHeading", label: "Form heading" },
  { key: "contactOfficeHeading", label: "Office card heading" },
  { key: "contactServiceLine", label: "Service line number" },
  { key: "contactTendersEmail", label: "Tenders email" },
];

export const FOOTER_COPY: CopyField[] = [
  { key: "footerDescription", label: "Footer description", multiline: true },
];

const CONTACT_FIELDS: { key: keyof SiteContact; label: string; hint?: string }[] = [
  { key: "phone", label: "Phone (dialable)", hint: "+8801XXXXXXXXX" },
  { key: "phoneDisplay", label: "Phone (as shown)" },
  // Named for where it actually appears. It is not on the site anywhere — the
  // only thing that prints it is the invoice document.
  { key: "hotline", label: "Hotline (printed on invoices)" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp number (digits)", hint: "8801XXXXXXXXX" },
  { key: "street", label: "Street address" },
  { key: "city", label: "City" },
  { key: "postalCode", label: "Postal code" },
  { key: "hours", label: "Opening hours (short form)", hint: "9am–8pm" },
  { key: "officeName", label: "Office name", hint: "ZUP TECH Ltd." },
  { key: "hoursWeekday", label: "Hours — weekdays", hint: "Sat – Thu · 9am – 8pm" },
  { key: "hoursWeekend", label: "Hours — weekend", hint: "Friday · Closed" },
  { key: "hoursEmergency", label: "Hours — emergency", hint: "Emergency service · 24/7" },
  { key: "warehouseName", label: "Warehouse name" },
  { key: "warehouseAddress", label: "Warehouse address" },
];

/** Phone, email and address. Lives on the Contact page screen, though the
 *  footer and the WhatsApp button read the same values. */
export function ContactDetailsCard() {
  const { state, update, can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";

  return (
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
          Nothing is sent until you press Save at the bottom of the screen.
        </p>
      ) : null}
    </Card>
  );
}

/** The GTM container. Site-wide rather than per-page, so it sits on the
 *  "Footer & tracking" screen with the other things every page carries. */
export function TrackingCard() {
  const { state, update, can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";
  const gtm = state.integrations;
  const gtmIdOk = GTM_ID_RE.test(gtm.gtmId.trim().toUpperCase());
  const gtmLive = gtm.gtmEnabled && gtmIdOk;

  return (
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
  );
}

/** The wording for one page. Which fields it shows is the caller's decision —
 *  each page screen passes its own list, so no screen offers copy that belongs
 *  somewhere else. */
export function CopyCard({
  title = "Wording",
  blurb = "Leave a field blank to use the site's built-in wording (shown as the placeholder).",
  fields,
}: {
  title?: string;
  blurb?: string;
  fields: CopyField[];
}) {
  const { state, update, can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";

  return (
    <Card className="px-5 py-5 sm:px-6">
      <h2 className="text-ui-base font-bold">{title}</h2>
      <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">{blurb}</p>
      <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.multiline ? (
              <textarea
                value={state.copy[f.key] ?? ""}
                rows={3}
                disabled={readOnly}
                placeholder={DEFAULT_COPY[f.key]}
                onChange={(e) => update({ copy: { ...state.copy, [f.key]: e.target.value } })}
                className={cn(inputCls, "min-h-20 resize-y")}
              />
            ) : (
              <input
                value={state.copy[f.key] ?? ""}
                disabled={readOnly}
                placeholder={DEFAULT_COPY[f.key]}
                onChange={(e) => update({ copy: { ...state.copy, [f.key]: e.target.value } })}
                className={inputCls}
              />
            )}
          </Field>
        ))}
      </div>
      {!readOnly ? (
        <p className="mt-5 text-ui-sm text-zup-soft">
          Nothing is sent until you press Save at the bottom of the screen.
        </p>
      ) : null}
    </Card>
  );
}
