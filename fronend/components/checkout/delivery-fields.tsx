"use client";

import { ZonePicker } from "@/components/zone-picker";
import { Field, inputCls } from "./field";

export interface DeliveryErrors {
  address?: string;
}

export function validateDelivery(address: string): DeliveryErrors {
  return address.trim().length > 3
    ? {}
    : { address: "Please add your house, road and area so our rider can find you." };
}

/**
 * Where an order goes: delivery zone, street address, optional landmark.
 *
 * The single definition of the address form. It used to be copy-pasted between
 * checkout and the account profile tab — identical markup, identical
 * placeholders, no shared code — so a change to one silently diverged from the
 * other. Both now render this.
 *
 * Note the zone is not decoration: the backend prices delivery and
 * installation from `insideDhaka` alone, so it belongs beside the address
 * rather than in a settings screen somewhere.
 */
export function DeliveryFields({
  insideDhaka,
  address,
  landmark,
  onZoneChange,
  onAddressChange,
  onLandmarkChange,
  errors,
  idPrefix = "co",
}: {
  insideDhaka: boolean;
  address: string;
  landmark: string;
  onZoneChange: (insideDhaka: boolean) => void;
  onAddressChange: (v: string) => void;
  onLandmarkChange: (v: string) => void;
  errors: DeliveryErrors;
  /** Set when two of these render on one page, so ids stay unique. */
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ZonePicker value={insideDhaka} onChange={onZoneChange} />

      <Field
        id={`${idPrefix}-address`}
        label="Address"
        error={errors.address}
        hint="House or flat number, road number and area."
      >
        {(props) => (
          <textarea
            {...props}
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="House 4, Road 7, Dhanmondi"
            autoComplete="street-address"
            rows={3}
            className={inputCls(Boolean(errors.address), "resize-none")}
          />
        )}
      </Field>

      <Field id={`${idPrefix}-landmark`} label="Nearby landmark" optional>
        {(props) => (
          <input
            {...props}
            value={landmark}
            onChange={(e) => onLandmarkChange(e.target.value)}
            placeholder="e.g. beside Al-Amin Mosque"
            className={inputCls()}
          />
        )}
      </Field>
    </div>
  );
}
