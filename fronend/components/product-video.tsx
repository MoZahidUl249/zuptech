"use client";

import { useState } from "react";
import { parseProductVideo } from "@/lib/video";
import { cn } from "@/lib/utils";

/**
 * The product promo video. Renders nothing when there isn't one, so callers
 * don't need their own emptiness check.
 *
 * A YouTube video is NOT embedded on load. It starts as a thumbnail with a
 * play button and only swaps in the iframe once clicked, so a product page
 * costs no YouTube script, connection or cookie for the majority of visitors
 * who never press play.
 */
export function ProductVideo({
  url,
  className,
  onPlayingChange,
}: {
  url?: string | null;
  className?: string;
  /**
   * Fires when playback starts or stops. The campaign gallery uses it to hold
   * its auto-advance while a clip is running — a slider that moves on from a
   * video part-way through is worse than one that never moves at all.
   */
  onPlayingChange?: (playing: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const video = parseProductVideo(url);
  if (!video) return null;

  // cn(), not a template literal: a caller passing `aspect-[4/3]` would
  // otherwise emit it alongside `aspect-video` and let stylesheet order pick
  // the winner instead of the caller.
  const frame = cn(
    "aspect-video w-full overflow-hidden rounded-[2px] border border-zup-body/6 bg-black",
    className,
  );

  if (video.kind === "file") {
    return (
      // preload="metadata", not "auto": uploads run to 300 MB, and streaming
      // one to every visitor on page load would be the heaviest thing here.
      <video
        src={video.url}
        controls
        playsInline
        preload="metadata"
        onPlay={() => onPlayingChange?.(true)}
        onPause={() => onPlayingChange?.(false)}
        onEnded={() => onPlayingChange?.(false)}
        className={frame}
      />
    );
  }

  if (playing) {
    return (
      <iframe
        src={`${video.embedUrl}?autoplay=1&rel=0`}
        title="Product video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={frame}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
        // No YouTube player API here, so "playing" is the click. It never goes
        // back to false — the iframe stays mounted, and a gallery that resumed
        // advancing because a viewer paused the clip would be the same bug.
        onPlayingChange?.(true);
      }}
      aria-label="Play product video"
      className={`group relative cursor-pointer ${frame}`}
    >
      {/* Plain <img>: one decorative thumbnail from a third-party host isn't
          worth adding i.ytimg.com to next/image's remotePatterns. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.thumbnailUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <span className="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover:bg-black/30">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
          <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-zup-body" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
