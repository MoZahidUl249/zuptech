"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isOptimizableImageSrc } from "@/lib/images";

/** How long a still slide holds before advancing. */
const ADVANCE_MS = 6000;
/** Video slides hold longer, so a clip gets seen rather than cut off. */
const VIDEO_ADVANCE_MS = 12000;
/** Horizontal travel, in px, before a drag counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 50;

export interface HeroCarouselSlide {
  id: string;
  image: string | null;
  /** "video" plays the media inline, muted and looping. Defaults to a still. */
  mediaType?: "image" | "video";
  /** Empty string means decorative — the slide is then aria-hidden from the list. */
  alt?: string;
  /** Optional click-through. With `cta` it renders a button; without, the whole slide links. */
  href?: string;
  cta?: string;
  fit?: "cover" | "contain";
  /** CSS background behind a `contain` image. */
  bg?: string;
}

/**
 * The one hero carousel. Every page's hero art runs through this: the homepage
 * promo banners and the per-page poster sets, which used to be two separate
 * hand-rolled cross-fades that had drifted apart (different markup, different
 * controls, the same 6000ms written twice).
 *
 * Slides move on a translateX track rather than cross-fading, so the motion
 * reads as a carousel and a drag can follow the finger. Everything is driven
 * from `index`; the track is the only thing that animates.
 *
 * `decorative` renders the art as a background layer: no controls, hidden from
 * assistive tech, no pointer events. That is how the page-hero backdrops use
 * it, since the page's real heading sits on top and must stay the accessible
 * one.
 */
