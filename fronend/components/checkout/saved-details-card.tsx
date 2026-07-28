"use client";

import { MapPin, Pencil } from "lucide-react";
import { CustomerFields, type CustomerErrors } from "./customer-fields";
import { DeliveryFields, type DeliveryErrors } from "./delivery-fields";

/**
 * A signed-in customer's delivery details, shown as a card they can just
 * accept.
 *
 * This is the whole point of being signed in: the account already holds the
 * name, phone and address, so checkout should be a confirmation, not a form.
 * "Change" opens the same field components the guest form uses — with a
 * "save this as my address" checkbox, because someone correcting their address
 * at checkout almost always means it permanently.
 */
export function SavedDetailsCard({
  name,
  phone,
  address,
  landmark,
  insideDhaka,
  editing,
  saveAddress,
  errors,
  onEdit,
  onNameChange,
  onAddressChange,
  onLandmarkChange,
  onZoneChange,
  onSaveAddressChange,
}: {
  name: string;
  phone: string;
  address: string;
  landmark: string;
  insideDhaka: boolean;
  editing: boolean;
  saveAddress: boolean;
  errors: CustomerErrors & DeliveryErrors;
  onEdit: () => void;
  onNameChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onLandmarkChange: (v: string) => void;
  onZoneChange: (v: boolean) => void;
  onSaveAddressChange: (v: boolean) => void;
}) {
  if (editing) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-zup-body/8 bg-white p-4.5">
        <CustomerFields
          name={name}
          phone={phone}
          onNameChange={onNameChange}
          onPhoneChange={() => {}}
          errors={errors}
          phoneReadOnly
        />
        <DeliveryFields
          insideDhaka={insideDhaka}
          address={address}
          landmark={landmark}
          onZoneChange={onZoneChange}
          onAddressChange={onAddressChange}
          onLandmarkChange={onLandmarkChange}
          errors={errors}
        />
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={saveAddress}
            onChange={(e) => onSaveAddressChange(e.target.checked)}
            className="mt-0.5 h-4.5 w-4.5 flex-none accent-zup-blue"
          />
          <span className="text-[13.5px] leading-snug text-zup-mid">
            Remember this address
            <span className="block text-[12.5px] text-zup-faint">
              We&apos;ll use it next time so you don&apos;t have to type it again.
            </span>
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zup-body/8 bg-white p-4.5">
      <MapPin className="mt-0.5 h-5 w-5 flex-none text-zup-blue" strokeWidth={1.8} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{name}</p>
        <p className="text-[13.5px] text-zup-gray">{phone}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-zup-mid">
          {address}
          {landmark.trim() ? ` (near ${landmark.trim()})` : ""}
        </p>
        <p className="mt-1 text-[12.5px] text-zup-faint">
          {insideDhaka ? "Inside Dhaka" : "Outside Dhaka"}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-none cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-zup-blue transition-colors hover:bg-zup-blue/8"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        Change
      </button>
    </div>
  );
}
