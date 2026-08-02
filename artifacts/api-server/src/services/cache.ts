import NodeCache from "node-cache";
import { createHash } from "crypto";
import type { MediaInfo } from "@workspace/api-zod";

// Resolve cache — deduplicates repeated yt-dlp calls for the same URL within 5 min
const resolveCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60,
  useClones: false,
});

function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function getCachedResolve(url: string): MediaInfo | undefined {
  return resolveCache.get<MediaInfo>(cacheKey(url));
}

export function setCachedResolve(url: string, info: MediaInfo): void {
  resolveCache.set(cacheKey(url), info);
}

export function getCacheStats() {
  return resolveCache.getStats();
}