export function HeroCarousel({
  slides,
  label,
  decorative = false,
  priorityFirst = false,
  className,
  overlayOpacity,
}: {
  slides: HeroCarouselSlide[];
  /** Accessible name for the region. Ignored when `decorative`. */
  label?: string;
  decorative?: boolean;
  /** Marks the first image as the LCP candidate. */
  priorityFirst?: boolean;
  className?: string;
  /** 0–1 dark scrim over the art, so overlaid copy stays readable. */
  overlayOpacity?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [drag, setDrag] = useState(0);
  /**
   * Slides whose art 404ed, by id.
   *
   * A hero image can stop resolving without anything on this page knowing:
   * the row still holds a URL, the request still returns 200, and the banner
   * renders as white space. That is not hypothetical — it was live on
   * zupplus.com for days, blank above the fold, while the server logged
   * `upstream image response failed … 404` on every render and nobody was
   * reading the logs.
   */
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const startX = useRef<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const id = useId();

  /*
   * A slide with no art is worth less than no slide at all, so a failed one
   * leaves the rotation — arrows, dots, timer and all, because everything
   * below counts off THIS list rather than the prop.
   *
   * Unless they all failed. Then keep them: their copy and buttons are still
   * real, and an empty hero would turn one broken picture into a missing
   * section. Falling back to the prop also means a transient network blip
   * cannot empty the banner.
   */
  const usable = slides.filter((s) => !failed.has(s.id));
  const shown = usable.length > 0 ? usable : slides;

  const count = shown.length;
  const multi = count > 1;
  // Controls only make sense on an interactive carousel with somewhere to go.
  const interactive = multi && !decorative;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  /** Idempotent: the same slide can report failure on every re-render. */
  const markFailed = useCallback((slideId: string) => {
    setFailed((prev) => {
      if (prev.has(slideId)) return prev;
      const next = new Set(prev);
      next.add(slideId);
      return next;
    });
  }, []);

  // Timed off the slide on screen, not a fixed cadence: a 6s hold cuts a video
  // off part-way, and holding every still for 12s would drag.
  const dwell =
    shown[count > 0 ? index % count : 0]?.mediaType === "video"
      ? VIDEO_ADVANCE_MS
      : ADVANCE_MS;

  useEffect(() => {
    // No auto-advance under prefers-reduced-motion. That used to mean the
    // visitor never saw past slide one, because the arrows were desktop-only;
    // they render at every breakpoint now, so stopping the timer costs nothing.
    if (!multi || paused || reduceMotion) return;
    // setTimeout, not setInterval: the delay changes per slide, and an
    // interval would keep firing at whatever cadence it was created with.
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), dwell);
    return () => clearTimeout(t);
  }, [count, multi, paused, reduceMotion, dwell, index]);

  // Clamp rather than correct in an effect: the admin can delete slides while
  // the page is open, and re-rendering to fix state would cascade.
  const active = count > 0 ? index % count : 0;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
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
      {...(decorative
        ? { "aria-hidden": true as const }
        : {
            "aria-label": label,
            "aria-roledescription": multi ? "carousel" : undefined,
            tabIndex: multi ? 0 : undefined,
            onKeyDown,
          })}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        if (!interactive) return;
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchMove={(e) => {
        if (startX.current === null) return;
        setDrag((e.touches[0]?.clientX ?? startX.current) - startX.current);
      }}
      onTouchEnd={endDrag}
      onTouchCancel={endDrag}
      className={cn(
        "relative overflow-hidden",
        decorative && "pointer-events-none",
        !decorative && multi && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        className,
      )}
    >
      {/* The track. Only this transforms — slides themselves never move
          independently, which keeps the animation to one compositor layer. */}
      <div
        id={`${id}-track`}
        className={cn(
          "flex h-full w-full",
          // No transition mid-drag, or the track lags the finger.
          drag === 0 && "transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
          "motion-reduce:transition-none",
        )}
        style={{ transform: `translate3d(calc(-${active * 100}% + ${drag}px), 0, 0)` }}
      >
        {shown.map((s, i) => (
          <div
            key={s.id}
            role={decorative ? undefined : "group"}
            aria-roledescription={decorative ? undefined : "slide"}
            aria-label={decorative ? undefined : `${i + 1} of ${count}`}
            style={{ background: s.bg || undefined }}
            className="relative h-full w-full shrink-0 grow-0 basis-full"
          >
            {s.image && s.mediaType === "video" ? (
              <SlideVideo
                src={s.image}
                active={i === active}
                reduceMotion={reduceMotion}
                fit={s.fit ?? "cover"}
                onFailed={() => markFailed(s.id)}
              />
            ) : s.image ? (
              <Image
                src={s.image}
                alt={s.alt ?? ""}
                fill
                priority={priorityFirst && i === 0}
                sizes="100vw"
                /* A URL outside next/image's allow-list does not render a
                   broken picture — the loader THROWS, and in a server tree
                   that is a 500 for the whole page. Serving it unoptimised
                   is worse than optimised and far better than a dead site,
                   which is what a Cloudinary account migration or a wrong
                   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME would otherwise cause. */
                unoptimized={!isOptimizableImageSrc(s.image)}
                onError={() => markFailed(s.id)}
                className={cn(
                  (s.fit ?? "cover") === "contain" ? "object-contain" : "object-cover",
                )}
              />
            ) : null}

            {/* Scrim lives per-slide so it travels with the art. */}
            {overlayOpacity ? (
              <div
                className="absolute inset-0 bg-zup-ink"
                style={{ opacity: overlayOpacity }}
              />
            ) : null}

            {!decorative && s.cta ? (
              <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 sm:justify-start sm:p-8">
                <Link
                  href={s.href || "/products"}
                  // Off-screen slides must not be tab stops.
                  tabIndex={i === active ? 0 : -1}
                  aria-hidden={i !== active}
                  className="inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-bold text-zup-body shadow-lg transition-colors hover:bg-zup-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {s.cta}
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {interactive ? (
        <>
          <CarouselArrow side="left" onClick={() => go(active - 1)} />
          <CarouselArrow side="right" onClick={() => go(active + 1)} />

          {/* Announces the change for screen readers without moving focus. */}
          <p aria-live="polite" aria-atomic className="sr-only">
            Slide {active + 1} of {count}
          </p>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {shown.map((s, i) => (
              <button
                key={s.id}
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

/**
 * Playback is driven from an effect, not the `autoPlay` attribute.
 *
 * `autoPlay` is only consulted while the element is loading its source, so a
 * video slide that isn't the first one mounts inactive and never starts: React
 * flips the attribute when the slide comes round, the browser ignores it, and
 * the slide sits on a frozen first frame. The reverse costs too — a clip that
 * did start keeps decoding for the whole session while three slides away.
 *
 * So: play when the slide is on screen, pause and rewind when it leaves, so
 * each visit to the slide starts the clip from the top.
 */
function SlideVideo({
  src,
  active,
  reduceMotion,
  fit,
  onFailed,
}: {
  src: string;
  active: boolean;
  reduceMotion: boolean;
  fit: "cover" | "contain";
  /** Fires when the clip cannot be decoded — same blank frame as a dead image. */
  onFailed: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  /*
   * Same stall guard as ProductVideo: a clip whose file has gone can sit at
   * HAVE_NOTHING without ever firing `error`, which would leave this slide as
   * a blank frame in the rotation — the thing this whole change is about.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current?.readyState === 0) onFailed();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onFailed]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Under reduced motion the clip is left paused on its first frame, which
    // reads as a still rather than as nothing.
    if (active && !reduceMotion) {
      // Rejects on a backgrounded tab or if the policy declines despite the
      // mute — there is nothing to recover, and the frame on screen is fine.
      void el.play().catch(() => {});
      return;
    }
    el.pause();
    if (!active) el.currentTime = 0;
  }, [active, reduceMotion]);

  return (
    <video
      ref={ref}
      src={src}
      // Muted + inline is what browsers require before they will play without
      // a gesture at all; a hero clip that needed a click would just sit there
      // as a black rectangle.
      muted
      loop
      playsInline
      // Only the metadata up front — play() fetches the rest when the slide is
      // actually reached, so three off-screen clips cost nothing on load.
      preload="metadata"
      onError={onFailed}
      aria-hidden
      className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
    />
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
        // Shown at every breakpoint — these used to be desktop-only, which left
        // mobile with no way back to a slide the timer had already passed.
        "absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-colors hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Subscribed rather than mirrored into state — a media query is an external
 * store, and reading it inside an effect means setting state during the effect
 * body (which react-hooks/set-state-in-effect rightly flags). Same approach as
 * lib/admin-bridge.ts.
 *
 * The server snapshot is `false`: the preference isn't knowable during SSR, and
 * assuming "motion is fine" keeps the markup identical for everyone. The client
 * corrects it on hydration, before the first 6s tick.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}
