"use client";

import { MapPin } from "lucide-react";
import { useSiteContact } from "@/lib/admin-bridge";
import { headOffice, warehouse } from "@/lib/contact-content";

/** Head Office details + Warehouse & Service Centre cards for the Contact page. */
export function ContactOffice() {
  const contact = useSiteContact();
  return (
    <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <div className="rounded-[20px] border border-zup-body/6 bg-white px-6 py-6.5">
        <span className="mb-3 flex items-start gap-2 text-xs font-bold uppercase tracking-[0.1em] text-zup-orange">
          <MapPin className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} aria-hidden />
          Head Office
        </span>
        <p className="mb-4 text-[14.5px] font-bold leading-relaxed">
          {headOffice.name}
          <br />
          <span className="font-normal text-zup-gray">
            {contact.street}
            <br />
            {contact.city} {contact.postalCode}
            <br />
            Bangladesh
          </span>
        </p>
        <dl className="mb-4 flex flex-col gap-1 border-t border-zup-body/6 pt-3.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zup-gray">Sales</dt>
            <dd>
              <a href={`tel:${contact.phone}`} className="font-bold text-zup-blue hover:underline">
                {contact.phoneDisplay}
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zup-gray">Service line</dt>
            <dd>
              <a
                href={`tel:${headOffice.serviceLine.replace(/\s+/g, "")}`}
                className="font-bold text-zup-blue hover:underline"
              >
                {headOffice.serviceLine}
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zup-gray">Email</dt>
            <dd>
              <a href={`mailto:${contact.email}`} className="font-bold text-zup-blue hover:underline">
                {contact.email}
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zup-gray">Tenders / RFQ</dt>
            <dd>
              <a
                href={`mailto:${headOffice.tendersEmail}`}
                className="font-bold text-zup-blue hover:underline"
              >
                {headOffice.tendersEmail}
              </a>
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-1 border-t border-zup-body/6 pt-3.5 text-[13px]">
          {headOffice.hours.map((row) => (
            <div key={row.days} className="flex items-center justify-between gap-3">
              <span className="text-zup-gray">{row.days}</span>
              <span
                className={
                  row.time === "24/7" || row.time === "Closed"
                    ? "font-bold text-zup-orange"
                    : "font-semibold"
                }
              >
                {row.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex h-[220px] items-center justify-center overflow-hidden rounded-[20px] border border-zup-body/6 bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_14px,#F6F7F9_14px_28px)] sm:h-auto"
        role="img"
        aria-label={`Map — ${contact.street}, ${contact.city}`}
      >
        <span className="rounded-lg bg-white/85 px-3 py-1.5 font-mono text-[11px] text-zup-faint">
          Map screenshot of the Banani office · 800×600
        </span>
      </div>

      <div className="rounded-[20px] bg-zup-ink px-6 py-5 sm:col-span-2">
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-zup-sky">
          {warehouse.title}
        </span>
        <p className="text-[13.5px] leading-relaxed text-[#D5D8DD]">
          {warehouse.line1}
          <br />
          {warehouse.line2}
        </p>
      </div>
    </div>
  );
}
