import Image from "next/image";
import { Check } from "lucide-react";
import type { ServiceBulletStyle, ServiceCard } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The marker in front of a feature line.
 *
 * All three keep the same 16px box so the text baseline doesn't shift when the
 * style changes — "plain" reserves the space rather than removing it, which is
 * what stops a plain card's copy from sitting proud of a ticked one beside it.
 */
function FeatureMarker({ style }: { style: ServiceBulletStyle }) {
  if (style === "tick") {
    return <Check className="mt-0.5 h-4 w-4 flex-none text-zup-blue" strokeWidth={2.4} aria-hidden />;
  }
  if (style === "dot") {
    return (
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-zup-blue" />
      </span>
    );
  }
  return <span className="mt-0.5 h-4 w-1 flex-none" aria-hidden />;
}

/**
 * One service card, as it ships.
 *
 * Shared on purpose: the home page renders this, and so does the admin's
 * service editor as its live preview. A preview built from its own markup
 * drifts from the real card the first time either side is touched, and then
 * the admin is editing something nobody sees.
 *
 * The card is a portfolio tile, not a link. It used to wrap the whole row in
 * `/services#<slug>`, but that page has no element carrying those ids, so
 * every click was a page load that landed at the top of somewhere else. The
 * optional `action` is the one interactive thing on it — /services and
 * /industrial pass a booking button, the home page and the admin preview
 * don't, so the tile stays a tile everywhere else.
 */
export function ServiceCardView({
  service,
  unoptimizedImage,
  className,
  action,
}: {
  service: ServiceCard;
  /** Skip the image optimizer — what the admin screens do for uploaded media. */
  unoptimizedImage?: boolean;
  className?: string;
  /** Booking button under the features. Omitted, nothing renders. */
  action?: {
    label: string;
    href: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  };
}) {
  return (
    <article
      className={cn(
        "grid overflow-hidden rounded-2xl border border-zup-body/6 bg-white md:grid-cols-2",
        className,
      )}
    >
      {/* Exactly half the card from md up, and a fixed shape at both sizes, so
          the art is a photograph rather than whatever strip the copy beside it
          happens to leave over. `relative` is what `fill` needs. */}
      <div
        className={cn(
          "relative aspect-[16/9] w-full md:aspect-[4/3]",
          service.imageSide === "right" && "md:order-2",
        )}
      >
        {service.image ? (
          <Image
            src={service.image}
            alt={service.name}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            unoptimized={unoptimizedImage}
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,#EFF1F4_0_12px,#F6F7F9_12px_24px)]"
            aria-hidden
          />
        )}
      </div>

      <div className="flex flex-col justify-center px-5 py-5 sm:px-7 sm:py-7 md:px-8">
        <h3 className="text-[18px] font-bold leading-snug tracking-[-0.01em] text-zup-body sm:text-[21px]">
          {service.name}
        </h3>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-zup-gray">{service.dsc}</p>
        {service.features.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-1.5">
            {service.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13.5px] text-zup-body">
                <FeatureMarker style={service.bulletStyle} />
                {f}
              </li>
            ))}
          </ul>
        ) : null}

        {/* An anchor rather than a button: it points at the form's id, so it
            works before hydration and picks up the form's scroll-mt. The
            onClick only preselects the service on the way down. */}
        {action ? (
          <a
            href={action.href}
            onClick={action.onClick}
            className="mt-5 inline-flex w-fit items-center rounded-full bg-zup-blue px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-zup-blue-dark"
          >
            {action.label}
          </a>
        ) : null}
      </div>
    </article>
  );
}
