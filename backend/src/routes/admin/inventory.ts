import { Elysia } from "elysia";
import {
  adjustStockDto,
  createPurchaseOrderDto,
  createSupplierDto,
  listMovementsQueryDto,
  updatePurchaseOrderDto,
  updateSupplierDto,
} from "../../dtos/inventory.dto";
import { Prisma } from "../../generated/client";
import { prisma } from "../../lib/db";
import { badRequest, conflict, notFound } from "../../lib/http";
import { nextId } from "../../lib/ids";
import { assertCan } from "../../lib/rbac";
import { reorderQty } from "../../lib/rules";
import { toMovement, toPurchaseOrder, toSupplier } from "../../lib/serialize";
import { staffGuard } from "./guard";

/** Statuses that still expect goods — they block supplier deletion. */
const OPEN_PO_STATUSES = ["Confirmed", "In transit"];

export const adminInventory = new Elysia({ name: "routes/admin/inventory", detail: { tags: ["Admin · Inventory"] } })
  .use(staffGuard)

  /* ===== Manual stock adjustment ===== */

  /** Set on-hand stock; the delta is logged as a StockMovement (§4.6). */
  .patch(
    "/admin/api/stock/:productId",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "inventory", "manage");

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: params.productId } });
        if (!product) throw notFound("Product");

        const change = body.onHand - product.stock;
        if (change !== 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              sku: product.sku,
              change,
              reason: body.reason?.trim() || "Manual stock adjustment",
              by: staffCtx.staff.username,
            },
          });
        }
        return tx.product.update({
          where: { id: product.id },
          data: { stock: body.onHand },
        });
      });

      return { id: result.id, stock: result.stock, reserved: result.reserved };
    },
    { body: adjustStockDto },
  )

  /* ===== Purchase orders ===== */

  .get("/admin/api/purchase-orders", async ({ staffCtx }) => {
    assertCan(staffCtx, "inventory", "view");
    const pos = await prisma.purchaseOrder.findMany({ orderBy: { number: "desc" } });
    return pos.map(toPurchaseOrder);
  })

  /**
   * Create a PO. Omit `qty` for the one-click "Reorder" action — the server
   * applies qty = max(reorderAt×2 − stock, reorderAt). Omit `value` to price
   * at qty × product cost.
   */
  .post(
    "/admin/api/purchase-orders",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "inventory", "manage");

      const [supplier, product] = await Promise.all([
        prisma.supplier.findUnique({ where: { id: body.supplierId } }),
        prisma.product.findUnique({ where: { id: body.productId } }),
      ]);
      if (!supplier) throw notFound("Supplier");
      if (!product) throw notFound("Product");

      const qty = body.qty ?? reorderQty(product);
      if (qty < 1) throw badRequest("Quantity must be at least 1");

      const po = await prisma.$transaction(async (tx) => {
        const { id, number } = await nextId(tx, "po");
        return tx.purchaseOrder.create({
          data: {
            id,
            number,
            supplierId: supplier.id,
            productId: product.id,
            qty,
            value: body.value ?? qty * product.cost,
            eta: new Date(body.eta),
            status: "Confirmed",
          },
        });
      });

      set.status = 201;
      return toPurchaseOrder(po);
    },
    { body: createPurchaseOrderDto },
  )

  /** Receive: stock += qty, movement logged, status → Received (§4.5). */
  .post("/admin/api/purchase-orders/:id/receive", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "inventory", "manage");

    let po;
    try {
      po = await prisma.$transaction(async (tx) => {
        const existing = await tx.purchaseOrder.findUnique({
          where: { id: params.id },
          include: { product: true },
        });
        if (!existing) throw notFound("Purchase order");
        if (existing.status === "Received") throw conflict(`${existing.id} was already received`);
        if (existing.status === "Cancelled") throw conflict(`${existing.id} is cancelled`);

        await tx.product.update({
          where: { id: existing.productId },
          data: { stock: { increment: existing.qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId: existing.productId,
            sku: existing.product.sku,
            change: existing.qty,
            reason: `${existing.id} received`,
            by: staffCtx.staff.username,
          },
        });
        // Optimistic concurrency guard: matches only if `status` is still
        // what we just read — see the identical pattern (and rationale) on
        // PATCH /admin/api/orders/:id. Prevents a double-receive (e.g. two
        // clicks) from crediting stock twice.
        return tx.purchaseOrder.update({
          where: { id: existing.id, status: existing.status },
          data: { status: "Received" },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw conflict(`${params.id} was already received or cancelled`);
      }
      throw err;
    }

    return toPurchaseOrder(po);
  })

  .post("/admin/api/purchase-orders/:id/cancel", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "inventory", "manage");

    const existing = await prisma.purchaseOrder.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Purchase order");
    if (existing.status === "Received") throw conflict("Received POs can't be cancelled");

    const po = await prisma.purchaseOrder.update({
      where: { id: params.id },
      data: { status: "Cancelled" },
    });
    return toPurchaseOrder(po);
  })

  /** Edit qty/value/eta — supplier/product are fixed once created. */
  .patch(
    "/admin/api/purchase-orders/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "inventory", "manage");

      const existing = await prisma.purchaseOrder.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Purchase order");
      if (existing.status === "Received") throw conflict("Received POs can't be edited");

      const { eta, ...rest } = body;
      const po = await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: { ...rest, ...(eta ? { eta: new Date(eta) } : {}) },
      });
      return toPurchaseOrder(po);
    },
    { body: updatePurchaseOrderDto },
  )

  /** Received POs are inventory history — cancel a mistaken one instead. */
  .delete("/admin/api/purchase-orders/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "inventory", "manage");

    const existing = await prisma.purchaseOrder.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Purchase order");
    if (existing.status === "Received") {
      throw conflict("Received POs can't be deleted — they're inventory history");
    }

    await prisma.purchaseOrder.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /* ===== Suppliers ===== */

  .get("/admin/api/suppliers", async ({ staffCtx }) => {
    assertCan(staffCtx, "inventory", "view");
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    return suppliers.map(toSupplier);
  })

  .post(
    "/admin/api/suppliers",
    async ({ body, staffCtx, set }) => {
      assertCan(staffCtx, "inventory", "manage");
      const supplier = await prisma.supplier.create({ data: body });
      set.status = 201;
      return toSupplier(supplier);
    },
    { body: createSupplierDto },
  )

  .patch(
    "/admin/api/suppliers/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "inventory", "manage");
      const existing = await prisma.supplier.findUnique({ where: { id: params.id } });
      if (!existing) throw notFound("Supplier");
      const supplier = await prisma.supplier.update({ where: { id: params.id }, data: body });
      return toSupplier(supplier);
    },
    { body: updateSupplierDto },
  )

  /** Suppliers with open POs can't be deleted — receive or cancel them first. */
  .delete("/admin/api/suppliers/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "inventory", "manage");

    const openCount = await prisma.purchaseOrder.count({
      where: { supplierId: params.id, status: { in: OPEN_PO_STATUSES } },
    });
    if (openCount > 0) {
      throw conflict(`Supplier has ${openCount} open purchase order(s) — close them first`);
    }

    const existing = await prisma.supplier.findUnique({ where: { id: params.id } });
    if (!existing) throw notFound("Supplier");

    await prisma.supplier.delete({ where: { id: params.id } });
    return { ok: true };
  })

  /* ===== Movements (audit trail) ===== */

  .get(
    "/admin/api/movements",
    async ({ query, staffCtx }) => {
      assertCan(staffCtx, "inventory", "view");
      const movements = await prisma.stockMovement.findMany({
        orderBy: { date: "desc" },
        take: Math.min(query.limit ?? 100, 500),
      });
      return movements.map(toMovement);
    },
    { query: listMovementsQueryDto },
  );
