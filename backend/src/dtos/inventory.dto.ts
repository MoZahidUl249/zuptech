import { t } from "elysia";

/** Manual stock adjustment — sets on-hand, the delta becomes a StockMovement. */
export const adjustStockDto = t.Object({
  onHand: t.Integer({ minimum: 0 }),
  reason: t.Optional(t.String({ maxLength: 300 })),
});

/** Omit `qty` for one-click reorder; omit `value` to price at qty × cost. */
export const createPurchaseOrderDto = t.Object({
  supplierId: t.String(),
  productId: t.String(),
  qty: t.Optional(t.Integer({ minimum: 1, maximum: 100_000 })),
  value: t.Optional(t.Integer({ minimum: 0 })),
  eta: t.String({ format: "date-time" }),
});

/** Only qty/value/eta are editable — supplier/product are fixed at creation. */
export const updatePurchaseOrderDto = t.Partial(
  t.Object({
    qty: t.Integer({ minimum: 1, maximum: 100_000 }),
    value: t.Integer({ minimum: 0 }),
    eta: t.String({ format: "date-time" }),
  }),
);

const supplierFields = {
  name: t.String({ minLength: 2, maxLength: 200 }),
  contact: t.String({ maxLength: 120 }),
  phone: t.String({ maxLength: 20 }),
  items: t.String({ maxLength: 300 }),
};
export const createSupplierDto = t.Object(supplierFields);
export const updateSupplierDto = t.Partial(t.Object(supplierFields));

export const listMovementsQueryDto = t.Object({
  limit: t.Optional(t.Integer({ minimum: 1 })),
});

export type AdjustStockDto = typeof adjustStockDto.static;
export type CreatePurchaseOrderDto = typeof createPurchaseOrderDto.static;
export type UpdatePurchaseOrderDto = typeof updatePurchaseOrderDto.static;
export type CreateSupplierDto = typeof createSupplierDto.static;
export type UpdateSupplierDto = typeof updateSupplierDto.static;
export type ListMovementsQueryDto = typeof listMovementsQueryDto.static;
