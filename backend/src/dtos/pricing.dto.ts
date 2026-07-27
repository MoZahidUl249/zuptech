import { t } from "elysia";
import { cartItemsDto } from "./common";

/** Cart pricing request (cal-bk.md §2.1) — `insideDhaka` is omitted on the
 *  cart page, present at checkout. */
export const quoteDto = t.Object({
  items: cartItemsDto,
  insideDhaka: t.Optional(t.Boolean()),
});

export type QuoteRequestDto = typeof quoteDto.static;
