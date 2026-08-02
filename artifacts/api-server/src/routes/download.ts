import { Router, type IRouter } from "express";
import { z } from "zod";
import { createReadStream, existsSync } from "fs";
import { basename } from "path";
import { validateInstagramQuery } from "../middlewares/validateInstagram.js";
import { downloadRateLimit } from "../middlewares/rateLimit.js";
import {
  downloadMedia,
  RateLimitError,
  PrivateContentError,
  NotFoundError,
  YtDlpError,
} from "../services/ytdlp.js";
import { createTempPath, cleanupFile, inferExtension } from "../services/tempFiles.js";

const router: IRouter = Router();

// Max file size allowed for download (500 MB)
const MAX_BYTES = 500 * 1024 * 1024;

const DownloadQuerySchema = z.object({
  url: z.string().url(),
  formatId: z.string().min(1),
  index: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .refine((v) => v === undefined || (!isNaN(v) && v >= 0), {
      message: "index must be a non-negative integer",
    }),
});

router.get(
  "/download",
  downloadRateLimit,
  validateInstagramQuery,
  async (req, res) => {
    const parsed = DownloadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message:
            "Query must include: url (Instagram URL), formatId (e.g. 'best'), optionally index (carousel item).",
        },
      });
      return;
    }

    const { url, formatId, index } = parsed.data;

    // Determine file extension from the format selector
    const ext = formatId.includes("audio") ? "mp3" : "mp4";
    const tmpPath = createTempPath(ext);

    // Ensure cleanup always runs
    let cleaned = false;
    const doCleanup = async () => {
      if (!cleaned) {
        cleaned = true;
        await cleanupFile(tmpPath);
      }
    };

    res.on("finish", doCleanup);
    res.on("close", doCleanup);
    res.on("error", doCleanup);

    try {
      await downloadMedia(url, formatId, tmpPath, index);

      if (!existsSync(tmpPath)) {
        res.status(500).json({
          error: {
            code: "FILE_NOT_FOUND",
            message: "Download completed but output file was not found.",
          },
        });
        return;
      }

      // MIME type
      const mimeMap: Record<string, string> = {
        mp4: "video/mp4",
        mp3: "audio/mpeg",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        m4a: "audio/mp4",
        webm: "video/webm",
      };
      const mime = mimeMap[ext] ?? "application/octet-stream";

      // Filename from URL shortcode
      const urlParts = url.split("/").filter(Boolean);
      const shortcode = urlParts[urlParts.length - 1] ?? "media";
      const filename = `instavault_${shortcode}.${ext}`;

      res.setHeader("Content-Type", mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      const stream = createReadStream(tmpPath);
      stream.on("error", async (streamErr) => {
        req.log.error({ err: streamErr, tmpPath }, "Error reading temp file");
        if (!res.headersSent) {
          res.status(500).json({
            error: { code: "STREAM_ERROR", message: "Failed to stream file." },
          });
        }
        await doCleanup();
      });

      stream.pipe(res);
    } catch (err) {
      await doCleanup();

      if (err instanceof RateLimitError) {
        res
          .status(429)
          .setHeader("Retry-After", "30")
          .json({ error: { code: err.code, message: err.message } });
        return;
      }
      if (err instanceof PrivateContentError) {
        res.status(403).json({ error: { code: err.code, message: err.message } });
        return;
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: { code: err.code, message: err.message } });
        return;
      }
      if (err instanceof YtDlpError) {
        res.status(500).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err, url }, "Unexpected error during download");
      res.status(500).json({
        error: { code: "SERVER_ERROR", message: "An unexpected error occurred." },
      });
    }
  },
);

export default router;
