"use client";

import { Field, inputCls } from "./field";

/** Bangladeshi mobile number, spaces and dashes tolerated. */
export const PHONE_RE = /^01\d{9}$/;

export const normalizePhone = (v: string) => v.replace(/[\s-]/g, "");

export interface CustomerErrors {
  name?: string;
  phone?: string;
}

/** Validates name + phone, returning per-field messages (empty = valid). */
export function validateCustomer(name: string, phone: string): CustomerErrors {
  const errors: CustomerErrors = {};
  if (name.trim().length < 2) errors.name = "Please enter your full name.";
  if (!PHONE_RE.test(normalizePhone(phone)))
    errors.phone = "Please enter an 11-digit number starting 01 — like 01712345678.";
  return errors;
}

/**
 * Who is ordering. Used by the guest form and by the "Change" state of a
 * signed-in customer's saved-details card, so the two can never drift apart.
 */
export function CustomerFields({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  errors,
  phoneReadOnly,
}: {
  name: string;
  phone: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  errors: CustomerErrors;
  /** Signed in: the phone is the login identity and can't be edited here. */
  phoneReadOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field id="co-name" label="Your name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Rakib Hasan"
            autoComplete="name"
            className={inputCls(Boolean(errors.name))}
          />
        )}
      </Field>

      <Field
        id="co-phone"
        label="Phone number"
        error={errors.phone}
        hint={
          phoneReadOnly
            ? "This is the number you signed in with."
            : "We call this number to confirm your order."
        }
      >
        {(props) => (
          <input
            {...props}
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="01XXXXXXXXX"
            inputMode="tel"
            type="tel"
            autoComplete="tel"
            readOnly={phoneReadOnly}
            className={inputCls(
              Boolean(errors.phone),
              phoneReadOnly && "bg-secondary text-zup-gray",
            )}
          />
        )}
      </Field>
    </div>
  );
}
