"use client";

import { useRef } from "react";

/**
 * The main product photo, magnified under the cursor.
 *
 * Desktop only, and deliberately gated on the input device rather than the
 * viewport: `(hover: hover) and (pointer: fine)` is the question that actually
 * matters. A phone in landscape is wide enough for a `md:` breakpoint but has
 * no cursor to follow, and a tap would leave the image stuck at 2.2× with no
 * way to un-hover it. A tablet with a trackpad, meanwhile, should get the
 * effect even though it is narrow. The CSS carries that whole decision, so no
 * JavaScript runs on a touch device beyond an ignored listener.
 *
 * Note the underscores in the variant: Tailwind reads `_` as a space, and a
 * media query needs real spaces around `and`. Written without them the
 * condition is `(hover:hover)and(pointer:fine)`, which is not valid CSS — the
 * rule is dropped silently at build time and the zoom simply never happens.
 *
 * The cursor position is written straight to `transform-origin` on the node,
 * not held in React state. State here would re-render the tree on every
 * mousemove — dozens of renders a second to move one CSS value the browser
 * can animate on the compositor by itself.
 */
export function ProductPhotoZoom({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  const follow = (e: React.MouseEvent<HTMLDivElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
  };

  /* Back to the middle on the way out, so the shrink animates from wherever
     the cursor left rather than snapping to a corner first. */
  const recentre = () => {
    const img = imgRef.current;
    if (img) img.style.transformOrigin = "50% 50%";
  };

  return (
    <div
      onMouseMove={follow}
      onMouseLeave={recentre}
      className={`group relative overflow-hidden ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- admin uploads
          come from arbitrary origins, so next/image optimisation doesn't
          apply; this matches the rest of the gallery. */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[2.2] [@media(hover:hover)_and_(pointer:fine)]:group-hover:duration-150"
      />

      {/* A quiet affordance — nobody hovers an image they don't expect to do
          anything. Hidden from the same devices that don't get the zoom. */}
      <span className="pointer-events-none absolute bottom-2 right-2 hidden rounded-[2px] bg-black/55 px-2 py-1 text-[11px] font-semibold text-white transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:block [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-0">
        Hover to zoom
      </span>
    </div>
  );
}
