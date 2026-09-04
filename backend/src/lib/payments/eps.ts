import { createHmac } from "node:crypto";
import { ApiError, badRequest } from "../http";

/**
 * EPS Payment Gateway (eps.com.bd) — the only file that knows EPS exists.
 *
 * Protocol, as implemented by EPS's own published SDK:
 *
 *   POST {base}/v1/Auth/GetToken
 *     headers: x-hash = HMAC-SHA512(username, hashKey), base64
 *     body:    { userName, password }              → { token }
 *
 *   POST {base}/v1/EPSEngine/InitializeEPS
 *     headers: x-hash = HMAC-SHA512(merchantTransactionId, hashKey)
 *              Authorization: Bearer {token}
 *     body:    merchant/store ids, our transaction id, amount, the three
 *              return URLs, customer details, ProductList
 *                                                  → { TransactionId, RedirectURL }
 *
 *   GET  {base}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=…
 *     headers: same pair                           → { Status, EPSTransactionId, TotalAmount, … }
 *
 * Two things about this protocol drive the design elsewhere:
 *
 * 1. `merchantTransactionId` is OURS. EPS does not mint it — we do, and every
 *    later question about the payment is asked using it. That is why
 *    PaymentTransaction.merchantTxnId is the unique key and the gateway's own
 *    id is a plain column.
 *
 * 2. The customer comes back through a *browser redirect* to one of the three
 *    URLs. A redirect proves nothing — anyone can open the success URL. The
 *    status call above is the only statement about payment worth acting on,
 *    which is why `verifyPayment` exists and why nothing here trusts a
 *    request body.
 */

const HOSTS = {
  Test: "https://sandboxpgapi.eps.com.bd",
  Live: "https://pgapi.eps.com.bd",
} as const;

export type EpsEnvironment = keyof typeof HOSTS;

/** Ten seconds: a slow gateway must not hold a checkout request open. */
const TIMEOUT_MS = 10_000;

export interface EpsCredentials {
  merchantId: string;
  storeId: string;
  username: string;
  password: string;
  hashKey: string;
}

const CREDENTIAL_FIELDS = ["merchantId", "storeId", "username", "password", "hashKey"] as const;

/**
 * Pull the five credentials out of PaymentMethod.credentials.
 *
 * Fails loudly and by name. A half-configured gateway that fails at the HTTP
 * call instead produces "payment failed" for the customer and a shrug for
 * whoever has to work out why.
 */
export function parseEpsCredentials(raw: unknown): EpsCredentials {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const missing = CREDENTIAL_FIELDS.filter(
    (f) => typeof source[f] !== "string" || (source[f] as string).trim() === "",
  );
  if (missing.length > 0) {
    throw badRequest(`EPS is not fully configured — missing ${missing.join(", ")}`);
  }
  return Object.fromEntries(
    CREDENTIAL_FIELDS.map((f) => [f, (source[f] as string).trim()]),
  ) as unknown as EpsCredentials;
}

/** EPS signs every request with base64(HMAC-SHA512(payload, hashKey)). */
function hash(data: string, hashKey: string): string {
  return createHmac("sha512", hashKey).update(data).digest("base64");
}

/** 502, not 500: the fault is upstream, and the message says which upstream. */
const gatewayError = (message: string) => new ApiError(502, `EPS: ${message}`);

async function call<T>(
  url: string,
  init: RequestInit & { headers: Record<string, string> },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    // Timeout, DNS, TLS, connection refused — all indistinguishable to the
    // customer, and all mean the same thing: we could not ask the gateway.
    throw gatewayError(
      err instanceof Error && err.name === "TimeoutError"
        ? "the gateway did not respond in time"
        : "could not reach the gateway",
    );
  }

  const text = await response.text();
  if (!response.ok) throw gatewayError(`HTTP ${response.status}`);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw gatewayError("returned a response that was not JSON");
  }
}

