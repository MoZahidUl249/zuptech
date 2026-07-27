import type { Customer } from "../generated/client";
import { auth } from "./auth";
import { prisma } from "./db";

/**
 * Resolves the signed-in customer (if any) from the request's session
 * cookie. Phone is the login identity, so this is just session -> phone ->
 * Customer row; shared by every route that needs "who is this customer".
 */
export async function getSignedInCustomer(headers: Headers): Promise<Customer | null> {
  const session = await auth.api.getSession({ headers });
  const phone = session?.user.phoneNumber;
  if (!phone) return null;
  return prisma.customer.findUnique({ where: { phone } });
}
