export type MediaType = "image" | "video";
export type MediaStatus = "processing" | "ready" | "failed";
export type VariantName = "original" | "thumbnail" | "medium" | "poster";

export interface MediaRow {
  id: string;
  entity_type: string;
  entity_id: string;
  media_type: MediaType;
  original_filename: string;
  mime_type: string;
  size_bytes: string; // bigint comes back as string from postgres
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  checksum_sha256: string | null;
  status: MediaStatus;
  error_message: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VariantRow {
  id: string;
  media_id: string;
  variant: VariantName;
  storage_path: string;
  mime_type: string;
  size_bytes: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface MediaWithVariants extends MediaRow {
  variants: VariantRow[];
}
