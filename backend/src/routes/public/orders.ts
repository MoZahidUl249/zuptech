import { Elysia } from "elysia";
import { updateProfileDto } from "../../dtos/customer.dto";
import { createOrderDto } from "../../dtos/orders.dto";
import { getSignedInCustomer } from "../../lib/customer-session";
import { prisma } from "../../lib/db";
import { ApiError, badRequest, unauthorized } from "../../lib/http";
import { nextId } from "../../lib/ids";
import { logOrderEvent } from "../../lib/order-events";
import { orderSummary, priceCart } from "../../lib/pricing";
import { allowHit } from "../../lib/rate-limit";
import { isValidPhone, normalizePhone } from "../../lib/rules";
import { toCheckoutOrder, toCustomerProfile, toOrder } from "../../lib/serialize";

/**
 * Guest checkout + the signed-in customer's order history.
 *
 * Totals are ALWAYS recomputed server-side from catalog prices — the client's
 * numbers are never trusted (BACKEND.md §6). Placing an order reserves stock
 * (`reserved` += qty); physical stock only moves when the order is delivered.
 */
export const publicOrders = new Elysia({ name: "routes/public/orders", detail: { tags: ["Checkout"] } })
  .post(
    "/api/orders",
    async ({ body, set, request, server }) => {
      const phone = normalizePhone(body.phone);
      if (!isValidPhone(phone)) throw badRequest("Phone must match 01XXXXXXXXX");
      if (body.address.trim().length <= 3) throw badRequest("Address is too short");

      // Direct-API abuse guard (cal-bk.md §3) — checkout is a human action.
      const ip = server?.requestIP(request)?.address ?? "unknown";
      if (!allowHit(`order-ip:${ip}`, 20, 5 * 60_000) || !allowHit(`order:${phone}`, 10, 5 * 60_000)) {
        throw new ApiError(429, "Too many orders — try again in a few minutes");
      }

      // All money comes from the pricing engine: catalog prices at order
      // time, stock enforced, unknown/hidden products rejected.
      const cart = await priceCart(body.items, body.insideDhaka, { enforceStock: true });
      const { subtotal, deliveryFee, installationFee, total, insideDhaka } = cart;
      if (insideDhaka === null || deliveryFee === null || installationFee === null || total === null) {
        throw badRequest("Unknown delivery zone"); // unreachable — insideDhaka is required
      }

      // Checkout must use an enabled payment method (§4.11).
      const method = await prisma.paymentMethod.findFirst({
        where: { name: body.pay, enabled: true },
      });
      if (!method) throw badRequest(`Payment method "${body.pay}" is not available`);

      const zoneLabel = insideDhaka ? "Inside Dhaka" : "Outside Dhaka";

      const order = await prisma.$transaction(async (tx) => {
        // Accounts auto-create on first purchase — phone is the identity.
        // Saving address/zone here means the next checkout (or GET /api/me)
        // can prefill from what this customer used last time.
        //
        // `update: {}` is deliberate: an existing customer's saved profile is
        // NEVER overwritten by an unauthenticated guest checkout — anyone can
        // type a known phone number at checkout, and there is no proof they
        // own it. A signed-in customer edits their own profile via
        // PATCH /api/me instead.
        const customer = await tx.customer.upsert({
          where: { phone },
          create: { phone, name: body.name.trim(), address: body.address.trim(), insideDhaka },
          update: {},
        });

        const { id, number } = await nextId(tx, "order");

        const created = await tx.order.create({
          data: {
            id,
            number,
            customerId: customer.id,
            name: body.name.trim(),
            phone,
            // Stored as "free text + delivery zone" so ops sees where it ships.
            address: `${body.address.trim()}, ${zoneLabel}`,
            insideDhaka,
            subtotal,
            deliveryFee,
            installationFee,
            total,
            pay: method.name,
            status: "Processing",
            items: {
              create: cart.lines.map((line) => ({
                productId: line.product.id,
                qty: line.qty,
                unitPrice: line.unitPrice,
                deliveryFee: line.deliveryFee ?? 0,
                installationFee: line.installationFee ?? 0,
              })),
            },
          },
          include: { items: true },
        });

        // Reserve the units for this order.
        for (const line of cart.lines) {
          await tx.product.update({
            where: { id: line.product.id },
            data: { reserved: { increment: line.qty } },
          });
        }

        // Open the audit trail the admin panel reads, so every order's history
        // starts at checkout rather than at whoever touched it first.
        await logOrderEvent(
          tx,
          created.id,
          "placed",
          `Order placed on the storefront · ${method.name}`,
          null,
        );

        return created;
      });

      set.status = 201;
      return toCheckoutOrder(order, orderSummary(cart.lines));
    },
    { body: createOrderDto },
  )

  /** Orders belonging to the signed-in customer (phone/password session). */
  .get("/api/my/orders", async ({ request }) => {
    const customer = await getSignedInCustomer(request.headers);
    if (!customer) throw unauthorized("Sign in with your phone number first");

    const orders = await prisma.order.findMany({
      where: { phone: customer.phone },
      include: { items: true },
      orderBy: { number: "desc" },
    });
    return orders.map(toOrder);
  })

  /** Who am I? Lets the account page prefill name/phone/address at checkout. */
  .get("/api/me", async ({ request }) => {
    const customer = await getSignedInCustomer(request.headers);
    return { customer: customer && toCustomerProfile(customer) };
  })

  /** Edit the signed-in customer's saved profile directly (not via an order). */
  .patch(
    "/api/me",
    async ({ body, request }) => {
      const customer = await getSignedInCustomer(request.headers);
      if (!customer) throw unauthorized("Sign in required");

      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          ...(body.name !== undefined && { name: body.name.trim() }),
          ...(body.address !== undefined && { address: body.address.trim() }),
          ...(body.insideDhaka !== undefined && { insideDhaka: body.insideDhaka }),
        },
      });
      return { customer: toCustomerProfile(updated) };
    },
    { body: updateProfileDto },
  );
