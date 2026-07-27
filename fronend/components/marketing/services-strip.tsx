import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ServiceCard } from "@/lib/api";

/**
 * Home-page row of admin-managed service cards.
 *
 * Closes the loop for the admin panel: cards added under Site content →
 * Services show up here, on /services and (for the industrial catalogue) on
 * /industrial. Renders nothing when the catalogue is empty, so an
 * unreachable backend leaves no empty heading behind.
 */
export function ServicesStrip({
  services,
  heading,
  subtitle,
}: {
  services: ServiceCard[];
  heading: string;
  subtitle: string;
}) {
  if (services.length === 0) return null;

  return (
    <section className="px-5 py-16" aria-labelledby="home-services-heading">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="home-services-heading"
              className="text-[clamp(24px,3.6vw,34px)] font-bold tracking-[-0.02em]"
            >
              {heading}
            </h2>
            {subtitle ? (
              <p className="mt-2 max-w-[640px] text-[15.5px] leading-relaxed text-zup-gray">
                {subtitle}
              </p>
            ) : null}
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 rounded-full border border-zup-body/14 px-5 py-2.5 text-[13.5px] font-bold text-zup-body transition-colors hover:bg-secondary"
          >
            All services
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={`/services#${s.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-zup-body/6 bg-white transition-shadow hover:shadow-[0_14px_34px_rgba(11,79,224,.14)]"
            >
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div
                  className="h-32 w-full bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_12px,#F6F7F9_12px_24px)]"
                  aria-hidden
                />
              )}
              <div className="flex flex-1 flex-col px-4 py-4">
                <h3 className="text-[15px] font-bold leading-snug text-zup-body group-hover:text-zup-blue">
                  {s.name}
                </h3>
                <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-zup-gray">
                  {s.dsc}
                </p>
                {s.features.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {s.features.slice(0, 3).map((f) => (
                      <li
                        key={f}
                        className="rounded-full bg-zup-blue/6 px-2.5 py-1 text-[11px] font-bold text-zup-blue"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
