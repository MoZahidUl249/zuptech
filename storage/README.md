# media-storage-service

Low-latency photo/video storage microservice for the e-commerce platform, built on the Bun runtime. Stores original + generated variants (thumbnail/medium/poster) on local disk, tracks metadata in PostgreSQL, and serves files with Range-request support (video seeking), caching headers, and conditional (`ETag`) requests.

Designed to run standalone on a VPS, alongside the existing storefront frontend/backend, fronted by the same reverse proxy.

## Requirements

- [Bun](https://bun.sh) >= 1.3.13
- PostgreSQL (any recent version)
- `ffmpeg` / `ffprobe` on `PATH` (used for video poster-frame extraction + probing)

## Setup

```bash
bun install
cp .env.example .env   # then edit API_KEY, DATABASE_URL, STORAGE_ROOT
bun run migrate         # creates tables (idempotent, tracks applied migrations)
bun run dev             # http://localhost:3100, restarts on file change
```

Run `bun run typecheck` and `bun test` before deploying.

## Data model

- `media` — one row per uploaded asset: `entity_type`/`entity_id` (e.g. `product`/`1234`), `media_type` (`image`|`video`), `status` (`processing`|`ready`|`failed`), dimensions, video duration, etc.
- `media_variants` — one row per rendition of an asset: `original`, `thumbnail`, `medium` (images), `poster` (videos). Each points at a file under `STORAGE_ROOT`.

Files on disk live at `{STORAGE_ROOT}/{entityType}/{entityId}/{mediaId}/{variant}.{ext}` — human-browsable, and deleting a media item's directory removes all its variants atomically.

## API

All write routes require a shared secret header: `X-API-Key: <API_KEY>`. Read/serving routes are public (CDN-like), matching the storefront's need to display media without auth friction.

### `POST /media` — upload

`multipart/form-data` with fields:

| field | required | notes |
|---|---|---|
| `file` | yes | the image/video binary |
| `entityType` | yes | e.g. `product` — letters/numbers/dash/underscore only |
| `entityId` | yes | e.g. `1234` — same charset restriction |
| `sortOrder` | no | integer, default `0`, used to order a gallery |

```bash
curl -X POST http://localhost:3100/media \
  -H "X-API-Key: $API_KEY" \
  -F file=@front.jpg \
  -F entityType=product \
  -F entityId=1234
```

Returns `201` with the media record (see below). Images are resized synchronously (thumbnail + medium); videos are probed (ffprobe) and get a poster frame extracted (ffmpeg) — all within the same request/response cycle (no background queue; fine at small/medium VPS scale).

### `GET /media/:id` — fetch one

Returns:

```json
{
  "id": "…uuid…",
  "entityType": "product",
  "entityId": "1234",
  "mediaType": "image",
  "status": "ready",
  "originalFilename": "front.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 483221,
  "width": 2400,
  "height": 1800,
  "durationMs": null,
  "sortOrder": 0,
  "createdAt": "2026-07-19T10:00:00.000Z",
  "variants": [
    { "variant": "original", "url": "/files/…uuid…/original", "mimeType": "image/jpeg", "sizeBytes": 483221, "width": 2400, "height": 1800 },
    { "variant": "thumbnail", "url": "/files/…uuid…/thumbnail", "mimeType": "image/jpeg", "sizeBytes": 12044, "width": 300, "height": 300 },
    { "variant": "medium", "url": "/files/…uuid…/medium", "mimeType": "image/jpeg", "sizeBytes": 98211, "width": 1200, "height": 900 }
  ]
}
```

### `GET /media?entityType=product&entityId=1234` — list for an entity

Returns `{ entityType, entityId, items: [...] }`, ordered by `sortOrder, createdAt`. Only `status=ready` items are included unless `?includeAll=true` is added (useful for debugging stuck uploads).

### `DELETE /media/:id`

Deletes the DB row (cascades to variants) then removes the on-disk directory. `204` on success, `404` if not found. Requires `X-API-Key`.

### `GET /files/:id/:variant` — serve bytes

`:variant` is one of `original|thumbnail|medium|poster`. Supports `HEAD`, `Range` (for video scrubbing — `206 Partial Content` / `416 Range Not Satisfiable`), `If-None-Match` (`304 Not Modified`), and sends `Cache-Control: public, max-age=31536000, immutable` since a given `(mediaId, variant)` never changes after creation.

### `GET /health`

`{ status, db, storage, uptimeSeconds }` — `200` if healthy, `503` otherwise. Used by systemd/monitoring, not the storefront.

## Deployment (VPS)

Primary path is a plain `bun run` process under systemd with Postgres installed natively — no containers needed for a single-box deploy.

1. Install Bun and `ffmpeg` on the VPS: `curl -fsSL https://bun.sh/install | bash`, `apt install ffmpeg`.
2. Provision Postgres: `apt install postgresql`, then create a role + database matching `DATABASE_URL`.
3. Copy this project to `/opt/media-storage`, run `bun install --production`, then `bun run migrate`.
4. Create `/etc/media-storage.env` (root-only, `chmod 600`) with the real `API_KEY`/`DATABASE_URL`/`STORAGE_ROOT` — never commit this file.
5. Install the provided unit file: `cp deploy/media-storage.service /etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable --now media-storage`.
6. Point your existing reverse proxy (nginx/Caddy) at `127.0.0.1:3100`. For nginx, set `proxy_buffering off;` (or generous buffer sizes) on the `/files/` location — otherwise the proxy can buffer the whole response and silently defeat Range-based video streaming.

A `Dockerfile`/`docker-compose.yml` is included as an optional convenience (bundles Postgres) for local dev parity or for anyone who prefers a containerized deploy — not the primary documented path.

**Backups**: back up the Postgres DB (`pg_dump` cron) and `STORAGE_ROOT` (`rsync`/`tar` cron) separately — both are required to fully restore the service.

## Notes / intentional simplifications

- No job queue — processing is synchronous in the upload request, appropriate at small/medium VPS scale. If catalog/video volume grows significantly, move image/video processing to a background worker.
- No content transcoding for video — only a poster frame + metadata probe are generated; the original video file is served as-is.
- `entityType`/`entityId` are restricted to `[A-Za-z0-9_-]` since they're used directly as filesystem path segments (prevents path traversal).
- Range-request handling is implemented manually (`Bun.file().slice()` + hand-built headers) rather than relying on Bun's automatic Range support, since that automatic path has had edge-case regressions in some Bun versions — this keeps the behavior fully in our control and unit-tested (`test/range.test.ts`).
