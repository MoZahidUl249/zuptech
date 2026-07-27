"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImageIcon, Plus, Star } from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import {
  useAdmin,
  taka,
  bd,
  type AdminProduct,
  type PurchaseOrder,
} from "@/lib/admin";
import {
  uploadProductPhoto,
  deleteProductPhoto,
  uploadProductVideo,
  deleteProductVideo,
} from "@/lib/admin-api";
import {
  Card,
  KpiCard,
  Table,
  Td,
  Pill,
  Field,
  Segmented,
  BtnPrimary,
  BtnGhost,
  BtnDanger,
  inputCls,
  selectCls,
} from "./ui";
import { ConfirmDialog } from "./confirm-dialog";

/* ===== Products (catalog CRUD) ===== */

function emptyDraftProduct(): AdminProduct {
  return {
    id: "",
    slug: "",
    name: "",
    categoryId: "",
    category: "",
    section: "",
    sku: "", // assigned by the server on create
    price: 0,
    cost: 0,
    minDp: 0,
    onSale: false,
    salePercentage: 0,
    deliveryFeeInsideDhaka: 0,
    deliveryFeeOutsideDhaka: 0,
    installationFeeInsideDhaka: 0,
    installationFeeOutsideDhaka: 0,
    freeDeliveryMinQty: 0,
    quantityOffers: [],
    warrantyMonths: 0,
    rating: 0,
    sold: 0,
    imgHint: "product photo",
    specs: [],
    video: "",
    stock: 0,
    reserved: 0,
    reorderAt: 0,
    visible: false,
    description: "",
    photos: [],
  };
}

const NO_CATEGORY_FILTER = "All categories";

