"use client";

import { useState } from "react";
import type { ServiceCard } from "@/lib/api";
import { ServiceCardView } from "./service-card";
import { ConsultancyForm } from "./consultancy-form";
import { IndustrialConsultationForm } from "./industrial-consultation-form";

/**
 * The whole of /services and /industrial below the poster: the admin-managed
 * cards, then the form they book through.
 *
 * The two live in one client component because the card's button has to reach
 * the form's selection. The alternative — a server page rendering both and the
 * button poking at the DOM — is how a dropdown ends up showing one service
 * while the request carries another.
 *
 * `kind` picks both the wording and the form, because the two enquiries are
 * genuinely different: a home service visit (ServiceLead) versus a B2B project
 * enquiry (IndustrialLead, which asks for sector, scope and timeline).
 */
export function ServiceBooking({
  services,
  kind,
}: {
  services: ServiceCard[];
  kind: "services" | "industrial";
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const label = kind === "services" ? "Book service" : "Book consultation";
  const options = services.map((s) => ({ id: s.id, title: s.name }));

  /* Select the service, then take the visitor to the form.
   *
   * The scroll is done here rather than left to the `href="#book"` anchor
   * because the App Router swallows same-page hash navigation on this page —
   * the URL gains the hash and the viewport doesn't move, which reads as a
   * dead button. The href stays as the no-JS fallback and for middle-click. */
  const book = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    setServiceId(id);
    const form = document.getElementById("book");
    if (!form) return; // let the anchor try on its own
    e.preventDefault();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      form.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }

    // Ask for the animation, but make sure the visitor arrives either way:
    // some browsers (and every machine with smooth scrolling switched off at
    // the OS level) treat `behavior: "smooth"` as a no-op, and a booking
    // button that silently does nothing is worse than one that jumps.
    const from = window.scrollY;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      if (window.scrollY === from) form.scrollIntoView({ behavior: "instant", block: "start" });
    }, 150);
  };

  return (
    <>
      {services.length > 0 ? (
        <section className="px-5 py-12" aria-label="What we offer">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
            {/* No slice here, unlike the home page: this is the catalogue's
                own page, so it shows all of it. */}
            {services.map((s) => (
              <ServiceCardView
                key={s.id}
                service={s}
                action={{ label, href: "#book", onClick: book(s.id) }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Rendered even with no cards — an empty catalogue shouldn't close the
          only way to get in touch from this page. */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1120px]">
          {kind === "services" ? (
            <ConsultancyForm
              options={options}
              serviceId={serviceId}
              onServiceIdChange={setServiceId}
            />
          ) : (
            <IndustrialConsultationForm
              options={options}
              serviceId={serviceId}
              onServiceIdChange={setServiceId}
            />
          )}
        </div>
      </section>
    </>
  );
}
