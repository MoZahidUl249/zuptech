CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  original_filename TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  duration_ms   INTEGER,
  checksum_sha256 TEXT,
  status        TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_entity ON media (entity_type, entity_id, sort_order, created_at);
CREATE INDEX idx_media_status ON media (status) WHERE status <> 'ready';

CREATE TABLE media_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id      UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  variant       TEXT NOT NULL CHECK (variant IN ('original', 'thumbnail', 'medium', 'poster')),
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_id, variant)
);

CREATE INDEX idx_variants_media ON media_variants (media_id);
