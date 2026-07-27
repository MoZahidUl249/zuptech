"use client";

import Link from "next/link";
import Image from "next/image";
import { site } from "@/lib/site";
import { useSiteContact, useSiteCopy } from "@/lib/admin-bridge";

export function SiteFooter() {
  const copy = useSiteCopy();
  const contact = useSiteContact();
  return (
    <footer className="mt-0 bg-zup-ink px-6 pb-[120px] pt-13 md:pb-16">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-9 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/zup-mark.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-[15px] font-extrabold tracking-[0.06em] text-zup-bg">
              ZUP TECH
            </span>
          </div>
          <p className="max-w-[260px] text-[13px] leading-relaxed text-[#A7ACB5]">
            {copy.footerDescription}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#7A8089]">
            Contact
          </span>
          <a
            href={`tel:${contact.phone}`}
            className="text-sm text-[#D5D8DD] transition-colors hover:text-white"
          >
            {contact.phoneDisplay}
          </a>
          <a
            href={`mailto:${contact.email}`}
            className="text-sm text-[#D5D8DD] transition-colors hover:text-white"
          >
            {contact.email}
          </a>
          <address className="text-[13.5px] not-italic leading-normal text-[#A7ACB5]">
            {contact.street},
            <br />
            {contact.city} {contact.postalCode}, Bangladesh
          </address>
        </div>

        <nav className="flex flex-col gap-2.5" aria-label="Footer navigation">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#7A8089]">
            Company
          </span>
          <Link
            href="/shop"
            className="text-sm text-[#D5D8DD] transition-colors hover:text-white"
          >
            Shop
          </Link>
          <Link
            href="/services"
            className="text-sm text-[#D5D8DD] transition-colors hover:text-white"
          >
            Services
          </Link>
          <Link
            href="/industrial"
            className="text-sm text-[#D5D8DD] transition-colors hover:text-white"
          >
            Industrial
          </Link>
          <Link
            href="/contact"
            className="text-sm text-[#D5D8DD] transition-colors hover:text-white"
          >
            Contact
          </Link>
        </nav>
      </div>

      <div className="mx-auto mt-9 flex max-w-[1120px] flex-wrap justify-between gap-3 border-t border-white/8 pt-5">
        <span className="text-xs text-[#7A8089]">
          © {new Date().getFullYear()} ZUP TECH. All rights reserved.
        </span>
        <span className="flex gap-3 text-xs text-[#7A8089]">
          <a
            href={site.social.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            Facebook
          </a>
          ·
          <a
            href={site.social.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            YouTube
          </a>
          ·
          <a
            href={site.social.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            LinkedIn
          </a>
        </span>
      </div>
    </footer>
  );
}
