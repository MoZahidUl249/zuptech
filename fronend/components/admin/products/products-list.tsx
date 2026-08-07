"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { slugify } from "@/lib/utils";
import { useAdmin, type AdminProduct } from "@/lib/admin";
import { createProduct, uploadProductPhoto } from "@/lib/admin-api";
import {
  Card,
  Table,
  Td,
  BtnPrimary,
  BtnGhost,
  inputCls,
  selectCls,
} from "../ui";
import { ProductEditor } from "./product-editor";
import { ProductRow } from "./product-row";
import { emptyDraftProduct } from "./empty-product";

/* ===== Products (catalog CRUD) ===== */


const NO_CATEGORY_FILTER = "All categories";

export function ProductsSection() {
  const { state, update, adopt, can } = useAdmin();
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
  // Photos chosen before the product exists; uploaded by submitDraft().
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

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

  /**
   * Add a product in one action.
   *
   * Server-first (Rule C in lib/admin.tsx), not staged: the photo endpoints
   * attach to a product that already exists, so the id has to be real before
   * they can run. Adding used to be four actions across two visits — open the
   * form, submit a draft, press the global Save, then reopen the row to attach
   * pictures — because the gallery was dead for the whole life of the form.
   */
  const submitDraft = async () => {
    if (!draft.name.trim()) {
      setDraftError("Product name is required");
      return;
    }
    if (!draft.categoryId) {
      setDraftError("Pick a category — the catalog requires one");
      return;
    }
    setDraftError(null);
    setCreating(true);

    const body: AdminProduct = {
      ...draft,
      name: draft.name.trim(),
      slug: draft.slug.trim() || slugify(draft.name, "product"),
    };

    let created: AdminProduct;
    try {
      created = await createProduct(body);
    } catch (err) {
      // Keep the draft: a slug or SKU clash is the likely failure and retyping
      // the whole form to fix one field would be its own small cruelty.
      setDraftError(
        err instanceof Error ? err.message : "Couldn't create that product",
      );
      setCreating(false);
      return;
    }

    let finished = created;
    let photoFailure: string | null = null;
    for (const file of pendingPhotos) {
      try {
        finished = await uploadProductPhoto(created.id, file);
      } catch (err) {
        photoFailure = err instanceof Error ? err.message : "a photo failed to upload";
        break;
      }
    }

    // adopt(), not update(): the server already has this row, and staging it
    // would make the next Save create it a second time.
    adopt({ products: [finished, ...state.products] });
    setAdding(false);
    setDraft(emptyDraftProduct());
    setPendingPhotos([]);
    setCreating(false);

    // The product exists either way — say which half went wrong rather than
    // implying the whole thing failed.
    toast(
      photoFailure
        ? `${finished.name} was created, but ${photoFailure}. Open it to add the photos.`
        : `${finished.name} added`,
    );
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
          <p className="text-ui-sm font-semibold text-zup-soft">
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
          <p className="mb-3 text-ui-sm font-bold uppercase tracking-[0.06em] text-zup-soft">
            New product
          </p>
          {draftError ? (
            <p
              role="alert"
              className="mb-3 rounded-xl bg-destructive/8 px-3.5 py-2.5 text-ui-sm font-semibold text-destructive"
            >
              {draftError}
            </p>
          ) : null}
          <ProductEditor
            product={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onDone={() => void submitDraft()}
            submitLabel="Add product"
            pendingPhotos={pendingPhotos}
            onPickPhoto={(file) => setPendingPhotos((prev) => [...prev, file])}
            onDropPendingPhoto={(i) => setPendingPhotos((prev) => prev.filter((_, j) => j !== i))}
            busy={creating}
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
          head={["Product", "Category", "Price", "Offers", "Stock", "Featured", "Visibility", ""]}
          minWidth={1000}
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
              <Td colSpan={8} className="py-10 text-center text-zup-soft">
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