export function ProductsSection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("products") !== "manage";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState(NO_CATEGORY_FILTER);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AdminProduct>(emptyDraftProduct);

  // Taken from the loaded taxonomy rather than derived from the products, so
  // a category with no products yet is still selectable.
  const allCategories = useMemo(
    () => [...state.categories].sort((a, b) => a.name.localeCompare(b.name)),
    [state.categories],
  );

  const filtersActive =
    q.trim() !== "" ||
    filter !== "All" ||
    categoryFilter !== NO_CATEGORY_FILTER ||
    priceMin !== "" ||
    priceMax !== "" ||
    stockMin !== "" ||
    stockMax !== "";

  const resetFilters = () => {
    setQ("");
    setFilter("All");
    setCategoryFilter(NO_CATEGORY_FILTER);
    setPriceMin("");
    setPriceMax("");
    setStockMin("");
    setStockMax("");
  };

  const rows = state.products.filter((p) => {
    const needle = q.trim().toLowerCase();
    const matchQ =
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      p.sku.toLowerCase().includes(needle) ||
      p.category.toLowerCase().includes(needle) ||
      p.section.toLowerCase().includes(needle);
    const matchF =
      filter === "All" ||
      (filter === "Live"
        ? p.visible
        : filter === "Hidden"
          ? !p.visible
          : filter === "Featured"
            ? state.featuredIds.includes(p.id)
            : true);
    const matchCat =
      categoryFilter === NO_CATEGORY_FILTER || p.categoryId === categoryFilter;
    const matchPriceMin = priceMin === "" || p.price >= Number(priceMin);
    const matchPriceMax = priceMax === "" || p.price <= Number(priceMax);
    const matchStockMin = stockMin === "" || p.stock >= Number(stockMin);
    const matchStockMax = stockMax === "" || p.stock <= Number(stockMax);
    return (
      matchQ && matchF && matchCat && matchPriceMin && matchPriceMax && matchStockMin && matchStockMax
    );
  });

  const setProduct = (id: string, patch: Partial<AdminProduct>) =>
    update({
      products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const toggleFeatured = (p: AdminProduct) => {
    const on = state.featuredIds.includes(p.id);
    update({
      featuredIds: on
        ? state.featuredIds.filter((id) => id !== p.id)
        : [...state.featuredIds, p.id],
    });
    toast(
      on
        ? `${p.name} removed from Featured products`
        : `${p.name} added to Featured products`,
    );
  };

  const submitDraft = () => {
    if (!draft.name.trim()) {
      toast("Product name is required");
      return;
    }
    if (!draft.categoryId) {
      toast("Pick a category — the catalog requires one");
      return;
    }
    const id = `p${Date.now()}`;
    const fresh: AdminProduct = {
      ...draft,
      id,
      name: draft.name.trim(),
      slug: draft.slug.trim() || slugify(draft.name, "product"),
    };
    update({ products: [fresh, ...state.products] });
    setAdding(false);
    setDraft(emptyDraftProduct());
    toast("Product created — syncing…");
  };

  const removeProduct = (p: AdminProduct) => {
    update({
      products: state.products.filter((x) => x.id !== p.id),
      featuredIds: state.featuredIds.filter((id) => id !== p.id),
    });
    if (editingId === p.id) setEditingId(null);
    toast(`${p.name} deleted`);
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-zup-soft">
            {rows.length} of {state.products.length} products
          </p>
          <BtnPrimary
            onClick={() => {
              setAdding((a) => !a);
              setDraft(emptyDraftProduct());
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> {adding ? "Close" : "Add product"}
          </BtnPrimary>
        </div>
      ) : null}

      {adding ? (
        <Card className="px-5 py-5 sm:px-6">
          <p className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em] text-zup-soft">
            New product
          </p>
          <ProductEditor
            product={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onDone={submitDraft}
            submitLabel="Add product"
          />
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product, SKU or category…"
          aria-label="Search products"
          className={`${inputCls} max-w-[340px] flex-1 rounded-full`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by visibility"
          className={selectCls}
        >
          {["All", "Live", "Hidden", "Featured"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className={selectCls}
        >
          <option value={NO_CATEGORY_FILTER}>{NO_CATEGORY_FILTER}</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.section} → {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="Min ৳"
            aria-label="Minimum price"
            className={`${inputCls} w-24`}
          />
          <span className="text-zup-faint">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="Max ৳"
            aria-label="Maximum price"
            className={`${inputCls} w-24`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={stockMin}
            onChange={(e) => setStockMin(e.target.value)}
            placeholder="Min stock"
            aria-label="Minimum stock"
            className={`${inputCls} w-24`}
          />
          <span className="text-zup-faint">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={stockMax}
            onChange={(e) => setStockMax(e.target.value)}
            placeholder="Max stock"
            aria-label="Maximum stock"
            className={`${inputCls} w-24`}
          />
        </div>
        {filtersActive ? (
          <BtnGhost onClick={resetFilters}>Reset filters</BtnGhost>
        ) : null}
      </div>

      <Card className="px-2 py-2">
        <Table
          head={["Product", "Category", "Price", "Stock", "Featured", "Visibility", ""]}
          minWidth={880}
        >
          {rows.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              featured={state.featuredIds.includes(p.id)}
              readOnly={readOnly}
              editing={editingId === p.id}
              onToggleFeatured={() => toggleFeatured(p)}
              onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
              onDone={() => {
                setEditingId(null);
                toast(`${p.name} saved`);
              }}
              onDelete={() => removeProduct(p)}
              onChange={(patch) => setProduct(p.id, patch)}
            />
          ))}
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={7} className="py-10 text-center text-zup-soft">
                No products match your search.
              </Td>
            </tr>
          ) : null}
        </Table>
      </Card>
      <p className="text-xs leading-relaxed text-zup-soft">
        ★ Featured products appear in the home page&apos;s &ldquo;Featured products&rdquo;
        row, in the order they were added.
      </p>
    </div>
  );
}

function ProductRow({
  product: p,
  featured,
  readOnly,
  editing,
  onToggleFeatured,
  onEdit,
  onDone,
  onDelete,
  onChange,
}: {
  product: AdminProduct;
  featured: boolean;
  readOnly: boolean;
  editing: boolean;
  onToggleFeatured: () => void;
  onEdit: () => void;
  onDone: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<AdminProduct>) => void;
}) {
  return (
    <>
      <tr className={cn(!editing && "last:[&>td]:border-0")}>
        <Td className="font-bold">{p.name}</Td>
        <Td className="max-w-[180px]">
          {p.category ? (
            <span className="flex flex-col gap-0.5">
              <Pill tone="blue" className="w-fit px-2 py-0.5 text-[10px]">
                {p.category}
              </Pill>
              <span className="text-[10.5px] text-zup-soft">{p.section}</span>
            </span>
          ) : (
            <span className="text-zup-faint">—</span>
          )}
        </Td>
        <Td className="whitespace-nowrap font-bold">{taka(p.price)}</Td>
        <Td
          className={cn(
            "font-bold",
            p.stock === 0
              ? "text-[#D32F2F]"
              : p.stock <= p.reorderAt
                ? "text-[#B7791F]"
                : undefined,
          )}
        >
          {p.stock}
        </Td>
        <Td>
          <button
            type="button"
            disabled={readOnly}
            onClick={onToggleFeatured}
            aria-pressed={featured}
            aria-label={`${featured ? "Remove" : "Add"} ${p.name} ${featured ? "from" : "to"} featured products`}
            title={featured ? "Remove from featured" : "Add to featured"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              readOnly
                ? "cursor-not-allowed opacity-35"
                : "cursor-pointer hover:bg-secondary",
            )}
          >
            <Star
              className={cn(
                "h-4.5 w-4.5",
                featured ? "fill-[#F0A32E] text-[#F0A32E]" : "text-zup-faint",
              )}
              aria-hidden
            />
          </button>
        </Td>
        <Td>
          {readOnly ? (
            <Pill tone={p.visible ? "green" : "gray"}>{p.visible ? "Live" : "Hidden"}</Pill>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ visible: !p.visible })}
              aria-pressed={p.visible}
              aria-label={`Toggle visibility of ${p.name}`}
              className="cursor-pointer"
            >
              <Pill tone={p.visible ? "green" : "gray"}>{p.visible ? "Live" : "Hidden"}</Pill>
            </button>
          )}
        </Td>
        <Td className="text-right">
          {!readOnly ? (
            <span className="flex justify-end gap-2">
              <BtnGhost onClick={onEdit}>{editing ? "Close" : "Edit"}</BtnGhost>
              <ConfirmDialog
                trigger={<BtnDanger>Delete</BtnDanger>}
                title={`Delete "${p.name}"?`}
                description="It will be removed from the catalog and storefront immediately. This can't be undone."
                confirmLabel="Delete"
                onConfirm={onDelete}
              />
            </span>
          ) : null}
        </Td>
      </tr>
      {editing ? (
        <tr>
          <Td colSpan={7} className="bg-[#FAFBFC]">
            <ProductEditor product={p} onChange={onChange} onDone={onDone} />
          </Td>
        </tr>
      ) : null}
    </>
  );
}

