import { Router, type IRouter } from "express";
import { z } from "zod";
import { validateInstagramBody } from "../middlewares/validateInstagram.js";
import { resolveRateLimit } from "../middlewares/rateLimit.js";
import {
  resolveUrl,
  RateLimitError,
  PrivateContentError,
  NotFoundError,
  YtDlpError,
} from "../services/ytdlp.js";
import { getCachedResolve, setCachedResolve } from "../services/cache.js";

const router: IRouter = Router();

const ResolveBodySchema = z.object({
  url: z.string().url(),
});

router.post(
  "/resolve",
  resolveRateLimit,
  validateInstagramBody,
  async (req, res) => {
    const parsed = ResolveBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Request body must include a valid 'url' field.",
        },
      });
      return;
    }

    const { url } = parsed.data;

    // Cache hit — return early without invoking yt-dlp
    const cached = getCachedResolve(url);
    if (cached) {
      req.log.info({ url }, "Cache hit for resolve");
      res.json(cached);
      return;
    }

    try {
      const mediaInfo = await resolveUrl(url);
      setCachedResolve(url, mediaInfo);
      res.json(mediaInfo);
    } catch (err) {
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
      req.log.error({ err, url }, "Unexpected error during resolve");
      res.status(500).json({
        error: { code: "SERVER_ERROR", message: "An unexpected error occurred." },
      });
    }
  },
);

export default router;
