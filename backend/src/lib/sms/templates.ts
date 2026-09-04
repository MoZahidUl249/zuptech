/**
 * What each message actually says.
 *
 * One file so the wording can be read and changed in one place, and so nobody
 * builds a customer-facing sentence inline in a route handler.
 *
 * Two rules these are written to:
 *
 *   Keep it inside 160 GSM-7 characters. A longer message is billed as two,
 *   and any Bangla character at all switches the whole message to UCS-2, where
 *   the limit drops to 70. That is why these are English and terse — if the
 *   shop wants Bangla copy later, the cost per send roughly doubles and that
 *   should be a decision somebody makes on purpose.
 *
 *   Never put anything in a message that would embarrass the shop if the phone
 *   were on a table face-up. Order id and amount, yes; what was bought, no.
 */

const BRAND = "ZUP TECH";

export function otpSms(code: string): string {
  // No greeting and no link: a reset code that arrives looking like marketing
  // gets ignored, and a link invites the phishing this code is protecting.
  return `${code} is your ${BRAND} password reset code. It expires in 10 minutes. Do not share it with anyone.`;
}

export function orderPlacedSms(orderId: string, total: number): string {
  return `${BRAND}: we have your order ${orderId} for BDT ${total.toLocaleString("en-BD")}. We will call you to confirm it shortly.`;
}

export function orderShippedSms(
  orderId: string,
  courier: string,
  trackingCode: string,
): string {
  const tail = trackingCode ? ` Tracking: ${trackingCode}.` : "";
  return `${BRAND}: order ${orderId} is on its way with ${courier}.${tail} Please keep your phone reachable.`;
}

export function orderDeliveredSms(orderId: string): string {
  return `${BRAND}: order ${orderId} has been delivered. Thank you for shopping with us.`;
}
