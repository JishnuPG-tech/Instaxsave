import type { Request, Response, NextFunction } from "express";

// Only allow instagram.com (www. or bare) origins.
// This prevents SSRF, local network access, etc.
const INSTAGRAM_PATTERN =
  /^https?:\/\/(www\.)?instagram\.com(\/|$)/i;

const BLOCKED_PATTERNS = [
  /localhost/i,
  /127\.\d+\.\d+\.\d+/,
  /::1/,
  /0\.0\.0\.0/,
  /10\.\d+\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /file:\/\//i,
  /javascript:/i,
  /data:/i,
];

function isValidInstagramUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  if (BLOCKED_PATTERNS.some((p) => p.test(url))) return false;
  return INSTAGRAM_PATTERN.test(url);
}

/**
 * Validates `req.body.url` (for POST requests).
 * Use validateInstagramQuery for GET query param validation.
 */
export function validateInstagramBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const url = req.body?.url;
  if (!isValidInstagramUrl(url)) {
    res.status(400).json({
      error: {
        code: "INVALID_URL",
        message:
          "Please provide a valid Instagram URL (https://www.instagram.com/...)",
      },
    });
    return;
  }
  next();
}

/**
 * Validates `req.query.url` (for GET requests).
 */
export function validateInstagramQuery(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const url = req.query["url"];
  if (typeof url !== "string" || !isValidInstagramUrl(url)) {
    res.status(400).json({
      error: {
        code: "INVALID_URL",
        message:
          "Please provide a valid Instagram URL (https://www.instagram.com/...)",
      },
    });
    return;
  }
  next();
}
