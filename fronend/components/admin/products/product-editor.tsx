"use client";

import { useEffect, useMemo } from "react";
import { useAdmin, taka, type AdminProduct } from "@/lib/admin";
import {
  uploadProductPhoto,
  deleteProductPhoto,
  uploadProductVideo,
  deleteProductVideo,
} from "@/lib/admin-api";
import {
  Field,
  BtnPrimary,
  inputCls,
  selectCls,
} from "../ui";
import { FormGroup, FormGroups } from "../primitives/form-section";
import { PhotoSlot, VideoSlot } from "./media-uploader";
import { OfferTierEditor, duplicateMinQtys } from "./offer-tier-editor";

export function ProductEditor({
  product: p,
  onChange,
  onDone,
  submitLabel = "Done",
  pendingPhotos = [],
  onPickPhoto,
  onDropPendingPhoto,
  busy,
}: {
  product: AdminProduct;
  onChange: (patch: Partial<AdminProduct>) => void;
  onDone: () => void;
  submitLabel?: string;
  /** New-product mode: photos chosen but not yet uploaded. */
  pendingPhotos?: File[];
  onPickPhoto?: (file: File) => void;
  onDropPendingPhoto?: (index: number) => void;
  busy?: boolean;
}) {
  const { state } = useAdmin();
  // Grouped so the picker shows the real hierarchy (Section → Category)
  // instead of a flat list of category names, several of which repeat
  // across sections.
  const sections = state.sections;
  // A draft has no server id yet, and the upload endpoints attach a photo to a
  // product that already exists. Rather than disabling the gallery (and making
  // "add a product with pictures" a two-visit job), a new product collects its
  // photos locally and they are uploaded the moment it is created.
  const isNew = !p.id;
  const MAX_PHOTOS = 12;
  // The backend 400s on a repeated minQty in either ladder, so saving is
  // blocked here rather than letting the request fail after the fact.
  const hasDuplicateTiers =
    duplicateMinQtys(p.quantityOffers).length > 0 ||
    duplicateMinQtys(p.freeDeliveryOffers).length > 0;

  // No arithmetic: the admin types what the customer pays. The old version
  // computed this from a percentage with Math.round while the server floored
  // the same sum, so the preview and the till disagreed by a taka.
  const onSale = p.onSale && p.salePrice > 0 && p.salePrice < p.price;
  const sellingPrice = onSale ? p.salePrice : p.price;
  const saleSaving = onSale ? p.price - p.salePrice : 0;
  // Counted independently: a product can have a video and no photos, and the
  // old short-circuit on an empty gallery reported "No photos yet" for it,
  // hiding the video completely.
  const photoCount = isNew ? pendingPhotos.length : p.photos.length;
  const mediaParts = [
    photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : "",
    p.video ? "1 video" : "",
  ].filter(Boolean);
  const photoSummary = mediaParts.length ? mediaParts.join(" · ") : "No photos yet";
  const priceSummary = onSale
    ? `${taka(sellingPrice)} — ${taka(saleSaving)} off ${taka(p.price)}`
    : taka(p.price);
  const feeSummary = `Delivery ${taka(p.deliveryFeeInsideDhaka)}/${taka(p.deliveryFeeOutsideDhaka)} · Installation ${taka(p.installationFeeInsideDhaka)}/${taka(p.installationFeeOutsideDhaka)}`;
  const tierCount = p.quantityOffers.length + p.freeDeliveryOffers.length;
  const offerSummary = tierCount === 0 ? "None" : `${tierCount} offer${tierCount === 1 ? "" : "s"}`;

  const uploadPhoto = async (file: File) => {
    const updated = await uploadProductPhoto(p.id, file);
    onChange({ photos: updated.photos });
  };
  const removePhoto = async (index: number) => {
    const updated = await deleteProductPhoto(p.id, index);
    onChange({ photos: updated.photos });
  };
  const uploadVideo = async (file: File) => {
    const updated = await uploadProductVideo(p.id, file);
    onChange({ video: updated.video });
  };
  const removeVideo = async () => {
    const updated = await deleteProductVideo(p.id);
    onChange({ video: updated.video });
  };
  /**
   * A pasted link needs no upload endpoint — `video` is an ordinary product
   * field, so it rides the editor's normal save like any other text input.
   * Replacing an uploaded file this way is safe: the PATCH route releases the
   * old Cloudinary asset when the value changes.
   */
  const setVideoUrl = async (url: string) => {
    onChange({ video: url });
  };

  return (
    <div className="py-2">
      <FormGroups defaultOpen={["basics"]}>
        <FormGroup
          step={1}
          value="basics"
          title="The basics"
          help="What this product is called, where it sits on the website, and what it does."
          summary={p.name ? `${p.name}${p.category ? ` · ${p.section} → ${p.category}` : ""}` : "Not named yet"}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name" className="col-span-2">
              <input
                value={p.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Which category">
              <select
                value={p.categoryId}
                onChange={(e) => {
                  // Keep the display names in step locally so the table and the
                  // editor header don't show a stale category until the next
                  // refetch.
                  const picked = state.categories.find((c) => c.id === e.target.value);
                  onChange({
                    categoryId: e.target.value,
                    category: picked?.name ?? "",
                    section: picked?.section ?? "",
                  });
                }}
                className={selectCls}
              >
                <option value="">— Select a category —</option>
                {sections.map((sec) => (
                  <optgroup key={sec.id} label={sec.name}>
                    {sec.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description">
            <textarea
              value={p.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Shown on the product page…"
              rows={3}
              className={`${inputCls} resize-y`}
            />
                    </Field>
          </div>
          <div className="mt-3">
            <Field label="Key points — one per line">
            <textarea
              value={p.specs.join("\n")}
              onChange={(e) => onChange({ specs: e.target.value.split("\n") })}
              placeholder={"Bullet points shown on the product page…"}
              rows={3}
              className={`${inputCls} resize-y`}
            />
                    </Field>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-ui-sm font-bold text-zup-blue">
              Advanced details
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Web address" className="col-span-2">
              <input
                value={p.slug}
                onChange={(e) => onChange({ slug: e.target.value })}
                placeholder="auto-generated-from-name"
                aria-label="URL slug"
                className={`${inputCls} font-mono`}
              />
            </Field>
              {/*
                Typed in, not handed out. This was read-only against a
                server-generated ZT-P0001, which is a code no delivery note,
                supplier invoice or shelf label has ever carried — the SKU is
                how the warehouse and the paperwork name the same box, so it
                has to be the one the business already uses.
              */}
              <Field label="Product code (SKU)">
              <input
                value={p.sku}
                onChange={(e) => onChange({ sku: e.target.value })}
                placeholder="e.g. ZT-IPS-1000"
                aria-label="SKU"
                required
                className={`${inputCls} font-mono`}
              />
            </Field>
            </div>
          </details>
        </FormGroup>

        <FormGroup
          step={2}
          value="photos"
          title="Photos and video"
          help="The first photo is the one customers see in listings. Up to 12 photos."
          summary={photoSummary}
        >
          {isNew ? (
            <p className="mb-3 text-ui-sm text-zup-gray">
              Pick the photos now — they upload as soon as the product is created.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {isNew ? (
              <>
                {pendingPhotos.map((file, i) => (
                  <PendingPhoto
                    key={`${file.name}-${file.size}-${i}`}
                    file={file}
                    label={i === 0 ? "Cover" : `Photo ${i + 1}`}
                    onRemove={() => onDropPendingPhoto?.(i)}
                  />
                ))}
                {pendingPhotos.length < MAX_PHOTOS ? (
                  <PhotoSlot
                    small
                    label="Add photo"
                    value={null}
                    onPick={onPickPhoto}
                    onRemove={async () => {}}
                  />
                ) : null}
              </>
            ) : (
              <>
                {p.photos.map((url, i) => (
                  <PhotoSlot
                    key={`${i}-${url}`}
                    small
                    label={i === 0 ? "Cover" : `Photo ${i + 1}`}
                    value={url}
                    onUpload={uploadPhoto}
                    onRemove={() => removePhoto(i)}
                  />
                ))}
                {p.photos.length < MAX_PHOTOS ? (
                  <PhotoSlot small label="Add photo" value={null} onUpload={uploadPhoto} onRemove={async () => {}} />
                ) : null}
              </>
            )}
          </div>
          <p className="mt-4 mb-2 text-ui-sm font-bold text-zup-mid">Video (optional)</p>
          <VideoSlot
            value={p.video || null}
            disabled={isNew}
            onUpload={uploadVideo}
            onRemove={removeVideo}
            onSetUrl={setVideoUrl}
          />
        </FormGroup>

        <FormGroup
          step={3}
          value="price"
          title="Price"
          help="“Normal price” is what you charge. Turn on the sale to show a discount instead."
          summary={priceSummary}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Normal price (৳)">
              <input
                type="number"
                inputMode="numeric"
                value={p.price}
                onChange={(e) => onChange({ price: Math.max(0, Number(e.target.value) || 0) })}
                className={inputCls}
              />
            </Field>
            <Field label="What it costs you (৳)">
              <input
                type="number"
                inputMode="numeric"
                value={p.cost}
                onChange={(e) => onChange({ cost: Math.max(0, Number(e.target.value) || 0) })}
                className={inputCls}
              />
            </Field>
            <Field label="Smallest deposit (৳)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={p.minDeposit}
                onChange={(e) =>
                  onChange({ minDeposit: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-4 rounded-xl border border-zup-body/8 bg-surface-sunken p-3.5">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-end gap-2 pb-2.5 text-ui-sm font-semibold text-zup-gray">
              <input
                type="checkbox"
                checked={p.onSale}
                onChange={(e) => onChange({ onSale: e.target.checked })}
                className="h-4 w-4"
              />
              This product is on sale
            </label>
              <div className="w-40">
                <Field label="Sale price (৳)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                disabled={!p.onSale}
                value={p.salePrice}
                onChange={(e) =>
                  onChange({ salePrice: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                }
                className={`${inputCls} disabled:opacity-50`}
              />
            </Field>
              </div>
            </div>
            {/* The one number that matters, worked out for you — the old form
                showed a price and a percentage and left you to do the sum. */}
            <p className="mt-3 text-ui-base font-bold text-zup-body">
              Customer pays {taka(sellingPrice)}
              {onSale ? (
                <>
                  <span className="ml-2 text-ui-sm font-semibold text-zup-gray line-through">
                    {taka(p.price)}
                  </span>
                  <span className="ml-2 text-ui-sm font-semibold text-zup-green-dark">
                    saves {taka(saleSaving)}
                  </span>
                </>
              ) : null}
            </p>
            {p.onSale && p.salePrice >= p.price && p.salePrice > 0 ? (
              <p className="mt-1.5 text-ui-sm font-semibold text-warn-fg">
                That is not below the regular price, so nothing is discounted.
              </p>
            ) : null}
          </div>
        </FormGroup>

        <FormGroup
          step={4}
          value="delivery"
          title="Delivery and installation"
          help="What you charge on top of the price. It depends on whether the customer is inside or outside Dhaka."
          summary={feeSummary}
        >
          {/* Was four loose number boxes in a row of five. As a labelled grid
              it's obvious which number belongs to which combination. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-2">
              <thead>
                <tr>
                  <th />
                  <th className="text-left text-ui-sm font-bold text-zup-mid">Inside Dhaka</th>
                  <th className="text-left text-ui-sm font-bold text-zup-mid">Outside Dhaka</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="text-left text-ui-sm font-bold text-zup-mid">Delivery</th>
                  <td><Field label="Delivery, inside Dhaka">
              <input
                type="number"
                inputMode="numeric"
                value={p.deliveryFeeInsideDhaka}
                onChange={(e) =>
                  onChange({ deliveryFeeInsideDhaka: Math.max(0, Number(e.target.value) || 0) })
                }
                className={inputCls}
              />
            </Field></td>
                  <td><Field label="Delivery, outside Dhaka">
              <input
                type="number"
                inputMode="numeric"
                value={p.deliveryFeeOutsideDhaka}
                onChange={(e) =>
                  onChange({ deliveryFeeOutsideDhaka: Math.max(0, Number(e.target.value) || 0) })
                }
                className={inputCls}
              />
            </Field></td>
                </tr>
                <tr>
                  <th className="text-left text-ui-sm font-bold text-zup-mid">Installation</th>
                  <td><Field label="Installation, inside Dhaka">
              <input
                type="number"
                inputMode="numeric"
                value={p.installationFeeInsideDhaka}
                onChange={(e) =>
                  onChange({ installationFeeInsideDhaka: Math.max(0, Number(e.target.value) || 0) })
                }
                className={inputCls}
              />
            </Field></td>
                  <td><Field label="Installation, outside Dhaka">
              <input
                type="number"
                inputMode="numeric"
                value={p.installationFeeOutsideDhaka}
                onChange={(e) =>
                  onChange({ installationFeeOutsideDhaka: Math.max(0, Number(e.target.value) || 0) })
                }
                className={inputCls}
              />
            </Field></td>
                </tr>
              </tbody>
            </table>
          </div>
        </FormGroup>

        <FormGroup
          step={5}
          value="offers"
          title="Bulk-buy offers"
          help="Reward bigger orders. Only the best tier a customer reaches applies — they never stack."
          summary={offerSummary}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <OfferTierEditor
              label="Quantity discount"
              hint="Buy more, pay less per unit. The highest tier the order reaches wins — tiers never stack, and the customer always gets whichever is cheaper: this or the sale price."
              unitLabel="৳ off each unit"
              tiers={p.quantityOffers}
              onChange={(quantityOffers) => onChange({ quantityOffers })}
            />
            <OfferTierEditor
              label="Free delivery"
              hint="Buy more, pay less delivery. Applies to whichever zone fee the order resolves to, and is capped at that fee — so an amount at or above it means the line ships free."
              unitLabel="৳ off delivery"
              freeAt={Math.max(p.deliveryFeeInsideDhaka, p.deliveryFeeOutsideDhaka)}
              tiers={p.freeDeliveryOffers}
              onChange={(freeDeliveryOffers) => onChange({ freeDeliveryOffers })}
            />
          </div>
        </FormGroup>

        <FormGroup
          step={6}
          value="stock"
          title="Stock"
          help="How many you have, and when to remind you to order more."
          summary={`${p.stock} in stock${p.reorderAt > 0 ? ` · warn at ${p.reorderAt}` : ""}`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How many in stock">
              <input
                type="number"
                inputMode="numeric"
                value={p.stock}
                onChange={(e) => onChange({ stock: Math.max(0, Number(e.target.value) || 0) })}
                className={inputCls}
              />
            </Field>
            <Field label="Warn me when stock drops to">
              <input
                type="number"
                inputMode="numeric"
                value={p.reorderAt}
                onChange={(e) => onChange({ reorderAt: Math.max(0, Number(e.target.value) || 0) })}
                className={inputCls}
              />
            </Field>
          </div>
        </FormGroup>

        <FormGroup
          step={7}
          value="warranty"
          title="Warranty"
          help="Set this and a warranty record is created automatically when an order is delivered."
          summary={p.warrantyMonths > 0 ? `${p.warrantyMonths} months` : "No warranty"}
        >
          <div className="max-w-[220px]">
            <Field label="Warranty (months)">
              <input
                type="number"
                inputMode="numeric"
                value={p.warrantyMonths}
                // 0 = no warranty. Anything above it makes a warranty record
                // appear in the registry when an order of this product is
                // delivered — see components/admin/section-warranty.tsx.
                onChange={(e) =>
                  onChange({
                    warrantyMonths: Math.min(240, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className={inputCls}
              />
            </Field>
          </div>
        </FormGroup>

        <FormGroup
          step={8}
          value="visibility"
          title="Show on the website"
          summary={p.visible ? "Live on the website" : "Hidden"}
        >
          <div className="flex flex-col gap-3">
            <label className="flex items-end gap-2 pb-2.5 text-ui-sm font-semibold text-zup-gray">
              <input
                type="checkbox"
                checked={p.visible}
                onChange={(e) => onChange({ visible: e.target.checked })}
                className="h-4 w-4"
              />
              Show this product on the website
            </label>
            <Field label="Photo description (for screen readers)" className="col-span-2 lg:col-span-3">
              <input
                value={p.imgHint}
                onChange={(e) => onChange({ imgHint: e.target.value })}
                placeholder="Alt text / placeholder description"
                className={inputCls}
              />
            </Field>
          </div>
        </FormGroup>
      </FormGroups>

      <div className="mt-5">
        <BtnPrimary onClick={onDone} disabled={hasDuplicateTiers || busy}>
          {busy ? "Adding…" : submitLabel}
        </BtnPrimary>
        {hasDuplicateTiers ? (
          <p className="mt-2 text-ui-sm font-semibold text-destructive">
            Two bulk-buy tiers use the same quantity — fix that before saving.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A photo chosen for a product that doesn't exist yet.
 *
 * Rendered from an object URL so the operator sees what they picked; the file
 * itself is uploaded by the create step. The URL is revoked on unmount, which
 * is the whole reason this is a component rather than an inline <img>.
 */
function PendingPhoto({
  file,
  label,
  onRemove,
}: {
  file: File;
  label: string;
  onRemove: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="relative flex h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-1.5 text-ui-micro font-bold text-white"
      >
        ✕
      </button>
    </div>
  );
}
