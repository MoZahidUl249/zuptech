import Link from "next/link";
import { Check } from "lucide-react";
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
        {/* One wide card per row rather than a four-up grid: the art gets a
            real half to itself instead of a 128px letterbox, and the copy gets
            the width to be read rather than clamped to three lines. */}
        <div className="flex flex-col gap-4">
          {services.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={`/services#${s.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-zup-body/6 bg-white transition-shadow hover:shadow-[0_14px_34px_rgba(11,79,224,.14)] sm:flex-row"
            >
              {/* Stacked on a phone, side-by-side from sm. `relative` + an
                  absolutely-filled image is what lets the art match the height
                  of whatever the copy comes to, instead of dictating it. */}
              <div className="relative h-44 w-full flex-none sm:h-auto sm:w-[38%] sm:min-h-[210px]">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div
                    className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_12px,#F6F7F9_12px_24px)]"
                    aria-hidden
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col justify-center px-5 py-5 sm:px-7 sm:py-6">
                <h3 className="text-[17px] font-bold leading-snug tracking-[-0.01em] text-zup-body group-hover:text-zup-blue sm:text-[19px]">
                  {s.name}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-zup-gray">{s.dsc}</p>
                {s.features.length > 0 ? (
                  <ul className="mt-3.5 flex flex-col gap-1.5">
                    {s.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13.5px] text-zup-body">
                        <Check
                          className="mt-0.5 h-4 w-4 flex-none text-zup-blue"
                          strokeWidth={2.4}
                          aria-hidden
                        />
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
