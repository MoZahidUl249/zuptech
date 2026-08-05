"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImageIcon, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import {
  PAGE_HERO_KEYS,
  deleteHeroPoster,
  getPageHeroes,
  patchHeroPoster,
  putPageHero,
  reorderHeroPosters,
  uploadHeroBackground,
  uploadHeroPoster,
  type PageHero,
  type PageHeroMode,
} from "@/lib/admin-api";
import { Card, Field, Segmented, BtnGhost, inputCls } from "./ui";

/**
 * Hero art for every page (`sitecontent` module).
 *
 * Kept out of the big AdminState diff-sync engine: uploads are multipart and
 * the server answers each one with the whole updated hero, so this screen
 * drives its own state off those responses rather than round-tripping through
 * a whole-state save.
 */

const PAGE_LABELS: Record<string, string> = {
  home: "Home page",
  shop: "Shop",
  services: "Services",
  industrial: "Industrial",
  contact: "Contact",
};

const MODES: { value: PageHeroMode; label: string }[] = [
  { value: "plain", label: "Built-in" },
  { value: "image", label: "Background" },
  { value: "posters", label: "Posters" },
];

export function PageHeroesSection() {
  const { can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";
  const [heroes, setHeroes] = useState<PageHero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Same shape as lib/admin-landing-pages.ts: a .then/.catch chain rather
  // than async/await, so no setState runs synchronously in the effect body —
  // which is what react-hooks/set-state-in-effect flags. The signal keeps a
  // response from a torn-down mount from writing state.
  const load = useCallback((signal?: AbortSignal) => {
    return getPageHeroes()
      .then((data) => {
        if (signal?.aborted) return;
        setHeroes(data);
        setError(false);
      })
      .catch(() => {
        if (!signal?.aborted) setError(true);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Every mutation returns the updated hero, so patch it in place rather than
  // refetching the whole set and losing scroll position.
  const merge = (hero: PageHero) =>
    setHeroes((hs) => hs.map((h) => (h.pageKey === hero.pageKey ? hero : h)));

  if (loading) return <Card className="px-6 py-8 text-sm text-zup-gray">Loading heroes…</Card>;
  if (error) {
    return (
      <Card className="px-6 py-8 text-sm text-destructive">Couldn&apos;t load page heroes.</Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="px-5 py-5 sm:px-6">
        <h2 className="text-ui-base font-bold">Page heroes</h2>
        <p className="mt-0.5 text-ui-sm text-zup-gray">
          The art behind each page&apos;s headline. <b>Built-in</b> keeps the coded
          design, <b>Background</b> shows one image, and <b>Posters</b> rotates through
          several. The overlay darkens the art so the headline stays readable.
        </p>
      </Card>

      {PAGE_HERO_KEYS.map((key) => {
        const hero = heroes.find((h) => h.pageKey === key);
        if (!hero) return null;
        return (
          <HeroEditor
            key={key}
            hero={hero}
            readOnly={readOnly}
            onChange={merge}
          />
        );
      })}
    </div>
  );
}

function HeroEditor({
  hero,
  readOnly,
  onChange,
}: {
  hero: PageHero;
  readOnly: boolean;
  onChange: (h: PageHero) => void;
}) {
  const bgInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<PageHero>, ok: string) => {
    setBusy(true);
    try {
      onChange(await fn());
      toast(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const setMode = (mode: PageHeroMode) =>
    run(() => putPageHero(hero.pageKey, { mode, overlay: hero.overlay }), `${PAGE_LABELS[hero.pageKey]} → ${mode}`);

  const move = (index: number, delta: number) => {
    const ids = hero.posters.map((p) => p.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void run(() => reorderHeroPosters(hero.pageKey, ids), "Posters reordered");
  };

  const disabled = readOnly || busy;

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-ui-base font-bold">{PAGE_LABELS[hero.pageKey] ?? hero.pageKey}</h3>
        <Segmented
          options={MODES}
          value={hero.mode}
          disabled={disabled}
          onChange={(m) => void setMode(m)}
        />
      </div>

      {hero.mode === "plain" ? (
        <p className="mt-3 text-ui-sm text-zup-soft">
          Using the built-in design. Pick <b>Background</b> or <b>Posters</b> to add art.
        </p>
      ) : (
        <>
          <Field label={`Overlay — ${hero.overlay}% dark`} className="mt-4 max-w-[320px]">
            <input
              type="range"
              min={0}
              max={100}
              value={hero.overlay}
              disabled={disabled}
              // Commit on release, not on every drag frame — a slider fires
              // dozens of input events and each one is a PUT.
              onChange={(e) =>
                onChange({ ...hero, overlay: Number(e.target.value) })
              }
              // Mouse-up alone lost the change for anyone on a touch screen or
              // using the keyboard: the value moved on screen and was never
              // PUT, so it silently reverted on reload.
              onPointerUp={(e) =>
                void run(
                  () =>
                    putPageHero(hero.pageKey, {
                      mode: hero.mode,
                      overlay: Number((e.target as HTMLInputElement).value),
                    }),
                  "Overlay saved",
                )
              }
              onKeyUp={(e) =>
                void run(
                  () =>
                    putPageHero(hero.pageKey, {
                      mode: hero.mode,
                      overlay: Number((e.target as HTMLInputElement).value),
                    }),
                  "Overlay saved",
                )
              }
              className="w-full"
            />
          </Field>

          {hero.mode === "image" ? (
            <div className="mt-4">
              <p className="mb-2 text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
                Background image
              </p>
              {hero.background ? (
                <div className="relative h-40 w-full max-w-[520px] overflow-hidden rounded-xl">
                  <Image
                    src={hero.background}
                    alt=""
                    fill
                    sizes="520px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <p className="text-ui-sm text-zup-soft">No image yet.</p>
              )}
              <input
                ref={bgInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset so re-picking the same file still fires onChange.
                  e.target.value = "";
                  if (file) {
                    void run(() => uploadHeroBackground(hero.pageKey, file), "Background updated");
                  }
                }}
              />
              <BtnGhost
                onClick={() => bgInput.current?.click()}
                disabled={disabled}
                className="mt-3"
              >
                <ImageIcon className="h-4 w-4" aria-hidden />
                {hero.background ? "Replace image" : "Upload image"}
              </BtnGhost>
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-ui-micro font-bold uppercase tracking-[0.06em] text-zup-soft">
                Posters ({hero.posters.length})
              </p>
              {hero.posters.length === 0 ? (
                <p className="text-ui-sm text-zup-soft">No posters yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {hero.posters.map((poster, i) => (
                    <li
                      key={poster.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-zup-body/6 p-3"
                    >
                      <div className="relative h-16 w-28 flex-none overflow-hidden rounded-lg">
                        <Image
                          src={poster.image}
                          alt=""
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                        <input
                          defaultValue={poster.alt}
                          disabled={disabled}
                          placeholder="Alt text (leave blank if decorative)"
                          // Save on blur: typing shouldn't PATCH per keystroke.
                          onBlur={(e) => {
                            if (e.target.value !== poster.alt) {
                              void run(
                                () => patchHeroPoster(poster.id, { alt: e.target.value }),
                                "Alt text saved",
                              );
                            }
                          }}
                          className={inputCls}
                        />
                        <input
                          defaultValue={poster.href}
                          disabled={disabled}
                          placeholder="Link (optional) — /shop or https://…"
                          onBlur={(e) => {
                            if (e.target.value !== poster.href) {
                              void run(
                                () => patchHeroPoster(poster.id, { href: e.target.value }),
                                "Link saved",
                              );
                            }
                          }}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <IconBtn
                          label="Move up"
                          disabled={disabled || i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </IconBtn>
                        <IconBtn
                          label="Move down"
                          disabled={disabled || i === hero.posters.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </IconBtn>
                        <IconBtn
                          label="Delete poster"
                          disabled={disabled}
                          onClick={() =>
                            void run(() => deleteHeroPoster(poster.id), "Poster deleted")
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                        </IconBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={posterInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    void run(() => uploadHeroPoster(hero.pageKey, file), "Poster added");
                  }
                }}
              />
              <BtnGhost
                onClick={() => posterInput.current?.click()}
                disabled={disabled}
                className="mt-3"
              >
                <ImageIcon className="h-4 w-4" aria-hidden />
                Add poster
              </BtnGhost>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-zup-body/6 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
