import { Elysia } from "elysia";
import { updateCartDto } from "../../dtos/cart.dto";
import { getSignedInCustomer } from "../../lib/customer-session";
import { prisma } from "../../lib/db";
import { unauthorized } from "../../lib/http";
import { toCart } from "../../lib/serialize";

/**
 * A signed-in customer's cart, synced server-side so it survives across
 * devices/browsers (the storefront otherwise only keeps it in
 * localStorage). Raw id+qty lines only — money is always recomputed live
 * via /api/pricing/quote, never stored here.
 */
export const publicCart = new Elysia({ name: "routes/public/cart", detail: { tags: ["Customer cart"] } })
  .get("/api/cart", async ({ request }) => {
    const customer = await getSignedInCustomer(request.headers);
    if (!customer) throw unauthorized("Sign in to sync your cart");

    const cart = await prisma.cart.findUnique({ where: { customerId: customer.id } });
    return toCart(cart);
  })

  .put(
    "/api/cart",
    async ({ body, request }) => {
      const customer = await getSignedInCustomer(request.headers);
      if (!customer) throw unauthorized("Sign in to sync your cart");

      const cart = await prisma.cart.upsert({
        where: { customerId: customer.id },
        create: { customerId: customer.id, items: body.items },
        update: { items: body.items },
      });
      return toCart(cart);
    },
    { body: updateCartDto },
  );
