/*
 * Field labels and length limits for the site-copy and contact screens, in one
 * place.
 *
 * Two things needed the same knowledge and had neither:
 *
 *  - The inputs had no `maxLength`, so it was possible to type a value the
 *    server would refuse. Those screens PUT the WHOLE document, so one
 *    over-long field blocked saving every other field on the page.
 *  - The Save bar had no way to name the field that failed. A 422 carries only
 *    "Invalid request" in its message; the property is in `detail`, which is
 *    parsed but was never read. See `saveErrorMessage` in lib/admin.tsx.
 *
 * Both now read from here, so the label above an input and the label in the
 * error message cannot drift apart.
 *
 * The numbers mirror `backend/src/dtos/content.dto.ts` exactly. Keep them in
 * step: too high and the input stops protecting anyone, too low and it blocks
 * a value the server would have accepted. `dtos.test.ts` pins the server side.
 */

/** Max lengths from `updateCopyDto` / `updateContactDto`. */
export const ADMIN_FIELD_MAX: Record<string, number> = {
  // copy — heading = 120, body = 400
  homeHeroHeadline: 120,
  servicesHeroHeadline: 120,
  industrialHeroHeadline: 120,
  contactHeading: 120,
  contactFormHeading: 120,
  contactOfficeHeading: 120,
  contactServiceLine: 40,
  contactTendersEmail: 120,
  footerDescription: 400,

  // contact
  phone: 20,
  phoneDisplay: 30,
  hotline: 30,
  email: 200,
  whatsapp: 20,
  street: 200,
  city: 80,
  postalCode: 20,
  hours: 80,
  officeName: 120,
  warehouseName: 120,
  warehouseAddress: 200,
  hoursWeekday: 80,
  hoursWeekend: 80,
  hoursEmergency: 80,
};

/**
 * The label printed above each input — reused verbatim when a save is
 * refused, so the message names the box on screen rather than the column.
 */
export const ADMIN_FIELD_LABELS: Record<string, string> = {
  homeHeroHeadline: "Hero headline (screen readers & search)",
  servicesHeroHeadline: "Hero headline (screen readers & search)",
  industrialHeroHeadline: "Hero headline (screen readers & search)",
  contactHeading: "Page heading",
  contactFormHeading: "Form heading",
  contactOfficeHeading: "Office card heading",
  contactServiceLine: "Service line number",
  contactTendersEmail: "Tenders email",
  footerDescription: "Footer description",

  phone: "Phone (dialable)",
  phoneDisplay: "Phone (as shown)",
  hotline: "Hotline (printed on invoices)",
  email: "Email",
  whatsapp: "WhatsApp number (digits)",
  street: "Street address",
  city: "City",
  postalCode: "Postal code",
  hours: "Opening hours (short form)",
  officeName: "Office name",
  hoursWeekday: "Hours — weekdays",
  hoursWeekend: "Hours — weekend",
  hoursEmergency: "Hours — emergency",
  warehouseName: "Warehouse name",
  warehouseAddress: "Warehouse address",
};

/**
 * Fields the server accepts only as bare digits (`^[0-9]*$` in the DTO).
 *
 * The stored value looks like a phone number, so `+880…`, spaces and dashes
 * are the natural thing to type — and every one of them is refused. The input
 * warns rather than silently stripping, because quietly rewriting what someone
 * typed into a contact number is worse than telling them.
 */
export const DIGITS_ONLY_FIELDS = new Set(["whatsapp"]);

/** True when a value would be refused by the digits-only rule above. */
export function violatesDigitsOnly(key: string, value: string): boolean {
  return DIGITS_ONLY_FIELDS.has(key) && value !== "" && !/^[0-9]+$/.test(value);
}
