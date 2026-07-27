import Link from "next/link";

/** Dark "Ready to Power Your Project?"-style closing CTA, reused on Home and
 *  Services with different copy/button per the design. */
export function CtaBanner({
  heading,
  subtext,
  buttonLabel,
  href,
}: {
  heading: string;
  subtext: string;
  buttonLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-3xl bg-zup-ink px-6 py-9 sm:px-10 sm:py-11">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="max-w-[560px]">
          <h2 className="mb-2 text-[clamp(22px,3.2vw,30px)] font-bold leading-tight tracking-[-0.02em] text-zup-bg">
            {heading}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-[#A7ACB5]">{subtext}</p>
        </div>
        <Link
          href={href}
          className="flex-none rounded-full bg-zup-orange px-7 py-[15px] text-sm font-bold uppercase tracking-[0.04em] text-white shadow-[0_8px_24px_rgba(232,83,32,.28)] transition-colors hover:bg-zup-orange-dark"
        >
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}