async function getToken(creds: EpsCredentials, environment: EpsEnvironment): Promise<string> {
  const body = { userName: creds.username, password: creds.password };
  const result = await call<{ token?: string }>(`${HOSTS[environment]}/v1/Auth/GetToken`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hash": hash(creds.username, creds.hashKey),
    },
    body: JSON.stringify(body),
  });

  if (!result.token) throw gatewayError("authentication was refused");
  return result.token;
}

export interface EpsInitRequest {
  creds: EpsCredentials;
  environment: EpsEnvironment;
  /** Our id for the attempt. Also the key every status query uses. */
  merchantTxnId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  ipAddress: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}

export interface EpsInitResult {
  /** Where to send the customer's browser. */
  redirectUrl: string;
  /** EPS's own id, when it hands one over this early. Often empty. */
  providerTxnId: string;
}

/** Open a payment session and get the URL to send the customer to. */
export async function initPayment(req: EpsInitRequest): Promise<EpsInitResult> {
  const token = await getToken(req.creds, req.environment);

  const result = await call<{
    TransactionId?: string;
    RedirectURL?: string;
    ErrorMessage?: string;
  }>(`${HOSTS[req.environment]}/v1/EPSEngine/InitializeEPS`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hash": hash(req.merchantTxnId, req.creds.hashKey),
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      merchantId: req.creds.merchantId,
      storeId: req.creds.storeId,
      merchantTransactionId: req.merchantTxnId,
      totalAmount: req.amount,
      successUrl: req.successUrl,
      failUrl: req.failUrl,
      cancelUrl: req.cancelUrl,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      customerPhone: req.customerPhone,
      customerAddress: req.customerAddress,
      productName: req.productName,
      ipAddress: req.ipAddress,
      ProductList: [{ name: req.productName, quantity: 1, price: req.amount }],
    }),
  });

  if (result.ErrorMessage) throw gatewayError(result.ErrorMessage);
  if (!result.RedirectURL) throw gatewayError("did not return a redirect URL");

  return { redirectUrl: result.RedirectURL, providerTxnId: result.TransactionId ?? "" };
}

export interface EpsVerifyResult {
  /** The only field callers should branch on. */
  paid: boolean;
  /** EPS's own word for the outcome, lowercased ("success", "failed", …). */
  status: string;
  providerTxnId: string;
  /** What EPS says was actually paid, in BDT. 0 unless `paid`. */
  paidAmount: number;
  /** bKash / Nagad / the card scheme — whatever the customer used. */
  method: string;
  /** The whole response, stored for disputes. */
  raw: Record<string, unknown>;
}

/**
 * Ask EPS what really happened. This is the ONLY source of truth about
 * payment — never a redirect, never a callback body.
 */
export async function verifyPayment(
  creds: EpsCredentials,
  environment: EpsEnvironment,
  merchantTxnId: string,
): Promise<EpsVerifyResult> {
  const token = await getToken(creds, environment);

  const url = new URL(`${HOSTS[environment]}/v1/EPSEngine/CheckMerchantTransactionStatus`);
  url.searchParams.set("merchantTransactionId", merchantTxnId);

  const result = await call<Record<string, unknown>>(url.toString(), {
    method: "GET",
    headers: {
      "x-hash": hash(merchantTxnId, creds.hashKey),
      authorization: `Bearer ${token}`,
    },
  });

  // An unknown id comes back without the echo, which is a real answer ("we
  // have never heard of this payment"), not a transport failure.
  if (!result.MerchantTransactionId) {
    return {
      paid: false,
      status: "unknown",
      providerTxnId: "",
      paidAmount: 0,
      method: "",
      raw: result,
    };
  }

  const status = String(result.Status ?? "").toLowerCase();
  const paid = status === "success";

  return {
    paid,
    status,
    providerTxnId: String(result.EPSTransactionId ?? ""),
    paidAmount: paid ? Math.round(Number(result.TotalAmount ?? 0)) : 0,
    method: String(result.FinancialEntity ?? ""),
    raw: result,
  };
}
