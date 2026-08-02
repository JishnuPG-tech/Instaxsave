import { execa } from "execa";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Inline types that mirror the OpenAPI schema shapes
// ---------------------------------------------------------------------------

interface MediaFormat {
  formatId: string;
  label: string;
  ext: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  width?: number | null;
  tbr?: number | null;
  abr?: number | null;
  filesize?: number | null;
}

interface CarouselItem {
  index: number;
  type: "photo" | "video";
  thumbnailUrl?: string | null;
  formats: MediaFormat[];
}

interface MediaInfo {
  id: string;
  type: "post" | "reel" | "story" | "highlight" | "carousel" | "profile_pic" | "igtv";
  author?: string | null;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  uploadedAt?: string | null;
  durationSeconds?: number | null;
  formats?: MediaFormat[] | null;
  items?: CarouselItem[] | null;
}

// ---------------------------------------------------------------------------
// yt-dlp binary resolution
// ---------------------------------------------------------------------------

function getYtDlpBin(): string {
  return (
    process.env["YTDLP_PATH"] ??
    process.env["YTDLP_BIN"] ??
    "/home/runner/.local/bin/yt-dlp"
  );
}

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

export class YtDlpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "YtDlpError";
  }
}

export class RateLimitError extends YtDlpError {
  constructor(msg = "Instagram rate limit — please retry shortly") {
    super(msg, "RATE_LIMITED");
  }
}

export class PrivateContentError extends YtDlpError {
  constructor(msg = "This content is private or requires login") {
    super(msg, "PRIVATE_CONTENT");
  }
}

export class NotFoundError extends YtDlpError {
  constructor(msg = "This post has been deleted or is no longer available") {
    super(msg, "NOT_FOUND");
  }
}

export class UnsupportedContentError extends YtDlpError {
  constructor(msg = "This type of Instagram content is not supported") {
    super(msg, "UNSUPPORTED");
  }
}

// ---------------------------------------------------------------------------
// Stderr → error classification
// ---------------------------------------------------------------------------

const PRIVATE_PATTERNS = [
  /private/i,
  /login required/i,
  /not accessible/i,
  /age.?restrict/i,
  /checkpoint/i,
];
const NOT_FOUND_PATTERNS = [/404/, /does not exist/i, /deleted/i, /unavailable/i];
const RATE_LIMIT_PATTERNS = [/429/, /rate.?limit/i, /too many requests/i, /please wait/i];

function classifyStderr(stderr: string): YtDlpError | null {
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(stderr))) return new RateLimitError();
  if (PRIVATE_PATTERNS.some((p) => p.test(stderr))) return new PrivateContentError();
  if (NOT_FOUND_PATTERNS.some((p) => p.test(stderr))) return new NotFoundError();
  return null;
}

// ---------------------------------------------------------------------------
// Raw yt-dlp JSON shape (only the fields we need)
// ---------------------------------------------------------------------------

interface RawFormat {
  format_id: string;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  height?: number;
  width?: number;
  tbr?: number;
  abr?: number;
  filesize?: number;
  filesize_approx?: number;
  url?: string;
}

interface RawInfo {
  id?: string;
  _type?: string;
  title?: string;
  description?: string;
  uploader?: string;
  uploader_id?: string;
  channel?: string;
  thumbnail?: string;
  upload_date?: string; // YYYYMMDD
  webpage_url?: string;
  ext?: string;
  width?: number;
  height?: number;
  duration?: number;
  formats?: RawFormat[];
  entries?: RawInfo[];
}

// ---------------------------------------------------------------------------
// Format mapping
// ---------------------------------------------------------------------------

