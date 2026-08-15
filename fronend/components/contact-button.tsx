"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, MessageCircle, Phone, X } from "lucide-react";
import { useSiteContact, waLink } from "@/lib/admin-bridge";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** WhatsApp and the social networks have no lucide glyphs, so they're inline. */
function WhatsAppIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.03c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}

function FacebookIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

function LinkedInIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/**
 * Floating contact button.
 *
 * Was a single WhatsApp link; it now opens a small stack of direct channels,
 * because WhatsApp was the only way to reach the business from anywhere on the
 * site and the phone number, inbox and social pages were buried in the footer.
 *
 * Phone, email and WhatsApp come from Admin → Text & contact via
 * `useSiteContact`. The social URLs are hardcoded in `lib/site.ts` and are NOT
 * admin-editable — the same placeholder handles the footer links today.
 */
export function ContactButton() {
  const pathname = usePathname();
  const contact = useSiteContact();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Not a modal — it must never trap
  // focus or block the page behind it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (pathname.startsWith("/checkout")) return null;

  // A product page shows the buy bar INSTEAD of the tab bar, not above it —
  // so there is one bar to clear here, not two. This used to lift the button
  // by both heights, which left it stranded mid-screen once the tab bar
  // stopped rendering on this route.
  const aboveBuyBar = pathname.startsWith("/products/");

  const channels = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: waLink(contact.whatsapp),
      external: true,
      Icon: WhatsAppIcon,
      className: "bg-zup-green text-white",
    },
    {
      key: "phone",
      label: `Call ${contact.phoneDisplay}`,
      href: `tel:${contact.phone}`,
      external: false,
      Icon: Phone,
      className: "bg-zup-blue text-white",
    },
    {
      key: "email",
      label: `Email ${contact.email}`,
      href: `mailto:${contact.email}`,
      external: false,
      Icon: Mail,
      className: "bg-zup-orange text-white",
    },
    {
      key: "facebook",
      label: "Facebook",
      href: site.social.facebook,
      external: true,
      Icon: FacebookIcon,
      className: "bg-[#1877F2] text-white",
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      href: site.social.linkedin,
      external: true,
      Icon: LinkedInIcon,
      className: "bg-[#0A66C2] text-white",
    },
  ];

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed right-4 z-80 flex flex-col items-end gap-2.5 md:bottom-6",
        /*
         * Sits above the mobile tab bar, which now floats: it clears the
         * bottom edge by 12px plus the safe-area inset and is 64px tall, so
         * anything stacked over it has to start past ~76px + inset. The old
         * flat `bottom-20` (80px) was measured against a bar welded to the
         * edge and left only a few pixels once it lifted off.
         */
        // Product page: the buy bar is welded to bottom-0 and is ~72px tall
        // including its own safe-area padding. Everywhere else: the tab bar
        // floats 12px up and is 64px tall.
        aboveBuyBar
          ? "bottom-[calc(84px+env(safe-area-inset-bottom))]"
          : "bottom-[calc(88px+env(safe-area-inset-bottom))]",
      )}
    >
      {/* Rendered only when open rather than hidden with opacity, so the
          links are never reachable by keyboard while the stack is closed. */}
      {open &&
        channels.map(({ key, label, href, external, Icon, className }) => (
          <a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={() => setOpen(false)}
            className="group flex items-center gap-2.5"
          >
            {/* `rounded-[999px]`, not `rounded-full`: globals.css squares off
                `rounded-full` site-wide, and this floating stack is one of the
                two places that keeps its round shape (the desktop nav is the
                other). Switching these back to `rounded-full` silently
                flattens them. */}
            <span className="rounded-[999px] bg-zup-ink/90 px-2.5 py-1 text-[12px] font-semibold text-white shadow-md">
              {label}
            </span>
            <span
              className={cn(
                "flex h-11 w-11 flex-none items-center justify-center rounded-[999px] shadow-lg transition-transform duration-150 group-hover:scale-105",
                className,
              )}
            >
              <Icon className="h-[21px] w-[21px]" aria-hidden />
            </span>
          </a>
        ))}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close contact options" : "Contact us"}
        className="flex h-[54px] w-[54px] items-center justify-center self-end rounded-[999px] bg-zup-green text-white shadow-[0_10px_26px_rgba(31,168,85,.4)] transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-zup-green-dark"
      >
        {open ? (
          <X className="h-6 w-6" strokeWidth={2.4} aria-hidden />
        ) : (
          <MessageCircle className="h-6 w-6" strokeWidth={2.2} aria-hidden />
        )}
      </button>
    </div>
  );
}
