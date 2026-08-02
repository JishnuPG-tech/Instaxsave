import { mkdtempSync, unlinkSync, readdirSync, statSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, extname } from "path";
import { logger } from "../lib/logger.js";

const TEMP_PREFIX = "instavault-";
const MAX_FILE_AGE_MINUTES =
  parseInt(process.env["TEMP_FILE_MAX_AGE"] ?? "15", 10) || 15;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Create a temp directory once and reuse it
let tempDir: string | null = null;

function getTempDir(): string {
  if (!tempDir) {
    tempDir = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
  }
  return tempDir;
}

/**
 * Creates a unique temp file path (no file is created yet — yt-dlp will write to it)
 */
export function createTempPath(ext: string): string {
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`;
  return join(getTempDir(), name);
}

/**
 * Deletes a temp file silently (errors are logged but not thrown)
 */
export async function cleanupFile(filePath: string): Promise<void> {
  try {
    unlinkSync(filePath);
  } catch (err: unknown) {
    // File may have already been deleted — that's fine
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") {
      logger.warn({ filePath, err }, "Failed to delete temp file");
    }
  }
}

/**
 * Deletes temp files older than MAX_FILE_AGE_MINUTES minutes
 */
export function cleanupOlderThan(maxAgeMinutes = MAX_FILE_AGE_MINUTES): void {
  const dir = getTempDir();
  const cutoffMs = maxAgeMinutes * 60 * 1000;
  const now = Date.now();

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (now - stat.mtimeMs > cutoffMs) {
        rmSync(fullPath, { force: true });
        logger.debug({ fullPath }, "Cleaned up stale temp file");
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Start periodic cleanup cron (call once at startup)
 */
export function startCleanupCron(): void {
  if (cleanupInterval) return;
  const intervalMs = MAX_FILE_AGE_MINUTES * 60 * 1000;
  cleanupInterval = setInterval(() => cleanupOlderThan(), intervalMs);
  cleanupInterval.unref(); // don't hold the process open
}

/**
 * Infer the extension for a given format/ext combination
 */
export function inferExtension(ext: string, formatId: string): string {
  if (ext && ext !== "none") return ext.startsWith(".") ? ext : `.${ext}`;
  if (formatId.includes("audio")) return ".mp3";
  return ".mp4";
}
