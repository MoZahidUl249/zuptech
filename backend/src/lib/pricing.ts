import type { Product, QuantityOffer } from "../generated/client";
import { badRequest } from "./http";
import { prisma } from "./db";
import {
  availableStock,
  effectiveUnitPrice,
  isDeliveryFree,
  orderableProductWhere,
} from "./rules";

/**
 * Server-side pricing engine (cal-bk.md §2) — the only place cart money is
 * computed. Clients send ids + quantities; unit prices are re-read from the
 * catalog at call time (never from the client, never from a cached quote), so
 * price tampering and stale-price replay are structurally impossible.
 */

export interface PricedLine {
  product: Product & { quantityOffers: QuantityOffer[] };
  qty: number;
  unitPrice: number;
  lineTotal: number;
  deliveryFee: number | null; // per unit, zone-specific; null until insideDhaka is known
  installationFee: number | null; // per unit, zone-specific; null until insideDhaka is known
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  insideDhaka: boolean | null; // null until the delivery zone is known
  deliveryFee: number | null; // Σ line.deliveryFee × qty; null until insideDhaka is known
  installationFee: number | null; // Σ line.installationFee × qty; null until insideDhaka is known
  total: number | null; // subtotal + deliveryFee + installationFee
}

/**
 * Price a validated cart. Products that are neither on the storefront nor on
 * a published landing page are indistinguishable from unknown ones (both
 * 400) — see orderableProductWhere(). `enforceStock` is on for real orders,
 * off for display quotes so a cart can still show prices while stock shifts.
 */
export async function priceCart(
  items: { productId: string; qty: number }[],
  insideDhaka: boolean | undefined,
  { enforceStock = false } = {},
): Promise<PricedCart> {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, ...orderableProductWhere() },
    include: { quantityOffers: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = items.map(({ productId, qty }) => {
    const product = byId.get(productId);
    if (!product) throw badRequest(`Unknown product: ${productId}`);
    if (enforceStock) {
      const available = availableStock(product);
      if (qty > available) throw badRequest(`Only ${available} of "${product.name}" in stock`);
    }
    const unitPrice = effectiveUnitPrice(product, qty, product.quantityOffers);
    return {
      product,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
      deliveryFee:
        insideDhaka === undefined
          ? null
          : isDeliveryFree(product, qty)
            ? 0
            : insideDhaka
              ? product.deliveryFeeInsideDhaka
              : product.deliveryFeeOutsideDhaka,
      installationFee:
        insideDhaka === undefined
          ? null
          : insideDhaka
            ? product.installationFeeInsideDhaka
            : product.installationFeeOutsideDhaka,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  if (insideDhaka === undefined) {
    return {
      lines,
      subtotal,
      insideDhaka: null,
      deliveryFee: null,
      installationFee: null,
      total: null,
    };
  }

  const deliveryFee = lines.reduce((sum, line) => sum + (line.deliveryFee ?? 0) * line.qty, 0);
  const installationFee = lines.reduce((sum, line) => sum + (line.installationFee ?? 0) * line.qty, 0);

  return {
    lines,
    subtotal,
    insideDhaka,
    deliveryFee,
    installationFee,
    total: subtotal + deliveryFee + installationFee,
  };
}

/** Human-readable order summary, e.g. "1000VA IPS + Battery Combo ×1". */
export function orderSummary(lines: PricedLine[]): string {
  return lines.map((line) => `${line.product.name} ×${line.qty}`).join(", ");
}