function parseUploadDate(raw: string | undefined): string | undefined {
  if (!raw || raw.length !== 8) return undefined;
  // YYYYMMDD → YYYY-MM-DDTHH:mm:ssZ
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`;
}

function mapFormats(rawFormats: RawFormat[]): MediaFormat[] {
  const seen = new Set<string>();
  const result: MediaFormat[] = [];

  // Always prepend a "best" option first
  result.push({
    formatId: "bestvideo+bestaudio/best",
    label: "Best quality",
    ext: "mp4",
    vcodec: null,
    acodec: null,
    height: null,
    width: null,
    tbr: null,
    abr: null,
    filesize: null,
  });
  seen.add("best");

  // Filter to merged video+audio or pure audio formats only
  const usable = rawFormats.filter((f) => {
    if (!f.ext) return false;
    const hasVideo = f.vcodec && f.vcodec !== "none";
    const hasAudio = f.acodec && f.acodec !== "none";
    return (hasVideo && hasAudio) || (!hasVideo && hasAudio);
  });

  // Sort by height desc (videos) then audio
  usable.sort((a, b) => {
    if (a.height && b.height) return b.height - a.height;
    if (a.height) return -1;
    if (b.height) return 1;
    return 0;
  });

  for (const f of usable) {
    const hasVideo = f.vcodec && f.vcodec !== "none";
    const hasAudio = f.acodec && f.acodec !== "none";

    // Deduplicate by height for video or by abr for audio
    const key = hasVideo ? `video_${f.height ?? "x"}` : `audio_${f.abr ?? "x"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let label: string;
    let formatId: string;

    if (hasVideo) {
      const h = f.height;
      if (h && h >= 1080) {
        label = "1080p";
        formatId = "bestvideo[height<=1080]+bestaudio/best[height<=1080]";
      } else if (h && h >= 720) {
        label = "720p";
        formatId = "bestvideo[height<=720]+bestaudio/best[height<=720]";
      } else if (h && h >= 480) {
        label = "480p";
        formatId = "bestvideo[height<=480]+bestaudio/best[height<=480]";
      } else {
        label = h ? `${h}p` : "Video";
        formatId = `bestvideo[height<=${h ?? 360}]+bestaudio/best[height<=${h ?? 360}]`;
      }
    } else if (!hasVideo && hasAudio) {
      label = "Audio only (MP3)";
      formatId = "bestaudio/best";
    } else {
      continue;
    }

    // Check for duplicate formatId
    if (result.some((r) => r.formatId === formatId)) continue;

    result.push({
      formatId,
      label,
      ext: hasVideo ? (f.ext ?? "mp4") : "mp3",
      vcodec: f.vcodec ?? null,
      acodec: f.acodec ?? null,
      height: f.height ?? null,
      width: f.width ?? null,
      tbr: f.tbr ?? null,
      abr: f.abr ?? null,
      filesize: f.filesize ?? f.filesize_approx ?? null,
    });
  }

  return result;
}

