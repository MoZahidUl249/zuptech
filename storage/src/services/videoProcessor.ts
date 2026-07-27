import { CONFIG } from "../config";

export interface VideoProbeResult {
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

export async function probeVideo(path: string): Promise<VideoProbeResult> {
  const proc = Bun.spawn(
    [
      CONFIG.ffprobePath,
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      path,
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`ffprobe failed (exit ${exitCode}): ${stderr}`);
  }

  const parsed = JSON.parse(stdout) as FfprobeOutput;
  const videoStream = parsed.streams?.find((s) => s.codec_type === "video");
  const durationSeconds = parsed.format?.duration ? Number(parsed.format.duration) : null;

  return {
    durationMs: durationSeconds !== null && Number.isFinite(durationSeconds)
      ? Math.round(durationSeconds * 1000)
      : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
  };
}

/** Extracts a single frame at the given timestamp (seconds) to destPath (JPEG). */
export async function extractFrame(
  sourcePath: string,
  destPath: string,
  atSeconds: number
): Promise<void> {
  const proc = Bun.spawn(
    [
      CONFIG.ffmpegPath,
      "-y",
      "-ss",
      String(Math.max(atSeconds, 0)),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      destPath,
    ],
    { stdout: "ignore", stderr: "pipe" }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg frame extraction failed (exit ${exitCode}): ${stderr}`);
  }
}

/** Picks a sane poster-frame timestamp: ~10% into the video, or 1s if shorter/unknown. */
export function posterTimestampSeconds(durationMs: number | null): number {
  if (!durationMs || durationMs <= 0) return 0;
  const durationSeconds = durationMs / 1000;
  return Math.min(durationSeconds * 0.1, 1, durationSeconds);
}
