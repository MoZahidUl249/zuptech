"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, User } from "lucide-react";
import { useAdmin } from "@/lib/admin";
import {
  createTeamMember,
  deleteTeamMember,
  patchTeamMember,
  uploadTeamPhoto,
  useTeam,
  type AdminTeamMember,
} from "@/lib/admin-api";
import {
  checkImageFile,
  describeImage,
  IMAGE_ACCEPT,
  IMAGE_FORMATS_LABEL,
  readImageDimensions,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { Card, Field, BtnPrimary, BtnGhost, BtnDanger, inputCls } from "./ui";

/** Mirrors uploadTeamPhotoDto's maxSize ("8m") in team.dto.ts. */
const MAX_PHOTO_BYTES = 8_000_000;

/** Backend caps: name 120, role 120, bio 600 (team.dto.ts). */
const NAME_MAX = 120;
const ROLE_MAX = 120;
const BIO_MAX = 600;

/**
 * The people shown on the contact page.
 *
 * Edits are drafts until "Save person" is pressed — nothing here writes as you
 * type. Adding and removing are their own explicit actions, so the Add button
 * and the delete confirmation are the confirmation for those.
 */
export function TeamSection() {
  const { can } = useAdmin();
  const readOnly = can("sitecontent") !== "manage";
  const { list, setList, replace, loading, error, reload } = useTeam();
  const [adding, setAdding] = useState(false);

  const save = useCallback(
    async (id: string, patch: Partial<Omit<AdminTeamMember, "id" | "photo">>) => {
      try {
        replace(await patchTeamMember(id, patch));
        toast("Saved");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't save that change");
        void reload(); // pull back to server truth so the UI isn't lying
      }
    },
    [replace, reload],
  );

  const add = async () => {
    setAdding(true);
    try {
      // POST immediately rather than holding a client-only draft: the row needs
      // a server id before a photo can be attached to it.
      const row = await createTeamMember({
        name: "New person",
        role: "Their role",
        bio: "",
        sort: list.length,
      });
      setList((prev) => [...prev, row]);
      toast("Person added — fill in their details below");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add a person");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (row: AdminTeamMember) => {
    const before = list;
    setList((prev) => prev.filter((m) => m.id !== row.id));
    try {
      await deleteTeamMember(row.id);
      toast("Person removed");
    } catch (err) {
      setList(before);
      toast(err instanceof Error ? err.message : "Couldn't remove that person");
    }
  };

  /* Reorder by swapping the two rows' sort values. Array position alone isn't
   * enough — sort values can be sparse (0, 5, 9) once rows are deleted. */
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const a = list[index]!;
    const b = list[target]!;

    const next = [...list];
    next[index] = { ...b, sort: a.sort };
    next[target] = { ...a, sort: b.sort };
    setList(next.sort((x, y) => x.sort - y.sort));

    try {
      await Promise.all([
        patchTeamMember(a.id, { sort: b.sort }),
        patchTeamMember(b.id, { sort: a.sort }),
      ]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't reorder");
      void reload();
    }
  };

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-zup-body">People</h3>
          <p className="mt-1 max-w-prose text-ui-sm text-zup-gray">
            Shown on the contact page under the office details. Real, consented
            names and photos only — the section stays hidden while this is empty.
          </p>
        </div>
        {!readOnly ? (
          <BtnPrimary onClick={add} disabled={adding || loading}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {adding ? "Adding…" : "Add person"}
          </BtnPrimary>
        ) : null}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-zup-gray">Loading…</p>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zup-gray">Couldn&apos;t load the team.</p>
          <BtnGhost className="mt-3" onClick={() => void reload()}>
            Try again
          </BtnGhost>
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-zup-gray">
          Nobody added yet — the contact page shows no team section until you add someone.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {list.map((m, i) => (
            <TeamRow
              key={m.id}
              member={m}
              index={i}
              count={list.length}
              readOnly={readOnly}
              onSave={save}
              onPhoto={replace}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function TeamRow({
  member: m,
  index,
  count,
  readOnly,
  onSave,
  onPhoto,
  onMove,
  onRemove,
}: {
  member: AdminTeamMember;
  index: number;
  count: number;
  readOnly: boolean;
  onSave: (id: string, patch: Partial<Omit<AdminTeamMember, "id" | "photo">>) => Promise<void>;
  onPhoto: (row: AdminTeamMember) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (row: AdminTeamMember) => void;
}) {
  // A draft, not a live write: nothing reaches the server until Save.
  const [name, setName] = useState(m.name);
  const [role, setRole] = useState(m.role);
  const [bio, setBio] = useState(m.bio);
  const [saving, setSaving] = useState(false);

  const dirty = name !== m.name || role !== m.role || bio !== m.bio;
  const valid = name.trim().length > 0 && role.trim().length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(m.id, { name: name.trim(), role: role.trim(), bio: bio.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zup-body/10 bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        <PhotoSlot member={m} disabled={readOnly} onUploaded={onPhoto} />

        <div className="flex min-w-60 flex-1 flex-col gap-3">
          <Field label="Name">
            <input
              value={name}
              maxLength={NAME_MAX}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Role">
            <input
              value={role}
              maxLength={ROLE_MAX}
              disabled={readOnly}
              onChange={(e) => setRole(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="About them">
            <textarea
              value={bio}
              rows={2}
              maxLength={BIO_MAX}
              disabled={readOnly}
              onChange={(e) => setBio(e.target.value)}
              className={cn(inputCls, "min-h-16 resize-y")}
            />
          </Field>

          {!readOnly ? (
            <div className="flex items-center gap-3">
              <BtnPrimary onClick={() => void save()} disabled={!dirty || !valid || saving}>
                {saving ? "Saving…" : "Save person"}
              </BtnPrimary>
              {dirty ? (
                <>
                  <BtnGhost
                    onClick={() => {
                      setName(m.name);
                      setRole(m.role);
                      setBio(m.bio);
                    }}
                  >
                    Undo
                  </BtnGhost>
                  <span className="text-ui-sm text-zup-soft">Not saved yet</span>
                </>
              ) : null}
              {dirty && !valid ? (
                <span className="text-ui-sm font-semibold text-warn-fg">
                  Name and role are required
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <BtnGhost aria-label="Move up" disabled={index === 0} onClick={() => onMove(index, -1)}>
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </BtnGhost>
              <BtnGhost
                aria-label="Move down"
                disabled={index === count - 1}
                onClick={() => onMove(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </BtnGhost>
            </div>
            <ConfirmDialog
              trigger={<BtnDanger>Remove</BtnDanger>}
              title="Remove this person?"
              description={`"${m.name}" will stop appearing on the contact page. This can't be undone.`}
              confirmLabel="Remove"
              onConfirm={() => onRemove(m)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhotoSlot({
  member: m,
  disabled,
  onUploaded,
}: {
  member: AdminTeamMember;
  disabled?: boolean;
  onUploaded: (row: AdminTeamMember) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const inert = disabled || busy;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "relative flex h-28 w-28 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-zup-body/20 bg-white text-center",
          inert && "opacity-60",
        )}
      >
        {m.photo ? (
          <Image src={m.photo} alt={m.name} fill unoptimized className="object-cover" />
        ) : (
          <>
            <User className="mb-1 h-4 w-4 text-zup-faint" aria-hidden />
            <span className="text-xs font-semibold text-zup-gray">
              {busy ? "Uploading…" : "No photo"}
            </span>
          </>
        )}
        {!disabled ? (
          <button
            type="button"
            disabled={inert}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "cursor-pointer text-ui-micro text-zup-blue underline disabled:cursor-not-allowed disabled:text-zup-faint disabled:no-underline",
              m.photo && "absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-white no-underline",
            )}
          >
            {busy ? "Uploading…" : m.photo ? "Replace" : "browse"}
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          aria-label={`Upload a photo of ${m.name}`}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;

            const problem = checkImageFile(f, MAX_PHOTO_BYTES);
            if (problem) {
              toast(problem);
              return;
            }

            setBusy(true);
            try {
              const dims = await readImageDimensions(f);
              onUploaded(await uploadTeamPhoto(m.id, f));
              setCaption(describeImage(dims, f.size, f.type));
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't upload that photo");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <p className="max-w-28 text-ui-micro leading-tight text-zup-faint">
        {caption ?? `Square, 600×600+. ${IMAGE_FORMATS_LABEL}, under 8 MB.`}
      </p>
    </div>
  );
}
