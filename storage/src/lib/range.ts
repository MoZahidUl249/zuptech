export interface ParsedRange {
  start: number;
  end: number; // inclusive
}

/**
 * Parses a single-range `Range` header (e.g. "bytes=0-499", "bytes=500-", "bytes=-500").
 * Multi-range requests are simplified to just the first range, which matches how
 * browsers request video (they never send comma-separated ranges for scrubbing).
 * Returns null when there is no range header, or when it's syntactically invalid
 * (caller should treat that as "serve the full file", not an error).
 * Returns undefined when the range is well-formed but unsatisfiable for this file size
 * (caller should respond 416).
 */
export function parseRangeHeader(
  rangeHeader: string | null,
  fileSize: number
): ParsedRange | null | undefined {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;

  const spec = rangeHeader.slice(6).split(",")[0]?.trim();
  if (!spec || !spec.includes("-")) return undefined;

  const [startStr, endStr] = spec.split("-");
  let start: number;
  let end: number;

  if (startStr === "") {
    const suffixLength = Number(endStr);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return undefined;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? fileSize - 1 : Number(endStr);
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    start < 0 ||
    start >= fileSize
  ) {
    return undefined;
  }

  end = Math.min(end, fileSize - 1);
  return { start, end };
}
