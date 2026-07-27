import { BadgeCheck, ShieldCheck, Truck, Wrench } from "lucide-react";

/**
 * Credibility band under the hero. Deliberately static: these are standing
 * promises about how the business operates, not campaign copy, and none of it
 * has a backend model. Nothing here asserts a number that isn't verifiable.
 */
const POINTS = [
  {
    icon: BadgeCheck,
    title: "Engineered hardware",
    detail: "Specified and tested for Bangladeshi grid conditions",
  },
  {
    icon: ShieldCheck,
    title: "Service warranty",
    detail: "Backed by our own engineers, not a third party",
  },
  {
    icon: Truck,
    title: "Nationwide delivery",
    detail: "Inside and outside Dhaka, with tracked dispatch",
  },
  {
    icon: Wrench,
    title: "Certified installation",
    detail: "Fitted and commissioned by qualified technicians",
  },
];

export function TrustStrip() {
  return (
    <section className="px-5 py-10" aria-label="Why buy from ZUP TECH">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(({ icon: Icon, title, detail }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-2xl border border-zup-body/6 bg-white px-4 py-4"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-zup-blue/8 text-zup-blue">
              <Icon className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h3 className="text-[14px] font-bold text-zup-body">{title}</h3>
              <p className="mt-0.5 text-[12.5px] leading-snug text-zup-gray">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
