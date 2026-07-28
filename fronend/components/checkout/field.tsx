"use client";

import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

/**
 * One labelled form control with its own error line.
 *
 * Checkout used to carry a single `error: 1 | 2 | null` for the whole flow, so
 * "please enter your name and a valid 11-digit phone number" appeared under
 * both fields and pointed at neither. Errors belong to fields.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Point at the error when there is one, the hint otherwise — a screen
  // reader should hear what's wrong before it hears the advice.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-zup-mid">
        {label}
        {optional ? <span className="font-normal text-zup-faint"> (optional)</span> : null}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12px] text-zup-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shared input styling. Stays at 16px on mobile so iOS doesn't zoom on focus. */
export const fieldCls =
  "w-full rounded-2xl border bg-white px-4 py-3.5 text-base outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zup-faint focus:ring-4";

export function inputCls(hasError?: boolean, extra?: ClassValue) {
  return cn(
    fieldCls,
    hasError
      ? "border-destructive focus:border-destructive focus:ring-destructive/12"
      : "border-zup-body/10 focus:border-zup-blue focus:ring-zup-blue/12",
    extra,
  );
}
