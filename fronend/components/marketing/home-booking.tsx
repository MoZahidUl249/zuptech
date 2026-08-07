import type { ServiceCard } from "@/lib/api";
import { ConsultancyForm } from "./consultancy-form";
import { IndustrialConsultationForm } from "./industrial-consultation-form";

/**
 * Both enquiry routes, side by side, at the foot of the home page.
 *
 * The two forms are not variants of one another: the left books a home or
 * small-business service visit (a ServiceLead), the right opens a B2B project
 * enquiry (an IndustrialLead, which asks for sector, scope and timeline). Two
 * forms is the honest way to show that, and it saves the visitor a page load
 * to find whichever one they wanted.
 *
 * Both run in `compact` mode: their wide layout is a two-panel card, which
 * would fold to ~180px halves in a column this size.
 */
export function HomeBooking({
  services,
  industrialServices,
}: {
  services: ServiceCard[];
  industrialServices: ServiceCard[];
}) {
  return (
    <section className="px-5 py-10" aria-labelledby="home-booking-heading">
      <div className="mx-auto max-w-[1120px]">
        <h2
          id="home-booking-heading"
          className="mb-6 text-[clamp(22px,3.2vw,28px)] font-bold tracking-[-0.02em]"
        >
          Tell us what you need
        </h2>
        {/* Breaks at lg, not md: two forms at 384px each is worse than one
            after the other. */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <ConsultancyForm
            compact
            anchorId="book-service"
            options={services.map((s) => ({ id: s.id, title: s.name }))}
          />
          <IndustrialConsultationForm
            compact
            anchorId="book-consultation"
            options={industrialServices.map((s) => ({ id: s.id, title: s.name }))}
          />
        </div>
      </div>
    </section>
  );
}
