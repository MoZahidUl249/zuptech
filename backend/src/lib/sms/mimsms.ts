/**
 * MiM SMS (mimsms.com) — the only file that knows this provider exists.
 *
 *   POST {base}/api/SmsSending/OneToMany
 *     { UserName, Apikey, MobileNumber, CampaignId, SenderName,
 *       TransactionType, Message }
 *       → { statusCode, status, trxnId, responseResult }
 *
 * `TransactionType: "T"` marks the message transactional rather than
 * promotional. That is not cosmetic in Bangladesh: promotional traffic is
 * blocked outside business hours and to numbers on the DND list, which is
 * exactly how a password-reset code silently fails to arrive at 11pm.
 *
 * `MobileNumber` takes a comma-separated list; we always send one recipient,
 * because these are personal messages and one failed number must not take the
 * others with it.
 */

const TIMEOUT_MS = 10_000;

export interface MimSmsConfig {
  baseUrl: string;
  username: string;
  apiKey: string;
  senderId: string;
}

export interface SmsResult {
  ok: boolean;
  /** The provider's id for the message, for chasing a delivery report. */
  trxnId: string;
  /** Provider wording, kept verbatim for the log — never shown to a customer. */
  detail: string;
}

/**
 * Send one message. Returns a result rather than throwing: every caller is a
 * notification path where the message is secondary to the thing it reports on,
 * and none of them should have to remember to catch.
 */
export async function sendSms(
  config: MimSmsConfig,
  to: string,
  message: string,
): Promise<SmsResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/api/SmsSending/OneToMany`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        UserName: config.username,
        Apikey: config.apiKey,
        MobileNumber: to,
        SenderName: config.senderId,
        TransactionType: "T",
        Message: message,
        // Grouping label in the provider's portal. One value keeps our traffic
        // findable there without inventing a campaign per message.
        CampaignId: "zuptech",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      trxnId: "",
      detail:
        err instanceof Error && err.name === "TimeoutError"
          ? "provider did not respond in time"
          : "could not reach the provider",
    };
  }

  const text = await response.text();
  if (!response.ok) return { ok: false, trxnId: "", detail: `HTTP ${response.status}` };

  let body: { statusCode?: string; status?: string; trxnId?: string; responseResult?: string };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return { ok: false, trxnId: "", detail: "provider returned a response that was not JSON" };
  }

  // MiM answers 200 with a body that says it failed, so the HTTP status alone
  // is not the answer — `status` is.
  const ok = String(body.status ?? "").toLowerCase() === "success";
  return {
    ok,
    trxnId: body.trxnId ?? "",
    detail: body.responseResult ?? body.status ?? "no detail",
  };
}
