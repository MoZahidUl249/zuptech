import { Elysia } from "elysia";
import {
  reorderHeroPostersDto,
  updateHeroPosterDto,
  updatePageHeroDto,
  uploadHeroImageDto,
} from "../../dtos/page-heroes.dto";
import { prisma } from "../../lib/db";
import { badRequest, notFound } from "../../lib/http";
import { assertCan } from "../../lib/rbac";
import { PAGE_HERO_KEYS, type PageHeroKey } from "../../lib/rules";
import { toPageHero } from "../../lib/serialize";
import { deleteMediaByUrl, uploadMedia } from "../../lib/storage";
import { staffGuard } from "./guard";

/**
 * Per-page hero art (`sitecontent` module).
 *
 * Rows are created lazily: a page that has never been edited has no row, and
 * both the admin and the storefront fall back to the frontend's built-in
 * design. `ensureHero` is therefore an upsert, so the admin never has to
 * "create" a hero before editing one.
 */

const posterInclude = { posters: { orderBy: { sort: "asc" as const } } };

function assertKey(key: string): PageHeroKey {
  if (!(PAGE_HERO_KEYS as readonly string[]).includes(key)) {
    throw badRequest(`Unknown page: ${key}. Expected one of ${PAGE_HERO_KEYS.join(", ")}`);
  }
  return key as PageHeroKey;
}

async function ensureHero(pageKey: PageHeroKey) {
  return prisma.pageHero.upsert({
    where: { pageKey },
    create: { pageKey },
    update: {},
    include: posterInclude,
  });
}

/** The storage service keeps the bytes; dropping the row alone would leak
 *  them. Failures are swallowed — a stranded file must not block the edit. */
async function forgetImage(url: string) {
  if (!url) return;
  await deleteMediaByUrl(url).catch(() => {});
}

export const adminPageHeroes = new Elysia({
  name: "routes/admin/page-heroes",
  detail: { tags: ["Admin · Page heroes"] },
})
  .use(staffGuard)

  .get("/admin/api/page-heroes", async ({ staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "view");
    const heroes = await prisma.pageHero.findMany({ include: posterInclude });
    const byKey = new Map(heroes.map((h) => [h.pageKey, h]));
    // Always return the full set, defaulting the untouched ones, so the admin
    // can render an editor per page without a create step.
    return PAGE_HERO_KEYS.map((pageKey) => {
      const row = byKey.get(pageKey);
      return row
        ? toPageHero(row)
        : { pageKey, mode: "plain", background: "", overlay: 55, posters: [] };
    });
  })

  .put(
    "/admin/api/page-heroes/:pageKey",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const pageKey = assertKey(params.pageKey);
      const existing = await ensureHero(pageKey);

      // Clearing the background should also release its bytes.
      if (body.background !== undefined && body.background !== existing.background) {
        await forgetImage(existing.background);
      }

      const hero = await prisma.pageHero.update({
        where: { pageKey },
        data: {
          mode: body.mode,
          overlay: body.overlay,
          ...(body.background === undefined ? {} : { background: body.background }),
        },
        include: posterInclude,
      });
      return toPageHero(hero);
    },
    { body: updatePageHeroDto },
  )

  .post(
    "/admin/api/page-heroes/:pageKey/background",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const pageKey = assertKey(params.pageKey);
      const existing = await ensureHero(pageKey);

      const media = await uploadMedia(body.file, "pagehero", pageKey, 0);
      await forgetImage(existing.background);

      const hero = await prisma.pageHero.update({
        where: { pageKey },
        // Uploading a background is the act of choosing one, so switch the
        // mode too rather than leaving the admin with an invisible image.
        data: { background: media.url, mode: "image" },
        include: posterInclude,
      });
      return toPageHero(hero);
    },
    { body: uploadHeroImageDto },
  )

  /* ===== Posters ===== */

  .post(
    "/admin/api/page-heroes/:pageKey/posters",
    async ({ params, body, set, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const pageKey = assertKey(params.pageKey);
      const hero = await ensureHero(pageKey);

      const media = await uploadMedia(body.file, "heroposter", crypto.randomUUID(), 0);

      await prisma.heroPoster.create({
        data: {
          heroId: hero.id,
          image: media.url,
          // Append: one past the current last, so an upload never displaces
          // an existing poster's position.
          sort: hero.posters.length,
        },
      });

      const updated = await prisma.pageHero.update({
        where: { pageKey },
        data: { mode: "posters" },
        include: posterInclude,
      });
      set.status = 201;
      return toPageHero(updated);
    },
    { body: uploadHeroImageDto },
  )

  .patch(
    "/admin/api/hero-posters/:id",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const poster = await prisma.heroPoster.findUnique({ where: { id: params.id } });
      if (!poster) throw notFound("Poster");
      await prisma.heroPoster.update({ where: { id: params.id }, data: body });

      const hero = await prisma.pageHero.findUniqueOrThrow({
        where: { id: poster.heroId },
        include: posterInclude,
      });
      return toPageHero(hero);
    },
    { body: updateHeroPosterDto },
  )

  .delete("/admin/api/hero-posters/:id", async ({ params, staffCtx }) => {
    assertCan(staffCtx, "sitecontent", "manage");
    const poster = await prisma.heroPoster.findUnique({ where: { id: params.id } });
    if (!poster) throw notFound("Poster");

    await prisma.heroPoster.delete({ where: { id: params.id } });
    await forgetImage(poster.image);

    const hero = await prisma.pageHero.findUniqueOrThrow({
      where: { id: poster.heroId },
      include: posterInclude,
    });
    return toPageHero(hero);
  })

  .put(
    "/admin/api/page-heroes/:pageKey/posters/order",
    async ({ params, body, staffCtx }) => {
      assertCan(staffCtx, "sitecontent", "manage");
      const pageKey = assertKey(params.pageKey);
      const hero = await ensureHero(pageKey);

      // Only reorder posters that actually belong to this hero — an id from
      // another page would otherwise be silently rewritten.
      const own = new Set(hero.posters.map((p) => p.id));
      const ids = body.ids.filter((id) => own.has(id));
      if (ids.length !== hero.posters.length) {
        throw badRequest("Reorder must list every poster on this hero exactly once");
      }

      await prisma.$transaction(
        ids.map((id, sort) => prisma.heroPoster.update({ where: { id }, data: { sort } })),
      );

      const updated = await prisma.pageHero.findUniqueOrThrow({
        where: { pageKey },
        include: posterInclude,
      });
      return toPageHero(updated);
    },
    { body: reorderHeroPostersDto },
  );
