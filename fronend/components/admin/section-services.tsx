"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus } from "lucide-react";
import { useAdmin, tempId } from "@/lib/admin";
import {
  createService,
  deleteService,
  patchService,
  uploadServiceImage,
  useServices,
  type AdminService,
  type ServiceKind,
} from "@/lib/admin-api";
import {
  checkImageFile,
  describeImage,
  IMAGE_ACCEPT,
  IMAGE_FORMATS_LABEL,
  readImageDimensions,
} from "@/lib/image-upload";
import { cn, slugify } from "@/lib/utils";
import { ServiceCardView } from "@/components/marketing/service-card";
import { ConfirmDialog } from "./confirm-dialog";
import {
  Card,
  Field,
  Segmented,
  BtnPrimary,
  BtnGhost,
  BtnDanger,
  TagsInput,
  inputCls,
} from "./ui";

/** Mirrors uploadServiceImageDto's maxSize ("8m") in services.dto.ts. */
const MAX_SERVICE_IMAGE_BYTES = 8_000_000;

/** Backend caps: name 120, dsc 600, 12 features × 60 chars (services.dto.ts). */
const NAME_MAX = 120;
const DSC_MAX = 600;

/** Mirrors SERVICE_IMAGE_SIDES in backend/src/lib/rules.ts. */
const IMAGE_SIDE_OPTIONS = [
  { value: "left" as const, label: "Left" },
  { value: "right" as const, label: "Right" },
];

/** Mirrors SERVICE_BULLET_STYLES in backend/src/lib/rules.ts. Labelled by what
 *  the marker looks like, not by its internal name. */
const BULLET_STYLE_OPTIONS = [
  { value: "tick" as const, label: "Tick" },
  { value: "dot" as const, label: "Dot" },
  { value: "plain" as const, label: "Plain" },
];

/**
 * One catalogue of service cards. Mounted by the admin screen for whichever
 * page shows it — the bookable list appears on both the Home page and the
 * Services page screens, because it feeds both surfaces and there is only one
 * list behind them.
 */
