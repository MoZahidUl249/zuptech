"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductVideo } from "@/components/product-video";
import { usePrefersReducedMotion } from "@/components/marketing/hero-carousel";
import { cn } from "@/lib/utils";
import { isOptimizableImageSrc, looksLikeImageUrl } from "@/lib/images";

/** How long a photo holds before advancing. Matches the site hero's cadence. */
const ADVANCE_MS = 6000;
/** An unplayed video slide holds longer, so a thumbnail gets a fair look. */
const VIDEO_ADVANCE_MS = 12000;
/** Horizontal travel, in px, before a drag counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 50;

export interface CampaignMediaItem {
  /** A Cloudinary URL, or a pasted YouTube / direct-video link. */
  url: string;
  /**
   * What the server stored. A HINT here, not the last word — see `renderAs`.
   */
  kind: "image" | "video";
  /** Alt text for a photo. Blank falls back to the caller's `fallbackAlt`. */
  alt?: string;
}

/**
 * The campaign page's media slider — the "what's in the box" gallery, and the
 * quality block once it carries more than one photo.
 *
 * Structurally the same carousel as `HeroCarousel`: one translateX track, a
 * finger-following drag, arrows at every breakpoint, dots, keyboard arrows.
 * It is a separate component rather than a mode on that one because the
 * slides differ in the way that matters — a hero slide is decorative art
 * behind copy, and these are click-to-play media the visitor is meant to
 * inspect. `usePrefersReducedMotion` is imported from there rather than
 * duplicated.
 *
 * Renders nothing on an empty list, so callers need no emptiness check — the
 * same contract as `ProductVideo`.
 */
export function CampaignMediaCarousel({
  items,
  label,
  fallbackAlt,
  preloadFirst = false,
  className,
}: {
  items: CampaignMediaItem[];
  /** Accessible name for the region — pass the campaign's own section title. */
  label: string;
  /** Alt text for photos that carry none of their own. */
  fallbackAlt: string;
  /** Marks the first photo as the LCP candidate. */
  preloadFirst?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /**
   * A clip is running. Separate from `paused` because it does not clear on
   * mouse-leave: the visitor started a video and is watching it, whatever the
   * pointer is doing.
   */
  const [playing, setPlaying] = useState(false);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const id = useId();

  const count = items.length;
  const multi = count > 1;

  /*
   * What to actually render this slide as.
   *
   * The stored `kind` comes from sniffed bytes for an upload, which is
   * trustworthy — but a PASTED link was recorded as "video" whatever it was,
   * so rows exist that call a photo a clip. Letting an obvious picture win
   * over the stored value means those heal on the next page view instead of
   * needing a migration, and it costs nothing when the two agree.
   *
   * Only ever downgrades video → image. A URL with no extension stays
   * whatever the server said, because that is the YouTube case and the
   * server knows more than the path does.
   */
  const renderAs = (item: CampaignMediaItem): "image" | "video" =>
    looksLikeImageUrl(item.url) ? "image" : item.kind;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  // Clamp rather than correct in an effect: the admin can delete a slide while
  // the page is open, and re-rendering to fix state would cascade.
  const active = count > 0 ? index % count : 0;

  // Timed off the slide on screen: 6s cuts a video thumbnail short, and
  // holding every photo for 12s drags.
  const activeItem = items[active];
  const dwell = activeItem && renderAs(activeItem) === "video" ? VIDEO_ADVANCE_MS : ADVANCE_MS;

  useEffect(() => {
    // `playing` stops the timer outright rather than lengthening it. Advancing
    // off a clip someone pressed play on is the one thing this slider must
    // never do — a longer dwell only delays it.
    if (!multi || paused || playing || reduceMotion) return;
    // setTimeout, not setInterval: the delay changes per slide, and an
    // interval would keep firing at whatever cadence it was created with.
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), dwell);
    return () => clearTimeout(t);
  }, [count, multi, paused, playing, reduceMotion, dwell, index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!multi) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    }
  };

  const endDrag = () => {
    if (startX.current === null) return;
    if (Math.abs(drag) > SWIPE_THRESHOLD) go(active + (drag < 0 ? 1 : -1));
    startX.current = null;
    setDrag(0);
  };

  if (count === 0) return null;

  return (
    <section
      aria-label={label}
      aria-roledescription={multi ? "carousel" : undefined}
      tabIndex={multi ? 0 : undefined}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        if (!multi) return;
        setPaused(true);
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchMove={(e) => {
        if (startX.current === null) return;
        setDrag((e.touches[0]?.clientX ?? startX.current) - startX.current);
      }}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      className={cn(
        "relative overflow-hidden rounded-[2px] border border-zup-body/6 bg-black",
        multi &&
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        className,
      )}
    >
      {/* The track. Only this transforms — slides never move independently,
          which keeps the animation to one compositor layer. */}
      <div
        id={`${id}-track`}
        className={cn(
          "flex w-full",
          // No transition mid-drag, or the track lags the finger.
          drag === 0 && "transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
          "motion-reduce:transition-none",
        )}
        style={{ transform: `translate3d(calc(-${active * 100}% + ${drag}px), 0, 0)` }}
      >
        {items.map((item, i) => (
          <div
            key={`${item.url}-${i}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            /* A fixed box, so slides of different intrinsic sizes do not jump
               the page height as the track moves. */
            className="relative aspect-[4/3] w-full shrink-0 grow-0 basis-full"
          >
            {/* Off-screen slides must not be reachable — without this, tabbing
                past the gallery walks through play buttons nobody can see. */}
            <div className="h-full w-full" {...(i === active ? {} : { inert: true })}>
              {renderAs(item) === "video" ? (
                <div className="grid h-full w-full place-items-center bg-black">
                  <ProductVideo
                    url={item.url}
                    className="aspect-auto h-full rounded-none border-0"
                    onPlayingChange={setPlaying}
                  />
                </div>
              ) : (
                <Image
                  src={item.url}
                  alt={item.alt || fallbackAlt}
                  fill
                  sizes="(max-width: 760px) 100vw, 720px"
                  preload={preloadFirst && i === 0}
                  /* A pasted link can point anywhere, and next/image throws on
                     a host it was not configured for — which is a 500, not a
                     broken picture. */
                  unoptimized={!isOptimizableImageSrc(item.url)}
                  className="object-cover"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {multi ? (
        <>
          <CarouselArrow side="left" onClick={() => go(active - 1)} />
          <CarouselArrow side="right" onClick={() => go(active + 1)} />

          {/* Announces the change for screen readers without moving focus. */}
          <p aria-live="polite" aria-atomic className="sr-only">
            Slide {active + 1} of {count}
          </p>

          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={`${item.url}-${i}-dot`}
                type="button"
                aria-label={`Go to slide ${i + 1} of ${count}`}
                aria-current={i === active}
                aria-controls={`${id}-track`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  i === active ? "w-6 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function CarouselArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      className={cn(
        // Shown at every breakpoint: on a phone these are the only visible
        // sign the gallery has more than one thing in it.
        "absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-colors hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
