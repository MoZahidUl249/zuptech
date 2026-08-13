import Image from "next/image";
import type { TeamMember } from "@/lib/api";

/**
 * The people on the contact page.
 *
 * This replaces a roster of six invented staff that used to be hardcoded in
 * `lib/team.ts` and was deleted for that reason — publishing fabricated people
 * for a real business is worse than publishing none. Every row here is
 * admin-entered, and the section renders nothing until someone enters one, so
 * an empty list leaves the page exactly as it was.
 */
export function TeamStrip({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <section className="px-5 pt-10" aria-labelledby="team-heading">
      <div className="mx-auto max-w-[1120px]">
        <h2
          id="team-heading"
          className="mb-6 text-[clamp(20px,3vw,26px)] font-bold tracking-[-0.02em]"
        >
          Who you&apos;ll be talking to
        </h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {members.map((m) => (
            <article
              key={m.id}
              className="flex gap-4 rounded-[2px] border border-zup-body/6 bg-white p-4 sm:p-5"
            >
              {/* Fixed square, so a row of people lines up regardless of what
                  aspect ratio each photo was uploaded at. */}
              <div className="relative h-24 w-24 flex-none overflow-hidden rounded-2xl sm:h-28 sm:w-28">
                {m.photo ? (
                  <Image
                    src={m.photo}
                    alt={m.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_12px,#F6F7F9_12px_24px)]"
                    aria-hidden
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-bold leading-snug tracking-[-0.01em] text-zup-body">
                  {m.name}
                </h3>
                <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-zup-orange">
                  {m.role}
                </p>
                {m.bio ? (
                  <p className="mt-2 text-[13.5px] leading-relaxed text-zup-gray">{m.bio}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
