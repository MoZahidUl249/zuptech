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
import { ConfirmDialog } from "./confirm-dialog";
import { Card, Field, BtnPrimary, BtnGhost, BtnDanger, TagsInput, inputCls } from "./ui";

/** Mirrors uploadServiceImageDto's maxSize ("8m") in services.dto.ts. */
const MAX_SERVICE_IMAGE_BYTES = 8_000_000;

/** Backend caps: name 120, dsc 600, 12 features × 60 chars (services.dto.ts). */
const NAME_MAX = 120;
const DSC_MAX = 600;

export function ServicesSection() {
  return (
    <>
      <ServiceCatalogueCard
        kind="services"
        title="Services"
        blurb="The bookable service cards on /services. Customers can submit an enquiry against these, so a card with enquiries attached can't be deleted."
      />
      <ServiceCatalogueCard
        kind="industrial-services"
        title="Industrial services"
        blurb="The infrastructure capability cards on /industrial. Display-only — no enquiries attach to these."
      />
    </>
  );
}

function ServiceCatalogueCard({
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
      });
      setList((prev) => [...prev, row]);
      toast("Service added — fill in the details below");
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
  // Local draft so typing stays responsive; committed on blur.
  const [name, setName] = useState(s.name);
  const [dsc, setDsc] = useState(s.dsc);

  return (
    <div className="rounded-xl border border-zup-body/10 bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        <ServiceImageSlot
          kind={kind}
          service={s}
          disabled={readOnly}
          onUploaded={onImage}
        />

        <div className="flex min-w-60 flex-1 flex-col gap-3">
          <Field label="Name">
            <input
              value={name}
              maxLength={NAME_MAX}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const next = name.trim();
                if (!next || next === s.name) {
                  setName(s.name);
                  return;
                }
                // Re-slug alongside the name while the slug still looks
                // auto-generated, so hand-picked slugs are never clobbered.
                const wasAuto =
                  s.slug.startsWith("new-service-") || s.slug === slugify(s.name, "service");
                void onSave(s.id, {
                  name: next,
                  ...(wasAuto ? { slug: slugify(next, "service") } : {}),
                });
              }}
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
              onBlur={() => {
                const next = dsc.trim();
                if (!next) {
                  setDsc(s.dsc); // backend rejects an empty description
                  return;
                }
                if (next !== s.dsc) void onSave(s.id, { dsc: next });
              }}
              className={cn(inputCls, "min-h-16 resize-y")}
            />
          </Field>

          <Field label="Feature tags">
            <TagsInput
              tags={s.features}
              onChange={(features) => {
                if (readOnly) return;
                if (features.length > 12) {
                  toast("Up to 12 feature tags per service");
                  return;
                }
                void onSave(s.id, { features });
              }}
              placeholder="Add a feature, press Enter…"
            />
          </Field>
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
        {caption ?? `Square, 800×800+. ${IMAGE_FORMATS_LABEL}, under 8 MB.`}
      </p>
    </div>
  );
}
