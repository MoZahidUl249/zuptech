import Link from "next/link";
import type { ServiceCard } from "@/lib/api";

/**
 * Home-page row of admin-managed service cards.
 *
 * Closes the loop for the admin panel: cards added under Site content →
 * Services show up here, on /services and (for the industrial catalogue) on
 * /industrial. Renders nothing when the catalogue is empty, so an
 * unreachable backend leaves no empty heading behind.
 */
export function ServicesStrip({ services }: { services: ServiceCard[] }) {
  if (services.length === 0) return null;

  return (
    // The heading, the standfirst and the "All services" link are gone, so the
    // region names itself rather than pointing at a heading that no longer
    // exists — the cards are the whole section now.
    <section className="px-5 py-10" aria-label="Our services">
      <div className="mx-auto max-w-[1120px]">
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
