"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  taka,
  type AdminProduct,
} from "@/lib/admin";
import {
  Td,
  Pill,
  BtnGhost,
  BtnDanger,
} from "../ui";
import { ConfirmDialog } from "../confirm-dialog";
import { ProductEditor } from "./product-editor";

export function ProductRow({
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
              <Pill tone="blue" className="w-fit px-2 py-0.5 text-ui-micro">
                {p.category}
              </Pill>
              <span className="text-ui-micro text-zup-soft">{p.section}</span>
            </span>
          ) : (
            <span className="text-zup-faint">—</span>
          )}
        </Td>
        <Td className="whitespace-nowrap font-bold">{taka(p.price)}</Td>
        <Td className="max-w-[190px]">
          <OfferSummary product={p} />
        </Td>
        <Td
          className={cn(
            "font-bold",
            p.stock === 0
              ? "text-destructive"
              : p.stock <= p.reorderAt
                ? "text-warn-fg"
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
                featured ? "fill-star text-star" : "text-zup-faint",
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
          <Td colSpan={8} className="bg-surface-sunken">
            <ProductEditor product={p} onChange={onChange} onDone={onDone} />
          </Td>
        </tr>
      ) : null}
    </>
  );
}

/** At-a-glance offer ladder for the table — every promotion this product
 *  carries, in the order the customer unlocks them. */
export function OfferSummary({ product: p }: { product: AdminProduct }) {
  const qty = [...p.quantityOffers].sort((a, b) => a.minQty - b.minQty);
  const delivery = [...p.freeDeliveryOffers].sort((a, b) => a.minQty - b.minQty);
  const onSale = p.onSale && p.salePercentage > 0;

  if (!onSale && qty.length === 0 && delivery.length === 0) {
    return <span className="text-zup-faint">—</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {onSale ? (
        <Pill tone="amber" className="px-2 py-0.5 text-ui-micro">
          −{p.salePercentage}% sale
        </Pill>
      ) : null}
      {qty.map((o) => (
        <Pill key={`q${o.minQty}`} tone="blue" className="px-2 py-0.5 text-ui-micro">
          {o.minQty}+ · {o.percentage}%
        </Pill>
      ))}
      {delivery.map((o) => (
        <Pill key={`d${o.minQty}`} tone="green" className="px-2 py-0.5 text-ui-micro">
          {o.minQty}+ · {o.percentage === 100 ? "free del." : `del. ${o.percentage}%`}
        </Pill>
      ))}
    </span>
  );
}

/** Max upload accepted by POST /admin/api/products/:id/photos (see products.dto.ts). */
