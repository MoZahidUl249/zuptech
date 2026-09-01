import { ApiError, badRequest } from "../http";
import type { ShipmentStatus } from "../rules";
import type {
  BookingResult,
  CourierAdapter,
  CourierConfig,
  ShipmentRequest,
  StatusResult,
} from "./types";

/**
 * Steadfast Courier (portal.steadfast.com.bd).
 *
 *   POST {base}/create_order        Api-Key + Secret-Key headers
 *     { invoice, recipient_name, recipient_phone, recipient_address,
 *       cod_amount, note }
 *       → { consignment: { consignment_id, tracking_code, status } }
 *
 *   GET  {base}/status_by_cid/{id}  → { delivery_status }
 *
 * Steadfast has no sandbox host: test and live are the same API with different
 * credentials, which is why `environment` here changes nothing but is still
 * carried — it is what the admin screen shows, and someone reading a booking
 * six months later needs to know which account made it.
 */

const BASE = "https://portal.steadfast.com.bd/api/v1";
const TIMEOUT_MS = 15_000;

const courierError = (message: string) => new ApiError(502, `Steadfast: ${message}`);

function credentials(config: CourierConfig): { apiKey: string; secretKey: string } {
  const apiKey = config.credentials.apiKey?.trim();
  const secretKey = config.credentials.secretKey?.trim();
  const missing = [!apiKey && "apiKey", !secretKey && "secretKey"].filter(Boolean);
  if (missing.length > 0) {
    throw badRequest(`Steadfast is not fully configured — missing ${missing.join(", ")}`);
  }
  return { apiKey: apiKey as string, secretKey: secretKey as string };
}

async function call<T>(
  path: string,
  config: CourierConfig,
  init?: { method: string; body: unknown },
): Promise<T> {
  const { apiKey, secretKey } = credentials(config);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw courierError(
      err instanceof Error && err.name === "TimeoutError"
        ? "the courier did not respond in time"
        : "could not reach the courier",
    );
  }

  const text = await response.text();
  if (!response.ok) {
    // 401/422 here almost always means the credentials or the address, and
    // saying which status came back saves a support ticket.
    throw courierError(`HTTP ${response.status}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw courierError("returned a response that was not JSON");
  }
}

/**
 * Steadfast's delivery vocabulary → ours.
 *
 * Anything not listed returns null, which the caller treats as "no opinion"
 * and leaves the shipment where it is. Guessing would be worse than waiting:
 * an unrecognised word wrongly mapped to Delivered consumes stock and starts
 * warranty cover for a parcel still on a van.
 */
const STATUS_MAP: Record<string, ShipmentStatus> = {
  pending: "Booked",
  in_review: "Booked",
  hold: "Booked",
  unknown: "Booked",
  delivered_approval_pending: "In transit",
  partial_delivered_approval_pending: "In transit",
  delivered: "Delivered",
  partial_delivered: "Delivered",
  cancelled_approval_pending: "In transit",
  cancelled: "Cancelled",
  return: "Returned",
  returned: "Returned",
  unknown_approval_pending: "Booked",
};

export function mapSteadfastStatus(raw: string): ShipmentStatus | null {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? null;
}

export const steadfast: CourierAdapter = {
  async book(config, req: ShipmentRequest): Promise<BookingResult> {
    const result = await call<{
      status?: number;
      message?: string;
      consignment?: {
        consignment_id?: number | string;
        tracking_code?: string;
        status?: string;
      };
    }>("/create_order", config, {
      method: "POST",
      body: {
        invoice: req.orderId,
        recipient_name: req.recipientName,
        recipient_phone: req.recipientPhone,
        recipient_address: req.recipientAddress,
        cod_amount: req.codAmount,
        note: req.note,
      },
    });

    const consignment = result.consignment;
    if (!consignment?.consignment_id) {
      throw courierError(result.message ?? "refused the booking");
    }

    return {
      consignmentId: String(consignment.consignment_id),
      trackingCode: consignment.tracking_code ?? "",
      status: (consignment.status && mapSteadfastStatus(consignment.status)) || "Booked",
      raw: result as Record<string, unknown>,
    };
  },

  async track(config, consignmentId): Promise<StatusResult | null> {
    const result = await call<{ delivery_status?: string }>(
      `/status_by_cid/${encodeURIComponent(consignmentId)}`,
      config,
    );

    const mapped = result.delivery_status ? mapSteadfastStatus(result.delivery_status) : null;
    if (!mapped) return null;

    return { status: mapped, raw: result as Record<string, unknown> };
  },
};