export function ServiceCatalogueCard({
  kind,
  title,
  blurb,
}: {
  kind: ServiceKind;
  title: string;
  blurb: string;
}) {
  const { can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";
  const { list, setList, replace, loading, error, reload } = useServices(kind);
  const [adding, setAdding] = useState(false);

  /* Save a field edit. Optimistic: the row is already correct locally, so we
   * only reconcile from the response (the server may normalize the slug). */
  const save = useCallback(
    async (id: string, patch: Partial<Omit<AdminService, "id" | "image">>) => {
      try {
        replace(await patchService(kind, id, patch));
        toast("Saved");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't save that change");
        void reload(); // pull back to server truth so the UI isn't lying
      }
    },
    [kind, replace, reload],
  );

  const add = async () => {
    setAdding(true);
    try {
      // POST immediately rather than holding a client-only draft: the row needs
      // a server id before its image can be uploaded.
      const row = await createService(kind, {
        slug: tempId("new-service"),
        name: "New service",
        dsc: "Describe this service…",
        features: [],
        sort: list.length,
        // Alternate down the column so consecutive new cards zig-zag rather
        // than stacking every photo on the same edge.
        imageSide: list.length % 2 === 0 ? "left" : "right",
        bulletStyle: "tick",
      });
      setList((prev) => [...prev, row]);
      toast("Service added — fill in the details, then save the card");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add a service");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (row: AdminService) => {
    const before = list;
    setList((prev) => prev.filter((s) => s.id !== row.id));
    try {
      await deleteService(kind, row.id);
      toast("Service removed");
    } catch (err) {
      // 409 when enquiries reference it — put the row back and show why.
      setList(before);
      toast(err instanceof Error ? err.message : "Couldn't remove that service");
    }
  };

  /* Reorder by swapping the two rows' sort values. Array position alone isn't
   * enough — sort values can be sparse (0, 5, 9) once rows are deleted. */
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const a = list[index]!;
    const b = list[target]!;

    const next = [...list];
    next[index] = { ...b, sort: a.sort };
    next[target] = { ...a, sort: b.sort };
    setList(next.sort((x, y) => x.sort - y.sort));

    try {
      await Promise.all([
        patchService(kind, a.id, { sort: b.sort }),
        patchService(kind, b.id, { sort: a.sort }),
      ]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't reorder");
      void reload();
    }
  };

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-zup-body">{title}</h3>
          <p className="mt-1 max-w-prose text-ui-sm text-zup-gray">{blurb}</p>
        </div>
        {!readOnly ? (
          <BtnPrimary onClick={add} disabled={adding || loading}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {adding ? "Adding…" : "Add service"}
          </BtnPrimary>
        ) : null}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-zup-gray">Loading…</p>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zup-gray">Couldn&apos;t load these services.</p>
          <BtnGhost className="mt-3" onClick={() => void reload()}>
            Try again
          </BtnGhost>
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-zup-gray">
          No services yet — add one to see it on the site.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {list.map((s, i) => (
            <ServiceRow
              key={s.id}
              kind={kind}
              service={s}
              index={i}
              count={list.length}
              readOnly={readOnly}
              onSave={save}
              onImage={replace}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ServiceRow({
  kind,
  service: s,
  index,
  count,
  readOnly,
  onSave,
  onImage,
  onMove,
  onRemove,
}: {
  kind: ServiceKind;
  service: AdminService;
  index: number;
  count: number;
  readOnly: boolean;
  onSave: (id: string, patch: Partial<Omit<AdminService, "id" | "image">>) => Promise<void>;
  onImage: (row: AdminService) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (row: AdminService) => void;
}) {
  // A draft, not a live write: nothing reaches the server until Save. The
  // preview reads the draft, so the card still moves as you type.
  const [name, setName] = useState(s.name);
  const [dsc, setDsc] = useState(s.dsc);
  const [features, setFeatures] = useState(s.features);
  const [imageSide, setImageSide] = useState(s.imageSide);
  const [bulletStyle, setBulletStyle] = useState(s.bulletStyle);
  const [saving, setSaving] = useState(false);

  const draft: AdminService = {
    ...s,
    name: name.trim() || s.name,
    dsc: dsc.trim() || s.dsc,
    features,
    imageSide,
    bulletStyle,
  };

  const dirty =
    name !== s.name ||
    dsc !== s.dsc ||
    JSON.stringify(features) !== JSON.stringify(s.features) ||
    imageSide !== s.imageSide ||
    bulletStyle !== s.bulletStyle;
  const valid = name.trim().length > 0 && dsc.trim().length > 0;

  const undo = () => {
    setName(s.name);
    setDsc(s.dsc);
    setFeatures(s.features);
    setImageSide(s.imageSide);
    setBulletStyle(s.bulletStyle);
  };

  const saveCard = async () => {
    setSaving(true);
    try {
      // Re-slug alongside the name while the slug still looks auto-generated,
      // so hand-picked slugs are never clobbered.
      const wasAuto =
        s.slug.startsWith("new-service-") || s.slug === slugify(s.name, "service");
      await onSave(s.id, {
        name: name.trim(),
        dsc: dsc.trim(),
        features,
        imageSide,
        bulletStyle,
        ...(wasAuto ? { slug: slugify(name.trim(), "service") } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zup-body/10 bg-white p-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
        <div className="flex flex-col gap-3">
          <ServiceImageSlot
            kind={kind}
            service={s}
            disabled={readOnly}
            onUploaded={onImage}
          />
          <Field label="Photo on">
            <Segmented
              size="sm"
              label={`Which side the photo sits on for ${s.name}`}
              options={IMAGE_SIDE_OPTIONS}
              value={imageSide}
              disabled={readOnly}
              onChange={setImageSide}
            />
          </Field>
        </div>

        <div className="flex min-w-60 flex-1 flex-col gap-3">
          <Field label="Name">
            <input
              value={name}
              maxLength={NAME_MAX}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={dsc}
              rows={2}
              maxLength={DSC_MAX}
              disabled={readOnly}
              onChange={(e) => setDsc(e.target.value)}
              className={cn(inputCls, "min-h-16 resize-y")}
            />
          </Field>

          <Field label="Feature tags">
            <TagsInput
              tags={features}
              onChange={(next) => {
                if (readOnly) return;
                if (next.length > 12) {
                  toast("Up to 12 feature tags per service");
                  return;
                }
                setFeatures(next);
              }}
              placeholder="Add a feature, press Enter…"
            />
          </Field>

          <Field label="Bullet point">
            <div className="flex flex-col gap-1.5">
              <Segmented
                size="sm"
                label={`Bullet style for ${s.name}`}
                options={BULLET_STYLE_OPTIONS}
                value={bulletStyle}
                disabled={readOnly}
                onChange={setBulletStyle}
              />
              <span className="text-ui-micro text-zup-faint">
                What sits in front of each feature line — a tick, a round dot, or
                nothing at all.
              </span>
            </div>
          </Field>

          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-3">
              <BtnPrimary onClick={() => void saveCard()} disabled={!dirty || !valid || saving}>
                {saving ? "Saving…" : "Save card"}
              </BtnPrimary>
              {dirty ? (
                <>
                  <BtnGhost onClick={undo}>Undo</BtnGhost>
                  <span className="text-ui-sm text-zup-soft">Not saved yet</span>
                </>
              ) : null}
              {dirty && !valid ? (
                <span className="text-ui-sm font-semibold text-warn-fg">
                  Name and description are required
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <BtnGhost
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </BtnGhost>
              <BtnGhost
                aria-label="Move down"
                disabled={index === count - 1}
                onClick={() => onMove(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </BtnGhost>
            </div>
            <ConfirmDialog
              trigger={<BtnDanger>Remove</BtnDanger>}
              title="Remove this service?"
              description={`"${s.name}" will stop appearing on the site. This can't be undone.`}
              confirmLabel="Remove"
              onConfirm={() => onRemove(s)}
            />
          </div>
        ) : null}
        </div>

        {/* The card itself, not a mock-up of it — ServiceCardView is the same
            component the home page renders, so the two cannot drift. */}
        <div className="w-full lg:w-[420px] lg:flex-none xl:w-[520px]">
          <p className="mb-2 text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
            How it looks on the site
          </p>
          <ServiceCardView service={draft} unoptimizedImage className="shadow-sm" />
        </div>
      </div>
    </div>
  );
}

function ServiceImageSlot({
  kind,
  service: s,
  disabled,
  onUploaded,
}: {
  kind: ServiceKind;
  service: AdminService;
  disabled?: boolean;
  onUploaded: (row: AdminService) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const inert = disabled || busy;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "relative flex h-28 w-28 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center",
          inert && "opacity-60",
        )}
      >
        {s.image ? (
          <Image src={s.image} alt={s.name} fill unoptimized className="object-cover" />
        ) : (
          <>
            <ImageIcon className="mb-1 h-4 w-4 text-zup-faint" aria-hidden />
            <span className="text-xs font-semibold text-zup-gray">
              {busy ? "Uploading…" : "No image"}
            </span>
          </>
        )}
        {!disabled ? (
          <button
            type="button"
            disabled={inert}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "cursor-pointer text-ui-micro text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline",
              s.image &&
                "absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-white no-underline",
            )}
          >
            {busy ? "Uploading…" : s.image ? "Replace" : "browse"}
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          aria-label={`Upload image for ${s.name}`}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;

            const problem = checkImageFile(f, MAX_SERVICE_IMAGE_BYTES);
            if (problem) {
              toast(problem);
              return;
            }

            setBusy(true);
            try {
              const dims = await readImageDimensions(f);
              onUploaded(await uploadServiceImage(kind, s.id, f));
              setCaption(describeImage(dims, f.size, f.type));
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't upload that image");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <p className="max-w-28 text-ui-micro leading-tight text-zup-faint">
        {caption ?? `Landscape 4:3, 1200×900+. ${IMAGE_FORMATS_LABEL}, under 8 MB.`}
      </p>
    </div>
  );
}
