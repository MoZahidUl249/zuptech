"use client";

import { MapPin } from "lucide-react";
import { useSiteContact, useSiteCopy } from "@/lib/admin-bridge";

/**
 * Head office details and the warehouse card on the contact page.
 *
 * Every value here comes from the admin. It used to read a frontend constants
 * file whose phone number and tenders address were placeholders flagged as a
 * launch blocker — and which no admin could correct, because the fields that
 * were supposed to feed them (contactServiceLine, contactTendersEmail,
 * contactOfficeHeading) were saved and then never read by anything.
 *
 * Rows hide themselves when their value is blank rather than showing an empty
 * dt/dd pair, so a half-filled config degrades to a shorter card.
 */
export function ContactOffice() {
  const contact = useSiteContact();
  const copy = useSiteCopy();

  const rows = [
    { label: "Sales", value: contact.phoneDisplay, href: `tel:${contact.phone}` },
    {
      label: "Service line",
      value: copy.contactServiceLine,
      href: `tel:${copy.contactServiceLine.replace(/\s+/g, "")}`,
    },
    { label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    {
      label: "Tenders / RFQ",
      value: copy.contactTendersEmail,
      href: `mailto:${copy.contactTendersEmail}`,
    },
  ].filter((r) => r.value);

  const hours = [contact.hoursWeekday, contact.hoursWeekend, contact.hoursEmergency].filter(
    Boolean,
  );

  return (
    <div className="mb-4 grid grid-cols-1 gap-3.5">
      <div className="rounded-[2px] border border-zup-body/6 bg-white px-6 py-6.5">
        <span className="mb-3 flex items-start gap-2 text-xs font-bold uppercase tracking-[0.1em] text-zup-orange">
          <MapPin className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} aria-hidden />
          {copy.contactOfficeHeading}
        </span>
        <p className="mb-4 text-[14.5px] font-bold leading-relaxed">
          {contact.officeName}
          <br />
          <span className="font-normal text-zup-gray">
            {contact.street}
            <br />
            {contact.city} {contact.postalCode}
          </span>
        </p>
        <dl className="mb-4 flex flex-col gap-1 border-t border-zup-body/6 pt-3.5 text-[13px]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="text-zup-gray">{row.label}</dt>
              <dd>
                <a href={row.href} className="font-bold text-zup-blue hover:underline">
                  {row.value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
        {hours.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-zup-body/6 pt-3.5 text-[13px]">
            {hours.map((row) => (
              <div key={row} className="text-zup-gray">
                {row}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {contact.warehouseName || contact.warehouseAddress ? (
        <div className="rounded-[2px] bg-zup-ink px-6 py-5">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-zup-sky">
            {contact.warehouseName}
          </span>
          <p className="text-[13.5px] leading-relaxed text-[#D5D8DD]">
            {contact.warehouseAddress}
          </p>
        </div>
      ) : null}
    </div>
  );
}
