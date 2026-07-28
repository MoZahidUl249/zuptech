import { Elysia } from "elysia";
import { quoteDto } from "../../dtos/pricing.dto";
import { ApiError } from "../../lib/http";
import { priceCart } from "../../lib/pricing";
import { allowHit, clientIp } from "../../lib/rate-limit";
import { toQuote } from "../../lib/serialize";

/**
 * POST /api/pricing/quote — price a cart for display (cal-bk.md §2.1). The
 * cart page calls it without `insideDhaka` (deliveryFee/installationFee/total
 * come back null), checkout step 3 with the chosen delivery zone.
 * Display-only: stock is not enforced here, only at order time.
 */
export const publicPricing = new Elysia({ name: "routes/public/pricing", detail: { tags: ["Checkout"] } }).post(
  "/api/pricing/quote",
  async ({ body, request, server }) => {
    const ip = clientIp(request, server);
    if (!allowHit(`quote-ip:${ip}`, 60, 60_000)) {
      throw new ApiError(429, "Too many requests — try again shortly");
    }

    return toQuote(await priceCart(body.items, body.insideDhaka));
  },
  { body: quoteDto },
);
