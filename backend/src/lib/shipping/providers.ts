/**
 * What each courier provider needs to be configured.
 *
 * One declaration, two consumers: the adapter reads credentials by these keys,
 * and the admin screen renders exactly these fields. That is the whole point of
 * putting them here rather than hardcoding a form — a screen asking for a
 * credential the adapter never reads, or missing one it does, produces a
 * courier that looks configured and refuses every booking. The mismatch is
 * invisible until someone's parcel does not go out, so `providers.test.ts`
 * asserts the two agree instead of trusting them to.
 *
 * The Delivery screen fetches this from `GET /admin/api/courier-providers`
 * rather than keeping its own copy. `ADMIN_MODULES` is duplicated across
 * backend and frontend with a "must stay in step" comment, and that is a
 * precedent worth not following where serving it costs one endpoint.
 */

export interface CredentialField {
  /** Key inside `Courier.credentials`. Changing one orphans stored values. */
  key: string;
  label: string;
  /** One sentence: where the merchant finds this, in the provider's own words. */
  help: string;
  /** Rendered as a password input and masked in responses. */
  secret: boolean;
}

export interface CourierProvider {
  id: string;
  label: string;
  /** Prefilled when an admin picks this provider for a new courier. */
  defaultBaseUrl: string;
  fields: CredentialField[];
  /**
   * What Live/Test actually means for this provider. Steadfast has no separate
   * sandbox host, so saying "switches to a test server" would be a lie the
   * screen tells; it only records which account the credentials belong to.
   */
  environmentNote: string;
}

export const COURIER_PROVIDERS: CourierProvider[] = [
  {
    id: "steadfast",
    label: "Steadfast",
    defaultBaseUrl: "https://portal.steadfast.com.bd/api/v1",
    environmentNote:
      "Steadfast has no separate test server — this only records which account these credentials belong to.",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        help: "From your Steadfast merchant panel, under API settings.",
        secret: false,
      },
      {
        key: "secretKey",
        label: "Secret key",
        help: "Issued beside the API key. Treat it like a password.",
        secret: true,
      },
    ],
  },
];

export function providerSpec(id: string): CourierProvider | null {
  return COURIER_PROVIDERS.find((p) => p.id === id.trim().toLowerCase()) ?? null;
}
