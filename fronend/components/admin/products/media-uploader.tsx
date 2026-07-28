"use client";

import Image from "next/image";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { } from "../confirm-dialog";

const MAX_PHOTO_BYTES = 8_000_000;

export function PhotoSlot({
  label,
  value,
  onUpload,
  onRemove,
  disabled,
  small,
}: {
  label: string;
  value: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
  small?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const inert = disabled || busy;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center",
        small ? "h-16 w-16" : "h-28 w-28",
        inert && "opacity-60",
      )}
    >
      {value ? (
        <>
          <Image src={value} alt={label} fill unoptimized className="object-cover" />
          <button
            type="button"
            disabled={inert}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemove();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't remove photo");
              } finally {
                setBusy(false);
              }
            }}
            aria-label={`Remove ${label}`}
            className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-1.5 text-ui-micro font-bold text-white disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          {!small ? <ImageIcon className="mb-1 h-4 w-4 text-zup-faint" aria-hidden /> : null}
          <span className={cn("font-semibold text-zup-gray", small ? "text-ui-micro" : "text-xs")}>
            {busy ? "Uploading…" : label}
          </span>
          <button
            type="button"
            disabled={inert}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "cursor-pointer text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline",
              small ? "text-ui-micro" : "text-ui-micro",
            )}
          >
            browse
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_PHOTO_BYTES) {
            toast("Image too large — keep uploads under 8 MB");
            return;
          }
          setBusy(true);
          try {
            await onUpload(f);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** Max upload accepted by POST /admin/api/products/:id/video (see products.dto.ts). */
const MAX_VIDEO_BYTES = 300_000_000;

export function VideoSlot({
  value,
  onUpload,
  onRemove,
  disabled,
}: {
  value: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const inert = disabled || busy;

  return (
    <div
      className={cn(
        "relative flex h-28 w-48 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center",
        inert && "opacity-60",
      )}
    >
      {value ? (
        <>
          <video src={value} controls muted className="h-full w-full object-cover" />
          <button
            type="button"
            disabled={inert}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemove();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't remove video");
              } finally {
                setBusy(false);
              }
            }}
            aria-label="Remove product video"
            className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/60 px-1.5 text-ui-micro font-bold text-white disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <span className="text-xs font-semibold text-zup-gray">
            {busy ? "Uploading…" : "Product video"}
          </span>
          <button
            type="button"
            disabled={inert}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer text-ui-micro text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline"
          >
            browse
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        aria-label="Upload product video"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_VIDEO_BYTES) {
            toast("Video too large — keep uploads under 300 MB");
            return;
          }
          setBusy(true);
          try {
            await onUpload(f);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