function detectMediaType(
  rawType: string | undefined,
  url: string,
): MediaInfo["type"] {
  if (rawType === "playlist") return "carousel";
  if (/\/reel\//i.test(url)) return "reel";
  if (/\/stories\//i.test(url)) return "story";
  if (/\/highlights\//i.test(url)) return "highlight";
  if (/\/p\//i.test(url)) return "post";
  if (/\/(tv|igtv)\//i.test(url)) return "igtv";
  return "post";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function resolveUrl(url: string): Promise<MediaInfo> {
  const bin = getYtDlpBin();
  logger.info({ url }, "Resolving URL with yt-dlp");

  let stdout: string;
  let stderr: string;
  try {
    const result = await execa(
      bin,
      [
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        "--socket-timeout",
        "30",
        "--user-agent",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "--sleep-interval",
        "1",
        "--max-sleep-interval",
        "3",
        url,
      ],
      { timeout: 45_000 },
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err: unknown) {
    const execaErr = err as { stderr?: string; message?: string; code?: string };
    const stderrText = execaErr?.stderr ?? "";
    const msgText = execaErr?.message ?? "";
    logger.warn({ url, stderr: stderrText, message: msgText }, "yt-dlp exited with error");
    // Binary not found
    if (execaErr?.code === "ENOENT") {
      throw new YtDlpError(
        `yt-dlp binary not found at "${bin}". Install it and set YTDLP_PATH.`,
        "BINARY_NOT_FOUND",
      );
    }
    const classified = classifyStderr(stderrText || msgText);
    if (classified) throw classified;
    throw new YtDlpError(
      `yt-dlp failed: ${(stderrText || msgText).slice(0, 300)}`,
      "YTDLP_ERROR",
    );
  }

  if (stderr) {
    const classified = classifyStderr(stderr);
    if (classified) throw classified;
  }

  let raw: RawInfo;
  try {
    raw = JSON.parse(stdout) as RawInfo;
  } catch {
    throw new YtDlpError("Failed to parse yt-dlp JSON output", "PARSE_ERROR");
  }

  // Carousel / playlist
  if (raw._type === "playlist" && Array.isArray(raw.entries)) {
    const items: CarouselItem[] = raw.entries.map((entry, idx) => {
      const formats = mapFormats(entry.formats ?? []);
      const hasVideo = (entry.formats ?? []).some(
        (f) => f.vcodec && f.vcodec !== "none",
      );
      return {
        index: idx,
        type: hasVideo ? "video" : "photo",
        thumbnailUrl: entry.thumbnail ?? null,
        formats,
      };
    });

    return {
      id: raw.id ?? "unknown",
      type: "carousel",
      author: raw.uploader ?? raw.uploader_id ?? null,
      authorDisplayName: raw.channel ?? raw.uploader ?? null,
      authorAvatarUrl: null,
      thumbnailUrl: raw.thumbnail ?? null,
      caption: raw.description ?? null,
      uploadedAt: parseUploadDate(raw.upload_date) ?? null,
      durationSeconds: null,
      formats: null,
      items,
    };
  }

  // Single item
  const formats = mapFormats(raw.formats ?? []);
  const mediaType = detectMediaType(raw._type, url);

  return {
    id: raw.id ?? "unknown",
    type: mediaType,
    author: raw.uploader ?? raw.uploader_id ?? null,
    authorDisplayName: raw.channel ?? raw.uploader ?? null,
    authorAvatarUrl: null,
    thumbnailUrl: raw.thumbnail ?? null,
    caption: raw.description ?? null,
    uploadedAt: parseUploadDate(raw.upload_date) ?? null,
    durationSeconds: raw.duration ?? null,
    formats,
    items: null,
  };
}

export async function downloadMedia(
  url: string,
  formatId: string,
  outPath: string,
  carouselIndex?: number,
): Promise<void> {
  const bin = getYtDlpBin();
  logger.info({ url, formatId, carouselIndex }, "Downloading media with yt-dlp");

  const args: string[] = [
    "--format",
    formatId,
    "--output",
    outPath,
    "--no-warnings",
    "--socket-timeout",
    "30",
    "--retries",
    "3",
    "--user-agent",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  ];

  if (carouselIndex !== undefined) {
    args.push("--no-playlist", "--playlist-items", String(carouselIndex + 1));
  } else {
    args.push("--no-playlist");
  }

  args.push(url);

  try {
    await execa(bin, args, { timeout: 300_000 });
  } catch (err: unknown) {
    const execaErr = err as { stderr?: string; message?: string };
    const stderrText = execaErr?.stderr ?? execaErr?.message ?? "";
    const classified = classifyStderr(stderrText);
    if (classified) throw classified;
    throw new YtDlpError(
      `yt-dlp download failed: ${stderrText.slice(0, 300)}`,
      "DOWNLOAD_ERROR",
    );
  }
}

export async function getVersion(): Promise<string> {
  const bin = getYtDlpBin();
  try {
    const { stdout } = await execa(bin, ["--version"], { timeout: 10_000 });
    return stdout.trim();
  } catch {
    return "unavailable";
  }
}
