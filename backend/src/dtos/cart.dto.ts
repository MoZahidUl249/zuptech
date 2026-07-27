import { t } from "elysia";
import { savedCartItemsDto } from "./common";

/** Replace the signed-in customer's saved cart. */
export const updateCartDto = t.Object({ items: savedCartItemsDto });

export type UpdateCartDto = typeof updateCartDto.static;
