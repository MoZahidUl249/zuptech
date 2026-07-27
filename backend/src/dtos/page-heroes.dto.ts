import { t } from "elysia";
import { PAGE_HERO_KEYS, PAGE_HERO_MODES } from "../lib/rules";

/**
 * Per-page hero art (background image or a rotating poster list).
 *
 * Image URLs are never accepted from the client as free text — they come back
 * from the dedicated multipart upload endpoints, which proxy to the
 * media-storage service. The only URL-ish field a client sets directly is a
 * poster's optional `href` click-through.
 */

export const pageHeroKeyDto = t.Union(PAGE_HERO_KEYS.map((k) => t.Literal(k)));
export const pageHeroModeDto = t.Union(PAGE_HERO_MODES.map((m) => t.Literal(m)));

export const updatePageHeroDto = t.Object({
  mode: pageHeroModeDto,
  overlay: t.Integer({ minimum: 0, maximum: 100 }),
  // "" clears the background; otherwise it must be a URL we handed out.
  background: t.Optional(t.String({ maxLength: 2000 })),
});

/** Poster metadata. The image itself is replaced via re-upload, not here. */
export const updateHeroPosterDto = t.Object({
  alt: t.Optional(t.String({ maxLength: 300 })),
  href: t.Optional(t.String({ maxLength: 2000, pattern: "^$|^/|^https?://\\S+$" })),
  sort: t.Optional(t.Integer({ minimum: 0, maximum: 999 })),
});

/** Whole-list reorder — sent as the ordered id array after a drag. */
export const reorderHeroPostersDto = t.Object({
  ids: t.Array(t.String({ maxLength: 50 }), { maxItems: 20 }),
});

export const uploadHeroImageDto = t.Object({
  file: t.File({ type: "image", maxSize: "8m" }),
});

export type UpdatePageHeroDto = typeof updatePageHeroDto.static;
export type UpdateHeroPosterDto = typeof updateHeroPosterDto.static;
export type ReorderHeroPostersDto = typeof reorderHeroPostersDto.static;
export type UploadHeroImageDto = typeof uploadHeroImageDto.static;
