import Link from "next/link";
import { team } from "@/lib/team";

/**
 * Leadership roster.
 *
 * Per-member email and phone are deliberately NOT rendered: the values in
 * lib/team.ts are placeholders (sequential fake numbers), and publishing
 * fabricated contact details for named people is worse than publishing none.
 * Enquiries route through the one company contact form above instead. Restore
 * the direct links only once real, consented details are supplied.
 */
export function TeamGrid({ heading }: { heading: string }) {
  return (
    <section className="mt-9" aria-labelledby="team-heading">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-zup-orange">
        The team
      </span>
      <h2 id="team-heading" className="mb-1 text-lg font-bold">
        {heading}
      </h2>
      <p className="mb-5 text-[13.5px] text-zup-gray">
        The people who&apos;ll scope, build and support your project.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member) => (
          <div
            key={member.id}
            className="overflow-hidden rounded-[20px] border border-zup-body/6 bg-white"
          >
            <div
              className="flex aspect-[3/4] items-center justify-center bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_14px,#F6F7F9_14px_28px)]"
              role="img"
              aria-label={`Photo — ${member.name}, ${member.role}`}
            >
              <span className="rounded-lg bg-white/85 px-3 py-1.5 text-center font-mono text-[11px] leading-snug text-zup-faint">
                {member.imgHint}
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-[15px] font-bold">{member.name}</p>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-zup-orange">
                {member.role}
              </p>
              <p className="text-[13px] leading-relaxed text-zup-gray">{member.bio}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-zup-gray">
        To reach any of them,{" "}
        <Link href="#contact-form" className="font-semibold text-zup-blue hover:underline">
          send us a message
        </Link>{" "}
        and we&apos;ll route it to the right person.
      </p>
    </section>
  );
}
