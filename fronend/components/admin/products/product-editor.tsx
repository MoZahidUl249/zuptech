"use client";

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
}: {
  product: AdminProduct;
  onChange: (patch: Partial<AdminProduct>) => void;
  onDone: () => void;
  submitLabel?: string;
}) {
  const { state } = useAdmin();
  // Grouped so the picker shows the real hierarchy (Section → Category)
  // instead of a flat list of category names, several of which repeat
  // across sections.
  const sections = state.sections;
  // A draft that hasn't been saved yet has no server id — the upload
  // endpoints attach a photo to an existing product, so the gallery stays
  // disabled until the product has been created at least once.
  const isNew = !p.id;
  const MAX_PHOTOS = 12;
  // The backend 400s on a repeated minQty in either ladder, so saving is
  // blocked here rather than letting the request fail after the fact.
  const hasDuplicateTiers =
    duplicateMinQtys(p.quantityOffers).length > 0 ||
    duplicateMinQtys(p.freeDeliveryOffers).length > 0;

  const sellingPrice =
    p.onSale && p.salePercentage > 0
      ? Math.round(p.price * (1 - p.salePercentage / 100))
      : p.price;
  // Counted independently: a product can have a video and no photos, and the
  // old short-circuit on an empty gallery reported "No photos yet" for it,
  // hiding the video completely.
  const mediaParts = [
    p.photos.length ? `${p.photos.length} photo${p.photos.length === 1 ? "" : "s"}` : "",
    p.video ? "1 video" : "",
  ].filter(Boolean);
  const photoSummary = mediaParts.length ? mediaParts.join(" · ") : "No photos yet";
  const priceSummary =
    p.onSale && p.salePercentage > 0
      ? `${taka(sellingPrice)} — ${p.salePercentage}% off ${taka(p.price)}`
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
              <Field label="Product code (made for you)">
              <input
                value={p.sku}
                readOnly
                disabled
                placeholder="Auto-generated"
                aria-label="SKU (auto-generated)"
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
            <p className="mb-3 rounded-xl bg-warn-bg px-3.5 py-2.5 text-ui-sm text-warn-fg">
              Save the product first — photos attach to a product that already exists.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {p.photos.map((url, i) => (
              <PhotoSlot
                key={`${i}-${url}`}
                small
                label={i === 0 ? "Cover" : `Photo ${i + 1}`}
                value={url}
                disabled={isNew}
                onUpload={uploadPhoto}
                onRemove={() => removePhoto(i)}
              />
            ))}
            {!isNew && p.photos.length < MAX_PHOTOS ? (
              <PhotoSlot small label="Add photo" value={null} onUpload={uploadPhoto} onRemove={async () => {}} />
            ) : null}
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
            <Field label="Smallest deposit (%)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={p.minDp}
                onChange={(e) =>
                  onChange({
                    minDp: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  })
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
              <div className="w-32">
                <Field label="Discount (%)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                disabled={!p.onSale}
                value={p.salePercentage}
                onChange={(e) =>
                  onChange({
                    salePercentage: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  })
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
              {p.onSale && p.salePercentage > 0 ? (
                <span className="ml-2 text-ui-sm font-semibold text-zup-gray line-through">
                  {taka(p.price)}
                </span>
              ) : null}
            </p>
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
              hint="Buy more, pay less per unit. The highest tier the order reaches wins — tiers never stack, and the customer always gets whichever is cheaper: this or the flat sale price."
              unitLabel="% off each unit"
              tiers={p.quantityOffers}
              onChange={(quantityOffers) => onChange({ quantityOffers })}
            />
            <OfferTierEditor
              label="Free delivery"
              hint="Buy more, pay less delivery. Applies to whichever zone fee the order resolves to; 100% means the line ships free."
              unitLabel="% off delivery"
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
        <BtnPrimary onClick={onDone} disabled={hasDuplicateTiers}>
          {submitLabel}
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
