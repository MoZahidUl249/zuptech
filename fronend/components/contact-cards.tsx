"use client";

import { Phone, MessageCircle, Mail } from "lucide-react";
import { useSiteContact, waLink } from "@/lib/admin-bridge";

/**
 * The direct-contact channels on the contact page — reads admin-managed
 * contact info.
 *
 * Corporate treatment: white cards with a tinted icon tile and a coloured
 * rail, rather than the previous full-bleed saturated blue/green blocks. Two
 * large flat colour fields sitting next to a white form read as a consumer
 * promo; the accent-on-white version keeps the same colour coding for
 * scanning while staying inside the page's card system.
 */
export function ContactCards() {
  const contact = useSiteContact();

  return (
    <div className="flex flex-col gap-3">
      <Channel
        href={`tel:${contact.phone}`}
        rail="bg-zup-blue"
        tint="bg-zup-blue/10 text-zup-blue"
        icon={<Phone className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />}
        label="Sales desk"
        value={contact.phoneDisplay}
        note={contact.hours}
      />
      <Channel
        href={waLink(contact.whatsapp)}
        external
        rail="bg-zup-green"
        tint="bg-zup-green/10 text-zup-green"
        icon={<MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />}
        label="WhatsApp"
        value={contact.phoneDisplay}
        note="Fastest reply — usually within minutes"
      />
      {contact.email ? (
        <Channel
          href={`mailto:${contact.email}`}
          rail="bg-zup-orange"
          tint="bg-zup-orange/10 text-zup-orange"
          icon={<Mail className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />}
          label="Email"
          value={contact.email}
          note="Tenders, quotations and documents"
        />
      ) : null}
    </div>
  );
}

function Channel({
  href,
  external,
  rail,
  tint,
  icon,
  label,
  value,
  note,
}: {
  href: string;
  external?: boolean;
  rail: string;
  tint: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-zup-body/8 bg-white px-5 py-4 transition-colors hover:border-zup-body/16"
    >
      {/* Colour coding lives on a rail, so the card stays legible dark-on-white. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${rail}`} aria-hidden />
      <span
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${tint}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-zup-soft">
          {label}
        </span>
        <span className="truncate text-[15.5px] font-bold tracking-[-0.01em] text-zup-body">
          {value}
        </span>
        <span className="text-[12.5px] text-zup-gray">{note}</span>
      </span>
    </a>
  );
}