/** Max upload accepted by POST /admin/api/products/:id/photos (see products.dto.ts). */
const MAX_PHOTO_BYTES = 8_000_000;

function PhotoSlot({
  label,
  value,
  onUpload,
  onRemove,
  disabled,
  small,
}: {
  label: string;
  value: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
  small?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const inert = disabled || busy;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center",
        small ? "h-16 w-16" : "h-28 w-28",
        inert && "opacity-60",
      )}
    >
      {value ? (
        <>
          <Image src={value} alt={label} fill unoptimized className="object-cover" />
          <button
            type="button"
            disabled={inert}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemove();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't remove photo");
              } finally {
                setBusy(false);
              }
            }}
            aria-label={`Remove ${label}`}
            className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          {!small ? <ImageIcon className="mb-1 h-4 w-4 text-zup-faint" aria-hidden /> : null}
          <span className={cn("font-semibold text-zup-gray", small ? "text-[10px]" : "text-xs")}>
            {busy ? "Uploading…" : label}
          </span>
          <button
            type="button"
            disabled={inert}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "cursor-pointer text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline",
              small ? "text-[10px]" : "text-[11px]",
            )}
          >
            browse
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_PHOTO_BYTES) {
            toast("Image too large — keep uploads under 8 MB");
            return;
          }
          setBusy(true);
          try {
            await onUpload(f);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** Max upload accepted by POST /admin/api/products/:id/video (see products.dto.ts). */
const MAX_VIDEO_BYTES = 300_000_000;

function VideoSlot({
  value,
  onUpload,
  onRemove,
  disabled,
}: {
  value: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const inert = disabled || busy;

  return (
    <div
      className={cn(
        "relative flex h-28 w-48 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center",
        inert && "opacity-60",
      )}
    >
      {value ? (
        <>
          <video src={value} controls muted className="h-full w-full object-cover" />
          <button
            type="button"
            disabled={inert}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemove();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't remove video");
              } finally {
                setBusy(false);
              }
            }}
            aria-label="Remove product video"
            className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="text-xs font-semibold text-zup-gray">
            {busy ? "Uploading…" : "Product video"}
          </span>
          <button
            type="button"
            disabled={inert}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer text-[11px] text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline"
          >
            browse
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        aria-label="Upload product video"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_VIDEO_BYTES) {
            toast("Video too large — keep uploads under 300 MB");
            return;
          }
          setBusy(true);
          try {
            await onUpload(f);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function ProductEditor({
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

  return (
    <div className="flex flex-col gap-4 py-2 md:flex-row md:gap-6">
      <div className="w-[280px] shrink-0">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-zup-soft">
          Photos ({p.photos.length}/{MAX_PHOTOS}) — first is the cover
        </p>
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
            <PhotoSlot
              small
              label="Add photo"
              value={null}
              onUpload={uploadPhoto}
              onRemove={async () => {}}
            />
          ) : null}
        </div>
        {isNew ? (
          <p className="mt-2 max-w-[220px] text-[10px] leading-snug text-zup-faint">
            Save the product first, then add photos.
          </p>
        ) : null}

        <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-zup-soft">
          Video (optional)
        </p>
        <VideoSlot
          value={p.video || null}
          disabled={isNew}
          onUpload={uploadVideo}
          onRemove={removeVideo}
        />
        {isNew ? (
          <p className="mt-2 max-w-[112px] text-[10px] leading-snug text-zup-faint">
            Save the product first, then add a video.
          </p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label="Name" className="col-span-2">
            <input
              value={p.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="SKU">
            <input
              value={p.sku}
              readOnly
              disabled
              placeholder="Auto-generated"
              aria-label="SKU (auto-generated)"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Price (৳)">
            <input
              type="number"
              inputMode="numeric"
              value={p.price}
              onChange={(e) => onChange({ price: Math.max(0, Number(e.target.value) || 0) })}
              className={inputCls}
            />
          </Field>
          <Field label="Stock">
            <input
              type="number"
              inputMode="numeric"
              value={p.stock}
              onChange={(e) => onChange({ stock: Math.max(0, Number(e.target.value) || 0) })}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label="Category">
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
          <Field label="Slug" className="col-span-2">
            <input
              value={p.slug}
              onChange={(e) => onChange({ slug: e.target.value })}
              placeholder="auto-generated-from-name"
              aria-label="URL slug"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Reorder at">
            <input
              type="number"
              inputMode="numeric"
              value={p.reorderAt}
              onChange={(e) => onChange({ reorderAt: Math.max(0, Number(e.target.value) || 0) })}
              className={inputCls}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2.5 text-[13px] font-semibold text-zup-gray">
            <input
              type="checkbox"
              checked={p.visible}
              onChange={(e) => onChange({ visible: e.target.checked })}
              className="h-4 w-4"
            />
            Visible on storefront
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label="Cost (৳)">
            <input
              type="number"
              inputMode="numeric"
              value={p.cost}
              onChange={(e) => onChange({ cost: Math.max(0, Number(e.target.value) || 0) })}
              className={inputCls}
            />
          </Field>
          <Field label="Min down payment (%)">
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
          <p className="col-span-2 self-end pb-2 text-xs leading-relaxed text-zup-soft lg:col-span-3">
            Shown on the product page as &ldquo;Minimum down payment for this product{" "}
            {p.minDp}%.&rdquo;
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label className="flex items-end gap-2 pb-2.5 text-[13px] font-semibold text-zup-gray">
            <input
              type="checkbox"
              checked={p.onSale}
              onChange={(e) => onChange({ onSale: e.target.checked })}
              className="h-4 w-4"
            />
            On sale
          </label>
          <Field label="Sale (%)">
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
          <Field label="Image hint" className="col-span-2 lg:col-span-3">
            <input
              value={p.imgHint}
              onChange={(e) => onChange({ imgHint: e.target.value })}
              placeholder="Alt text / placeholder description"
              className={inputCls}
            />
          </Field>
        </div>

        <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-zup-soft">
          Delivery &amp; installation fees (৳)
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Delivery — inside Dhaka">
            <input
              type="number"
              inputMode="numeric"
              value={p.deliveryFeeInsideDhaka}
              onChange={(e) =>
                onChange({ deliveryFeeInsideDhaka: Math.max(0, Number(e.target.value) || 0) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Delivery — outside Dhaka">
            <input
              type="number"
              inputMode="numeric"
              value={p.deliveryFeeOutsideDhaka}
              onChange={(e) =>
                onChange({ deliveryFeeOutsideDhaka: Math.max(0, Number(e.target.value) || 0) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Installation — inside Dhaka">
            <input
              type="number"
              inputMode="numeric"
              value={p.installationFeeInsideDhaka}
              onChange={(e) =>
                onChange({ installationFeeInsideDhaka: Math.max(0, Number(e.target.value) || 0) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Installation — outside Dhaka">
            <input
              type="number"
              inputMode="numeric"
              value={p.installationFeeOutsideDhaka}
              onChange={(e) =>
                onChange({ installationFeeOutsideDhaka: Math.max(0, Number(e.target.value) || 0) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Free delivery at qty">
            <input
              type="number"
              inputMode="numeric"
              value={p.freeDeliveryMinQty}
              // 0 disables it; any line with qty >= this ships free.
              onChange={(e) =>
                onChange({ freeDeliveryMinQty: Math.max(0, Number(e.target.value) || 0) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Warranty months">
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

        <Field label="Specs (one per line, up to 8)" className="mt-3">
          <textarea
            value={p.specs.join("\n")}
            onChange={(e) => onChange({ specs: e.target.value.split("\n") })}
            placeholder={"Bullet points shown on the product page…"}
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </Field>

        <Field label="Description" className="mt-3">
          <textarea
            value={p.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Shown on the product page…"
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </Field>

        <BtnPrimary onClick={onDone} className="mt-4">
          {submitLabel}
        </BtnPrimary>
      </div>
    </div>
  );
}

/* ===== Inventory ===== */

type InvTab = "stock" | "po" | "movements" | "suppliers";

function nowLabel(): string {
  const d = new Date();
  const month = d.toLocaleString("en", { month: "short" });
  return `${d.getDate()} ${month}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function etaLabel(daysAhead = 7): string {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
}

export function InventorySection() {
  const { state, update, can, user } = useAdmin();
  const readOnly = can("inventory") !== "manage";
  const [tab, setTab] = useState<InvTab>("stock");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All stock");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [draftStock, setDraftStock] = useState(0);

  const me = user?.username ?? "you";
  const totalValue = state.products.reduce((a, p) => a + p.cost * p.stock, 0);
  const low = state.products.filter((p) => p.stock > 0 && p.stock <= p.reorderAt);
  const out = state.products.filter((p) => p.stock === 0);
  const openPos = state.purchaseOrders.filter(
    (po) => po.status === "Confirmed" || po.status === "In transit",
  );

  const rows = state.products.filter((p) => {
    const needle = q.trim().toLowerCase();
    const matchQ =
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      p.sku.toLowerCase().includes(needle);
    const matchF =
      filter === "All stock" ||
      (filter === "Low stock"
        ? p.stock > 0 && p.stock <= p.reorderAt
        : filter === "Out of stock"
          ? p.stock === 0
          : true);
    return matchQ && matchF;
  });

  const logMovement = (sku: string, change: number, reason: string) => ({
    id: `m${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    date: nowLabel(),
    sku,
    change,
    reason,
    by: me,
  });

  const saveAdjust = () => {
    const p = state.products.find((x) => x.id === adjustingId);
    if (!p) return;
    const diff = draftStock - p.stock;
    update({
      products: state.products.map((x) =>
        x.id === p.id ? { ...x, stock: draftStock } : x,
      ),
      movements:
        diff !== 0
          ? [logMovement(p.sku, diff, "Manual stock adjustment"), ...state.movements]
          : state.movements,
    });
    setAdjustingId(null);
    toast(`${p.sku} on-hand set to ${draftStock}`);
  };

  const reorder = (p: AdminProduct) => {
    const supplier = state.suppliers[0];
    if (!supplier) {
      toast("Add a supplier first (Suppliers tab)");
      return;
    }
    const qty = Math.max(p.reorderAt * 2 - p.stock, p.reorderAt, 1);
    // value is computed by the backend (cost × qty) — the row refreshes with
    // the server's figure right after the PO is created.
    const po: PurchaseOrder = {
      id: `PO-${2200 + state.purchaseOrders.length + 12}`,
      supplierId: supplier.id,
      productId: p.id,
      qty,
      value: 0,
      eta: etaLabel(),
      status: "Confirmed",
    };
    update({ purchaseOrders: [po, ...state.purchaseOrders] });
    toast(`${po.id} created — ${qty} × ${p.name} from ${supplier.name}`);
  };

  const receivePo = (po: PurchaseOrder) => {
    const p = state.products.find((x) => x.id === po.productId);
    update({
      purchaseOrders: state.purchaseOrders.map((x) =>
        x.id === po.id ? { ...x, status: "Received" } : x,
      ),
      products: p
        ? state.products.map((x) =>
            x.id === p.id ? { ...x, stock: x.stock + po.qty } : x,
          )
        : state.products,
      movements: p
        ? [logMovement(p.sku, po.qty, `${po.id} received`), ...state.movements]
        : state.movements,
    });
    toast(p ? `${po.id} received — ${p.sku} +${po.qty}` : `${po.id} received`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard
          label="Total SKUs"
          value={String(state.products.length)}
          note={`${state.products.filter((p) => p.visible).length} live on store`}
        />
        <KpiCard
          label="Stock value (cost)"
          value={taka(totalValue)}
          note={`${bd(state.products.reduce((a, p) => a + p.stock, 0))} units on hand`}
        />
        <KpiCard
          label="Low stock"
          value={String(low.length)}
          note={low.length ? "reorder soon" : "all healthy"}
          tone="amber"
        />
        <KpiCard
          label="Open purchase orders"
          value={String(openPos.length)}
          note={out.length ? `${out.length} SKU out of stock` : "incoming stock"}
          tone={out.length ? "red" : "muted"}
        />
      </div>

      <Segmented
        options={[
          { value: "stock", label: "Stock" },
          { value: "po", label: "Purchase orders" },
          { value: "movements", label: "Movements" },
          { value: "suppliers", label: "Suppliers" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "stock" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product or SKU…"
              aria-label="Search inventory"
              className={`${inputCls} max-w-[460px] flex-1 rounded-full`}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter stock"
              className={selectCls}
            >
              {["All stock", "Low stock", "Out of stock"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>

          <Card className="px-2 py-2">
            <Table
              head={["SKU", "Product", "On hand", "Reserved", "Available", "Reorder at", "Stock value", ""]}
              minWidth={940}
            >
              {rows.map((p) => {
                const lowP = p.stock > 0 && p.stock <= p.reorderAt;
                const outP = p.stock === 0;
                const adjusting = adjustingId === p.id;
                const hasOpenPo = openPos.some((po) => po.productId === p.id);
                return (
                  <tr key={p.id} className={cn("last:[&>td]:border-0", adjusting && "bg-[#F4F7FE]")}>
                    <Td className="font-mono text-[13px] text-zup-gray">{p.sku}</Td>
                    <Td className="font-bold">
                      {p.name}
                      {lowP ? (
                        <Pill tone="amber" className="ml-2 px-2 py-0.5 text-[10px]">
                          LOW
                        </Pill>
                      ) : null}
                      {outP ? (
                        <Pill tone="red" className="ml-2 px-2 py-0.5 text-[10px]">
                          OUT
                        </Pill>
                      ) : null}
                      {hasOpenPo ? (
                        <Pill tone="blue" className="ml-2 px-2 py-0.5 text-[10px]">
                          PO OPEN
                        </Pill>
                      ) : null}
                    </Td>
                    <Td
                      className={cn(
                        "font-bold",
                        outP ? "text-[#D32F2F]" : lowP ? "text-[#B7791F]" : undefined,
                      )}
                    >
                      {adjusting ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Decrease stock"
                            onClick={() => setDraftStock((s) => Math.max(0, s - 1))}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-base font-bold text-zup-mid shadow-sm transition-colors hover:bg-secondary"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={draftStock}
                            autoFocus
                            aria-label={`On-hand stock for ${p.name}`}
                            onChange={(e) =>
                              setDraftStock(Math.max(0, Math.round(Number(e.target.value) || 0)))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveAdjust();
                              if (e.key === "Escape") setAdjustingId(null);
                            }}
                            className="h-8 w-14 rounded-lg border border-zup-blue bg-white px-1 text-center text-sm font-bold outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Increase stock"
                            onClick={() => setDraftStock((s) => s + 1)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-base font-bold text-zup-mid shadow-sm transition-colors hover:bg-secondary"
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        p.stock
                      )}
                    </Td>
                    <Td className="text-zup-gray">{p.reserved}</Td>
                    <Td className="font-bold">{Math.max(p.stock - p.reserved, 0)}</Td>
                    <Td className="text-zup-gray">{p.reorderAt}</Td>
                    <Td className="whitespace-nowrap">৳ {bd(p.cost * p.stock)}</Td>
                    <Td className="text-right">
                      {!readOnly ? (
                        adjusting ? (
                          <span className="flex justify-end gap-2">
                            <BtnPrimary onClick={saveAdjust} className="min-h-8 px-4 text-[13px]">
                              Save
                            </BtnPrimary>
                            <BtnGhost onClick={() => setAdjustingId(null)}>Cancel</BtnGhost>
                          </span>
                        ) : (
                          <span className="flex justify-end gap-2">
                            {(lowP || outP) && !hasOpenPo ? (
                              <BtnPrimary
                                onClick={() => reorder(p)}
                                className="min-h-8 px-4 text-[13px]"
                              >
                                Reorder
                              </BtnPrimary>
                            ) : null}
                            <BtnGhost
                              onClick={() => {
                                setAdjustingId(p.id);
                                setDraftStock(p.stock);
                              }}
                            >
                              Adjust
                            </BtnGhost>
                          </span>
                        )
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </>
      ) : null}

      {tab === "po" ? (
        <PurchaseOrdersTab readOnly={readOnly} onReceive={receivePo} />
      ) : null}

      {tab === "movements" ? (
        <Card className="px-2 py-2">
          <Table head={["When", "SKU", "Change", "Reason", "By"]} minWidth={720}>
            {state.movements.map((m) => (
              <tr key={m.id} className="last:[&>td]:border-0">
                <Td className="whitespace-nowrap text-zup-gray">{m.date}</Td>
                <Td className="font-mono text-[13px] text-zup-gray">{m.sku}</Td>
                <Td
                  className={cn(
                    "font-bold",
                    m.change > 0 ? "text-zup-green" : "text-[#D32F2F]",
                  )}
                >
                  {m.change > 0 ? `+${m.change}` : m.change}
                </Td>
                <Td className="text-zup-mid">{m.reason}</Td>
                <Td className="text-zup-gray">{m.by}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {tab === "suppliers" ? <SuppliersTab readOnly={readOnly} /> : null}
    </div>
  );
}

/* ===== Purchase orders tab ===== */

function PurchaseOrdersTab({
  readOnly,
  onReceive,
}: {
  readOnly: boolean;
  onReceive: (po: PurchaseOrder) => void;
}) {
  const { state, update } = useAdmin();
  const [creating, setCreating] = useState(false);
  const [productId, setProductId] = useState(state.products[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id ?? "");
  const [qty, setQty] = useState(10);

  const product = state.products.find((p) => p.id === productId);

  const create = () => {
    if (!product || !supplierId || qty < 1) {
      toast("Pick a product, supplier and quantity");
      return;
    }
    // value is computed server-side from cost × qty and appears on reload.
    const po: PurchaseOrder = {
      id: `PO-${2200 + state.purchaseOrders.length + 12}`,
      supplierId,
      productId,
      qty,
      value: 0,
      eta: etaLabel(),
      status: "Confirmed",
    };
    update({ purchaseOrders: [po, ...state.purchaseOrders] });
    setCreating(false);
    toast(`${po.id} created`);
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
        <div className="flex justify-end">
          <BtnPrimary onClick={() => setCreating((c) => !c)}>
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> New purchase order
          </BtnPrimary>
        </div>
      ) : null}

      {creating ? (
        <Card className="px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <Field label="Product">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className={selectCls}
              >
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={selectCls}
              >
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qty">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                className={inputCls}
              />
            </Field>
            <div className="flex items-end">
              <BtnPrimary onClick={create}>Create PO</BtnPrimary>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="px-2 py-2">
        <Table head={["PO", "Supplier", "Items", "Value", "ETA", "Status", ""]} minWidth={920}>
          {state.purchaseOrders.map((po) => {
            const product = state.products.find((p) => p.id === po.productId);
            const supplier = state.suppliers.find((s) => s.id === po.supplierId);
            const done = po.status === "Received" || po.status === "Cancelled";
            return (
              <tr key={po.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{po.id}</Td>
                <Td className="text-zup-mid">{supplier?.name ?? "—"}</Td>
                <Td className="text-[13px] text-zup-gray">
                  {product ? `${product.name} × ${po.qty}` : `Unknown item × ${po.qty}`}
                </Td>
                <Td className="whitespace-nowrap font-bold">{taka(po.value)}</Td>
                <Td className="whitespace-nowrap text-zup-gray">{po.eta}</Td>
                <Td>
                  <Pill
                    tone={
                      po.status === "Received"
                        ? "green"
                        : po.status === "Cancelled"
                          ? "gray"
                          : po.status === "In transit"
                            ? "purple"
                            : "blue"
                    }
                  >
                    {po.status}
                  </Pill>
                </Td>
                <Td className="text-right">
                  {!readOnly && !done ? (
                    <span className="flex justify-end gap-2">
                      <BtnPrimary
                        onClick={() => onReceive(po)}
                        className="min-h-8 px-4 text-[13px]"
                      >
                        Receive
                      </BtnPrimary>
                      <ConfirmDialog
                        trigger={<BtnDanger>Cancel</BtnDanger>}
                        title={`Cancel purchase order ${po.id}?`}
                        description="The supplier won't be notified automatically — call them if goods are already in transit."
                        confirmLabel="Cancel order"
                        onConfirm={() => {
                          update({
                            purchaseOrders: state.purchaseOrders.map((x) =>
                              x.id === po.id ? { ...x, status: "Cancelled" } : x,
                            ),
                          });
                          toast(`${po.id} cancelled`);
                        }}
                      />
                    </span>
                  ) : null}
                </Td>
              </tr>
            );
          })}
          {state.purchaseOrders.length === 0 ? (
            <tr>
              <Td colSpan={7} className="py-10 text-center text-zup-soft">
                No purchase orders yet — create one, or hit Reorder on a low-stock row.
              </Td>
            </tr>
          ) : null}
        </Table>
      </Card>
      <p className="text-xs leading-relaxed text-zup-soft">
        Receiving a purchase order adds its quantity to on-hand stock and logs a movement.
      </p>
    </div>
  );
}

/* ===== Suppliers tab ===== */

function SuppliersTab({ readOnly }: { readOnly: boolean }) {
  const { state, update } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", contact: "", phone: "", items: "" });

  const add = () => {
    if (!draft.name.trim()) {
      toast("Supplier name is required");
      return;
    }
    update({
      suppliers: [
        ...state.suppliers,
        { id: `sup${Date.now()}`, ...draft, name: draft.name.trim() },
      ],
    });
    setDraft({ name: "", contact: "", phone: "", items: "" });
    setAdding(false);
    toast(`${draft.name.trim()} added to suppliers`);
  };

  return (
    <div className="flex flex-col gap-4">
      {!readOnly ? (
        <div className="flex justify-end">
          <BtnPrimary onClick={() => setAdding((a) => !a)}>
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add supplier
          </BtnPrimary>
        </div>
      ) : null}

      {adding ? (
        <Card className="px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1.2fr_2fr_auto]">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Supplier name"
              aria-label="Supplier name"
              className={inputCls}
            />
            <input
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
              placeholder="Contact person"
              aria-label="Contact person"
              className={inputCls}
            />
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Phone"
              inputMode="tel"
              aria-label="Phone"
              className={inputCls}
            />
            <input
              value={draft.items}
              onChange={(e) => setDraft({ ...draft, items: e.target.value })}
              placeholder="What they supply"
              aria-label="What they supply"
              className={inputCls}
            />
            <BtnPrimary onClick={add}>Save</BtnPrimary>
          </div>
        </Card>
      ) : null}

      <Card className="px-2 py-2">
        <Table head={["Supplier", "Contact", "Phone", "Supplies", ""]} minWidth={760}>
          {state.suppliers.map((s) => {
            const hasOpenPo = state.purchaseOrders.some(
              (po) =>
                po.supplierId === s.id &&
                (po.status === "Confirmed" || po.status === "In transit"),
            );
            return (
              <tr key={s.id} className="last:[&>td]:border-0">
                <Td className="font-bold">{s.name}</Td>
                <Td className="text-zup-mid">{s.contact}</Td>
                <Td className="whitespace-nowrap text-zup-gray">{s.phone}</Td>
                <Td className="text-zup-gray">{s.items}</Td>
                <Td className="text-right">
                  {!readOnly ? (
                    <ConfirmDialog
                      trigger={
                        <BtnDanger
                          disabled={hasOpenPo}
                          title={hasOpenPo ? "Has open purchase orders" : undefined}
                        >
                          Remove
                        </BtnDanger>
                      }
                      title={`Remove supplier "${s.name}"?`}
                      description="This can't be undone."
                      confirmLabel="Remove"
                      onConfirm={() => {
                        update({ suppliers: state.suppliers.filter((x) => x.id !== s.id) });
                        toast(`${s.name} removed`);
                      }}
                    />
                  ) : null}
                </Td>
              </tr>
            );
          })}
          {state.suppliers.length === 0 ? (
            <tr>
              <Td colSpan={5} className="py-10 text-center text-zup-soft">
                No suppliers yet — add one to start creating purchase orders.
              </Td>
            </tr>
          ) : null}
        </Table>
      </Card>
    </div>
  );
}
