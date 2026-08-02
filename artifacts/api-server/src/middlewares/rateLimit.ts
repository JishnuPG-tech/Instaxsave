import { rateLimit } from "express-rate-limit";

/**
 * Rate limiter for POST /api/resolve — 30 requests per 15 minutes per IP
 */
export const resolveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message:
        "Too many requests — please wait a few minutes before trying again.",
    },
  },
  statusCode: 429,
  validate: { xForwardedForHeader: false },
});

/**
 * Rate limiter for GET /api/download — 10 requests per 15 minutes per IP
 */
export const downloadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message:
        "Too many download requests — please wait a few minutes before trying again.",
    },
  },
  statusCode: 429,
  validate: { xForwardedForHeader: false },
});
