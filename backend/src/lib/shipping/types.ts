import type { OrderStatus, ShipmentStatus } from "../rules";

/**
 * One interface, three couriers, and the differences between them are
 * deliberately small.
 *
 * `self` and `manual` do no network at all — they exist so that "our rider is
 * taking it" and "we gave it to a courier we have no integration with" are
 * first-class states with the same audit trail as an API booking, rather than
 * a note somebody typed into a text field.
 */

/**
 * What a shipment's status implies for the order it belongs to.
 *
 * `null` means "the order is not this shipment's business". A returned or
 * cancelled parcel is exactly that case: whether the customer gets a refund, a
 * second attempt or nothing is a decision with money in it, and a courier's
 * webhook is not entitled to make it. A human moves the order.
 */
export const ORDER_STATUS_FOR: Record<ShipmentStatus, OrderStatus | null> = {
  Booked: null,
  "Picked up": "On the way",
  "In transit": "On the way",
  Delivered: "Delivered",
  Returned: null,
  Cancelled: null,
};

/** What a courier needs to know to take a parcel. */
export interface ShipmentRequest {
  /** Our order id — couriers show it back to us as the invoice number. */
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  /**
   * What to collect at the door, in BDT. Zero for an order already paid
   * online — see the note on Shipment.codAmount.
   */
  codAmount: number;
  note: string;
}

export interface BookingResult {
  consignmentId: string;
  trackingCode: string;
  status: ShipmentStatus;
  raw: Record<string, unknown>;
}

export interface StatusResult {
  status: ShipmentStatus;
  raw: Record<string, unknown>;
}

/** Credentials come from Courier.credentials, shaped per provider. */
export interface CourierConfig {
  credentials: Record<string, string>;
  environment: "Live" | "Test";
}

export interface CourierAdapter {
  /** Hand the parcel over. Throws if the courier refuses. */
  book(config: CourierConfig, req: ShipmentRequest): Promise<BookingResult>;
  /**
   * Ask where it is. `null` means the courier has no opinion yet, which is
   * different from "not moving" and must not overwrite a known status.
   */
  track(config: CourierConfig, consignmentId: string): Promise<StatusResult | null>;
}
