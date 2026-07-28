"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useAdmin, type AdminCategory } from "@/lib/admin";
import {
  MAX_SVG_LOGO_BYTES,
  createCategory,
  createSection,
  deleteCategory,
  deleteSection,
  patchCategory,
  patchSection,
  reloaders,
  setCategoryLogo,
} from "@/lib/admin-api";
import { Card, Field, BtnPrimary, BtnGhost, inputCls, selectCls } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Catalog taxonomy editor — Section → Category, plus each category's SVG
 * logo. Rides the `products` permission module, same as the backend routes.
 *
 * Not wired into the AdminState diff-sync engine: these are per-item CRUD
 * endpoints (a category's logo is written against its row id), and deletes
 * can legitimately 409 while products still point at the row. Each action
 * therefore calls the API directly and refreshes the taxonomy slice, so a
 * refused delete surfaces its reason instead of being silently retried on
 * every later save.
 */
export function TaxonomySection() {
  const { state, update, can } = useAdmin();
  const readOnly = can("products") !== "manage";

  const [newSection, setNewSection] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategorySection, setNewCategorySection] = useState("");
  const [logoFor, setLogoFor] = useState<AdminCategory | null>(null);
  const [busy, setBusy] = useState(false);

  /** Re-read both taxonomy collections after any mutation. Products carry
   *  resolved category/section names, so they are refreshed too — a rename
   *  would otherwise leave stale labels in the products table. */
  const refresh = async () => {
    const [sections, categories, products] = await Promise.all([
      reloaders.sections(),
      reloaders.categories(),
      reloaders.products(),
    ]);
    update({ sections, categories, products });
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(ok);
    } catch (err) {
      // 409s arrive here with the backend's explanation ("… still has N
      // products"), which is the actionable part.
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const disabled = readOnly || busy;

  return (
    <div className="flex flex-col gap-5">
      <Card className="px-5 py-5 sm:px-6">
        <h2 className="text-ui-base font-bold">Catalog structure</h2>
        <p className="mt-0.5 max-w-prose text-ui-sm text-zup-gray">
          Every product belongs to exactly one category, and reaches its
          section through it. A category can only be deleted once nothing
          points at it.
        </p>

        {!readOnly ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="New section" className="min-w-[200px]">
              <input
                value={newSection}
                disabled={busy}
                placeholder="e.g. Commercial"
                onChange={(e) => setNewSection(e.target.value)}
                className={inputCls}
              />
            </Field>
            <BtnPrimary
              disabled={disabled || !newSection.trim()}
              onClick={() =>
                void run(
                  () =>
                    createSection({
                      name: newSection.trim(),
                      // Append: existing sections keep their positions.
                      sort: state.sections.length,
                    }),
                  "Section created",
                ).then(() => setNewSection(""))
              }
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add section
            </BtnPrimary>
          </div>
        ) : null}
      </Card>

      {state.sections.map((section) => (
        <Card key={section.id} className="px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <InlineName
              value={section.name}
              readOnly={disabled}
              label={`Section ${section.name}`}
              className="text-ui-base font-bold"
              onSave={(name) => run(() => patchSection(section.id, { name }), "Section renamed")}
            />
            {readOnly ? null : (
              <ConfirmDialog
                title="Delete section?"
                description={`"${section.name}" can only be deleted once it has no categories.`}
                confirmLabel="Delete"
                onConfirm={() =>
                  void run(() => deleteSection(section.id), "Section deleted")
                }
                trigger={
                  <BtnGhost aria-label={`Delete section ${section.name}`} disabled={disabled}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
                  </BtnGhost>
                }
              />
            )}
          </div>

          {section.categories.length === 0 ? (
            <p className="mt-3 text-ui-sm text-zup-soft">No categories in this section.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {section.categories.map((cat) => {
                const productCount = state.products.filter(
                  (p) => p.categoryId === cat.id,
                ).length;
                return (
                  <li
                    key={cat.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-zup-body/8 px-3.5 py-2.5"
                  >
                    <LogoPreview svg={cat.svgLogo} name={cat.name} />
                    <span className="min-w-0 flex-1">
                      <InlineName
                        value={cat.name}
                        readOnly={disabled}
                        label={`Category ${cat.name}`}
                        className="text-ui-base font-bold"
                        onSave={(name) =>
                          run(() => patchCategory(cat.id, { name }), "Category renamed")
                        }
                      />
                      <span className="mt-0.5 block text-ui-micro text-zup-soft">
                        {productCount} product{productCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    {readOnly ? null : (
                      <span className="flex items-center gap-1">
                        <BtnGhost
                          aria-label={`Edit logo for ${cat.name}`}
                          disabled={disabled}
                          onClick={() => setLogoFor(cat)}
                        >
                          Logo
                        </BtnGhost>
                        <ConfirmDialog
                          title="Delete category?"
                          description={
                            productCount > 0
                              ? `"${cat.name}" still has ${productCount} product${productCount === 1 ? "" : "s"}. Move them first — the delete will be refused.`
                              : `"${cat.name}" will be removed.`
                          }
                          confirmLabel="Delete"
                          onConfirm={() =>
                            void run(() => deleteCategory(cat.id), "Category deleted")
                          }
                          trigger={
                            <BtnGhost
                              aria-label={`Delete category ${cat.name}`}
                              disabled={disabled}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
                            </BtnGhost>
                          }
                        />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ))}

      {!readOnly && state.sections.length > 0 ? (
        <Card className="px-5 py-5 sm:px-6">
          <h3 className="text-ui-base font-bold">Add a category</h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="Name" className="min-w-[200px]">
              <input
                value={newCategory}
                disabled={busy}
                placeholder="e.g. Switchgear"
                onChange={(e) => setNewCategory(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Section" className="min-w-[180px]">
              <select
                value={newCategorySection || state.sections[0]?.id || ""}
                disabled={busy}
                onChange={(e) => setNewCategorySection(e.target.value)}
                className={selectCls}
              >
                {state.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <BtnPrimary
              disabled={disabled || !newCategory.trim()}
              onClick={() => {
                const sectionId = newCategorySection || state.sections[0]?.id;
                if (!sectionId) return;
                const target = state.sections.find((s) => s.id === sectionId);
                void run(
                  () =>
                    createCategory({
                      name: newCategory.trim(),
                      sectionId,
                      sort: target?.categories.length ?? 0,
                    }),
                  "Category created",
                ).then(() => setNewCategory(""));
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Add category
            </BtnPrimary>
          </div>
          <p className="mt-2 text-ui-xs text-zup-soft">
            Category names are globally unique — that is what lets a product
            reach its section in one hop.
          </p>
        </Card>
      ) : null}

      {logoFor ? (
        <LogoEditor
          category={logoFor}
          busy={busy}
          onClose={() => setLogoFor(null)}
          onSave={(svg) =>
            run(() => setCategoryLogo(logoFor.id, svg), "Logo saved").then(() =>
              setLogoFor(null),
            )
          }
        />
      ) : null}
    </div>
  );
}

/** Renders the stored markup. Safe by construction: the backend runs
 *  `sanitizeSvgLogo` on write and rejects anything active, so what is on the
 *  row is already an inert allow-listed subset. */
function LogoPreview({ svg, name }: { svg: string; name: string }) {
  if (!svg) {
    return (
      <span
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-zup-body/6 text-ui-micro font-bold text-zup-faint"
        aria-hidden
      >
        —
      </span>
    );
  }
  return (
    <span
      className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-zup-body/4 [&>svg]:h-6 [&>svg]:w-6"
      role="img"
      aria-label={`${name} logo`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function LogoEditor({
  category,
  busy,
  onClose,
  onSave,
}: {
  category: AdminCategory;
  busy: boolean;
  onClose: () => void;
  onSave: (svg: string) => void;
}) {
  const [svg, setSvg] = useState(category.svgLogo);
  const bytes = new Blob([svg]).size;
  const tooBig = bytes > MAX_SVG_LOGO_BYTES;
  // Cheap client-side sanity check only — the backend's sanitizer is the
  // real gate, and it rejects far more than this.
  const looksLikeSvg = svg.trim() === "" || /^<svg[\s>]/i.test(svg.trim());

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-ui-base font-bold">Logo — {category.name}</h3>
        <BtnGhost aria-label="Close logo editor" onClick={onClose}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </BtnGhost>
      </div>
      <p className="mt-1 max-w-prose text-ui-xs text-zup-gray">
        Paste SVG <b>markup</b>, not a URL or a file — the storefront renders
        it inline. Scripts, external references and embedded HTML are rejected
        on save. Empty clears the logo.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <textarea
          value={svg}
          disabled={busy}
          onChange={(e) => setSvg(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={'<svg viewBox="0 0 24 24">…</svg>'}
          className={`${inputCls} min-w-[280px] flex-1 resize-y font-mono text-ui-xs`}
        />
        <div className="flex flex-col items-center gap-2">
          <span className="text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
            Preview
          </span>
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-zup-body/10 bg-white">
            {looksLikeSvg && svg.trim() ? (
              <span
                className="[&>svg]:h-12 [&>svg]:w-12"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <span className="text-ui-micro text-zup-faint">none</span>
            )}
          </div>
        </div>
      </div>

      {tooBig ? (
        <p className="mt-2 text-ui-xs font-semibold text-destructive">
          {(bytes / 1024).toFixed(1)} KB — the limit is {MAX_SVG_LOGO_BYTES / 1024} KB.
          Simplify the paths or export at a smaller precision.
        </p>
      ) : null}
      {!looksLikeSvg ? (
        <p className="mt-2 text-ui-xs font-semibold text-warn-fg">
          This doesn&apos;t start with &lt;svg — paste the markup itself.
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <BtnPrimary disabled={busy || tooBig || !looksLikeSvg} onClick={() => onSave(svg)}>
          <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden /> Save logo
        </BtnPrimary>
        {category.svgLogo ? (
          <BtnGhost disabled={busy} onClick={() => onSave("")}>
            Clear
          </BtnGhost>
        ) : null}
      </div>
    </Card>
  );
}

/** Click-to-edit text. Keeps rename inline instead of opening a dialog for a
 *  one-field change. */
function InlineName({
  value,
  label,
  className,
  readOnly,
  onSave,
}: {
  value: string;
  label: string;
  className?: string;
  readOnly?: boolean;
  onSave: (name: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span className="flex items-center gap-1.5">
        <span className={className}>{value}</span>
        {readOnly ? null : (
          <button
            type="button"
            aria-label={`Rename ${label}`}
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="text-zup-faint transition-colors hover:text-zup-gray"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </span>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) void onSave(draft.trim());
  };

  return (
    <span className="flex items-center gap-1.5">
      <input
        value={draft}
        autoFocus
        aria-label={`Rename ${label}`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
        className={`${inputCls} max-w-[220px]`}
      />
    </span>
  );
}
