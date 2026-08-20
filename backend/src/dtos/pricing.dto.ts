import { t } from "elysia";
import { cartItemsDto } from "./common";

/** Cart pricing request (cal-bk.md §2.1) — `insideDhaka` is omitted on the
 *  cart page, present at checkout. */
export const quoteDto = t.Object({
  items: cartItemsDto,
  insideDhaka: t.Optional(t.Boolean()),
  /**
   * The campaign this quote is for, when it is for one.
   *
   * A quote has to be able to ask the SAME question the order will ask, and a
   * campaign now selects a price ladder — so without this the campaign form
   * would display catalogue prices and then be charged campaign prices. That
   * mismatch is the bug recorded in campaign-order-form.tsx.
   *
   * Same slug and same 120-char cap as createOrderDto, checked against the
   * published set server-side: an unknown or stale slug quotes at catalogue
   * rates rather than failing, exactly as it orders at catalogue rates.
   */
  landingPageSlug: t.Optional(t.String({ maxLength: 120 })),
});

export type QuoteRequestDto = typeof quoteDto.static;
