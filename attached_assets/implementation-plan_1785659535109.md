InstaVault — Implementation Plan
Version: 1.0
Date: 2026-08-02
Stack: Expo (React Native) + Express 5 (Node.js) + yt-dlp

Phase Overview
Phase 1 (Days 1–2)   Foundation & API Contract
Phase 2 (Days 3–4)   Backend: yt-dlp Integration + Routes
Phase 3 (Days 5–8)   Mobile App: Core UI + Download Flow
Phase 4 (Days 9–11)  Mobile App: History, Settings, Share Intent
Phase 5 (Days 12–14) Polish, Error Handling, APK Build
Phase 6 (Day 15+)    Release Prep

Phase 1 — Foundation & API Contract (Days 1–2)
1.1 Install Backend Dependencies
pnpm --filter @workspace/api-server add execa node-cache express-rate-limit
pnpm --filter @workspace/api-server add -D @types/node

1.2 Install yt-dlp on Server
# In the Replit backend environment (NixOS)
# Add to artifact's package setup or nix configuration
pip3 install yt-dlp
# OR download binary directly:
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp

1.3 Write OpenAPI Spec
File: lib/api-spec/openapi.yaml

Key endpoints to define:

POST /api/resolve — accepts { url }, returns MediaInfo
GET /api/download — query params url, formatId, index
GET /api/health — liveness check (already exists)
Full schema types:

MediaInfo (resolve response)
MediaFormat (quality option)
CarouselItem (for multi-slide posts)
ErrorResponse
1.4 Run Codegen
pnpm --filter @workspace/api-spec run codegen

This generates:

lib/api-client-react/src/generated/api.ts — React Query hooks
lib/api-zod/src/generated/api.ts — Zod validation schemas
Phase 2 — Backend: yt-dlp Integration (Days 3–4)
2.1 yt-dlp Service (artifacts/api-server/src/services/ytdlp.ts)
Functions to implement:

resolveUrl(url: string): Promise<MediaInfo>
  // Runs: yt-dlp --dump-json --no-playlist <url>
  // Parses JSON, maps to MediaInfo schema
  // Throws typed errors: RateLimitError, PrivateContentError, NotFoundError
downloadMedia(url: string, formatId: string, outPath: string): Promise<void>
  // Runs: yt-dlp --format <formatId> -o <outPath> <url>
  // Handles carousel index via playlist_index selector
  // Streams progress via stderr parsing
getVersion(): Promise<string>
  // Runs: yt-dlp --version
  // Used for health check endpoint

2.2 URL Validator Middleware
// artifacts/api-server/src/middlewares/validateInstagram.ts
// Allowlist: /^https?:\/\/(www\.)?instagram\.com\//
// Rejects: non-Instagram URLs, localhost, IP addresses, file://, etc.

2.3 Rate Limit Middleware
// artifacts/api-server/src/middlewares/rateLimit.ts
// /api/resolve:  30 requests / 15 min / IP
// /api/download: 10 requests / 15 min / IP
// 429 response with Retry-After header

2.4 Temp File Manager
// artifacts/api-server/src/services/tempFiles.ts
// createTempPath(ext: string): string
// cleanup(path: string): Promise<void>
// cleanupOlderThan(minutes: number): Promise<void>  ← cron every 15 min

2.5 In-Process Cache
// artifacts/api-server/src/services/cache.ts
// resolveCache: NodeCache (TTL = 300s)
// key = sha256(url)
// Prevents repeated yt-dlp invocations for the same URL within 5 minutes

2.6 Route Handlers
POST /api/resolve:

1. Zod validate body
2. Validate Instagram URL
3. Check cache (return early if hit)
4. Run ytdlp.resolveUrl()
5. Map yt-dlp raw JSON → MediaInfo schema
6. Store in cache
7. Return MediaInfo

GET /api/download:

1. Zod validate query params
2. Validate Instagram URL
3. Create temp file path
4. Run ytdlp.downloadMedia()
5. Stream file to response with correct Content-Type
6. Set Content-Disposition header
7. Cleanup temp file on response close

2.7 Backend Integration Tests
# Smoke test with a known public Instagram post
curl -X POST http://localhost/api/resolve \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/p/<PUBLIC_SHORTCODE>/"}'

Phase 3 — Mobile App: Core UI + Download Flow (Days 5–8)
3.1 Create Expo Artifact
// Via CodeExecution:
await createArtifact({
  artifactType: "expo",
  slug: "instavault",
  previewPath: "/",
  title: "InstaVault",
  description: "Android app to download Instagram media (posts, reels, stories)"
});

3.2 Install Mobile Dependencies
pnpm --filter @workspace/instavault add \
  zustand \
  react-native-mmkv \
  expo-media-library \
  expo-file-system \
  expo-notifications \
  expo-image \
  expo-video \
  expo-sharing \
  expo-clipboard \
  expo-intent-launcher \
  @shopify/flash-list \
  react-native-reanimated \
  react-native-gesture-handler \
  react-native-safe-area-context \
  @react-native-async-storage/async-storage

3.3 SQLite Database Setup
File: app/instavault/services/database.ts

Schema:

CREATE TABLE IF NOT EXISTS download_records (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  shortcode TEXT,
  media_type TEXT NOT NULL,
  author TEXT,
  author_display_name TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,
  quality TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  progress REAL DEFAULT 0,
  error_message TEXT,
  downloaded_at TEXT,
  saved_to_gallery INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_downloaded_at ON download_records(downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_status ON download_records(status);

3.4 Zustand Download Queue Store
File: app/instavault/store/downloadQueue.ts

State shape:

interface DownloadQueueState {
  items: Map<string, QueueItem>;
  maxConcurrent: number;
  
  enqueue: (params: EnqueueParams) => string;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  updateProgress: (id: string, progress: number) => void;
  complete: (id: string, filePath: string) => void;
  fail: (id: string, error: string) => void;
}

3.5 API Client
File: app/instavault/services/api.ts

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://your-api.replit.app';
async function resolveMedia(url: string): Promise<MediaInfo>
async function getDownloadUrl(url: string, formatId: string, index?: number): string
  // Returns the full /api/download URL (client uses expo-file-system to fetch it)

3.6 Screens to Build
app/(tabs)/index.tsx — Home
Large URL input field with paste button
"Fetch" button → calls useResolveMedia query
Loading skeleton while resolving
MediaPreviewSheet bottom sheet on success
Recent downloads (last 5) grid below input
components/MediaPreviewSheet.tsx
Thumbnail (expo-image)
Author avatar + name
Caption preview (truncated)
Quality selector: radio/segmented control (from format list)
Carousel item selector (if carousel)
"Download" CTA button
"Share" / "Copy URL" secondary actions
components/DownloadProgress.tsx
Progress bar (Reanimated animated width)
File name, quality label
Cancel button
Used on Home (active download) + History
app/(tabs)/history.tsx — History
FlashList (virtualized, 60fps for large lists)
Toggle: grid / list view
Filter chips: All / Videos / Photos / Audio
Search bar (debounced SQLite query)
Each item: thumbnail, author, date, status badge
Long-press context menu: re-download / share / open / delete
app/(tabs)/settings.tsx — Settings
Default quality preference (dropdown)
Default save folder (scoped storage picker)
Concurrent downloads (1 / 2 / 3)
Theme (System / Light / Dark)
Naming template (text input)
Clear cache button
Clear history button (with confirmation dialog)
About: version, yt-dlp version, GitHub link
3.7 Notification Setup
// services/notifications.ts
async function registerForNotifications(): Promise<void>
async function showDownloadProgress(id: string, progress: number, title: string): Promise<void>
async function showDownloadComplete(id: string, fileName: string): Promise<void>
async function showDownloadFailed(id: string, error: string, retryable: boolean): Promise<void>
async function dismissNotification(id: string): Promise<void>

Phase 4 — History, Settings, Share Intent (Days 9–11)
4.1 Share Intent (Android)
Add to AndroidManifest.xml (via app.json / app.config.ts):

{
  "android": {
    "intentFilters": [
      {
        "action": "android.intent.action.SEND",
        "data": [{ "mimeType": "text/plain" }],
        "category": ["android.intent.category.DEFAULT"]
      }
    ]
  }
}

Handle in app/_layout.tsx:

import { getInitialURL, addEventListener } from 'expo-linking';
useEffect(() => {
  // Parse shared URL from intent
  // Navigate to home with pre-filled URL
  // Trigger auto-fetch if URL is valid Instagram URL
}, []);

4.2 Clipboard Watcher (Optional, Settings-controlled)
// When app comes to foreground (AppState event):
// Check clipboard for Instagram URL
// Show non-intrusive toast: "Instagram link detected — tap to download"

4.3 Deep Link Support
URL scheme: instavault://download?url=<encoded>

Configure in app.config.ts:

{
  "scheme": "instavault",
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [{ "scheme": "instavault" }],
        "category": ["DEFAULT", "BROWSABLE"]
      }
    ]
  }
}

4.4 Scoped Storage (Android 10+)
// Use expo-file-system's document directory for app-private storage
// Use expo-media-library to save to public gallery (Photos / Downloads)
// Request WRITE_EXTERNAL_STORAGE only on Android < 10

4.5 Onboarding (First Launch)
3 cards:

"Paste any Instagram link" — demo GIF
"Choose your quality" — format selection screenshot
"Saved to your gallery" — success state screenshot
Store hasSeenOnboarding in MMKV; skip on subsequent launches.

Phase 5 — Polish & APK Build (Days 12–14)
5.1 Error Handling Matrix
Error	User-Facing Message	Action
Invalid URL	"That doesn't look like an Instagram link"	Red input border
Private account	"This account is private — only public content can be saved"	Info sheet
Content deleted	"This post has been deleted or is no longer available"	Error card
Rate limited	"Instagram is asking us to slow down — retrying in X seconds"	Auto-retry with countdown
Network error	"No internet connection"	Retry button
Unsupported type	"This type of Instagram content isn't supported yet"	Feedback link
Server error	"Something went wrong on our end — please try again"	Retry button
5.2 Empty States
History empty: illustration + "No downloads yet — paste a link to get started"
History filtered (no results): "No [type] downloads found"
Download failed: error illustration + message + retry button
5.3 Accessibility
All interactive elements: accessibilityLabel + accessibilityHint
Color contrast ≥ 4.5:1 (WCAG AA)
Support system font size scaling (no hardcoded font sizes)
Screen reader tested with TalkBack
5.4 Performance
All heavy operations off the JS thread (Reanimated worklets, MMKV)
FlashList for any list > 20 items
expo-image with contentFit and cachePolicy="memory-disk"
Lazy-load history items (paginate SQLite: LIMIT 20 OFFSET n)
5.5 Build APK with EAS
# Install EAS CLI
npm install -g eas-cli
# Configure EAS
eas build:configure
# Build Android APK (not AAB, for direct distribution)
eas build --platform android --profile preview
# Build Android AAB (for Play Store)
eas build --platform android --profile production

eas.json:

{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}

5.6 Signing
Generate keystore: keytool -genkeypair -v -keystore instavault.keystore -alias instavault -keyalg RSA -keysize 2048 -validity 10000
Upload to EAS as credential secret
Store backup copy securely (losing keystore = cannot update Play Store listing)
Phase 6 — Release Prep (Day 15+)
6.1 GitHub Release (APK Direct Download)
Tag: v1.0.0
Attach APK artifact from EAS
Release notes: changelog
6.2 F-Droid Submission (Recommended)
F-Droid requires reproducible builds
Submit fdroiddata metadata YAML
Builds happen on F-Droid servers — longer review cycle (~2-4 weeks)
6.3 Google Play Submission (Optional)
Review cycle: 1–3 days for new apps
Note: Play Store policy is strict about downloader apps — review carefully
Alternative: Use a PWA-wrapped approach if Play rejects
6.4 Documentation
README.md: Install, usage, self-hosting instructions
CONTRIBUTING.md: How to add new platform support (extend yt-dlp args)
SELF_HOSTING.md: Deploy your own backend
Testing Checklist
Backend
 POST /api/resolve returns valid MediaInfo for public post
 POST /api/resolve returns valid MediaInfo for reel
 POST /api/resolve returns carousel items for multi-photo post
 POST /api/resolve returns 400 for non-Instagram URL
 POST /api/resolve returns 404 for deleted post
 POST /api/resolve returns 403 for private account
 GET /api/download streams a video file
 GET /api/download streams a photo file
 Rate limiter returns 429 after threshold
 Temp files are cleaned up after download
Mobile
 Paste a post URL → resolve → preview sheet appears
 Select quality → tap Download → progress notification appears
 Download completes → file in gallery + history entry
 Cancel mid-download → file cleaned up
 Share from Instagram app → InstaVault opens → auto-fetch
 History: can scroll 100+ items smoothly
 Settings: quality preference persists after app restart
 Dark mode renders correctly
 Works on Android 8.0 (API 26)
 Works on Android 15 (API 35)
Dependency Versions (Pinned)
{
  "expo": "~52.0.0",
  "react-native": "0.76.x",
  "expo-router": "~4.0.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^5.0.0",
  "react-native-mmkv": "^3.0.0",
  "expo-file-system": "~18.0.0",
  "expo-media-library": "~17.0.0",
  "expo-notifications": "~0.29.0",
  "expo-image": "~2.0.0",
  "expo-video": "~2.0.0",
  "react-native-reanimated": "~3.16.0",
  "@shopify/flash-list": "^1.7.0",
  "execa": "^9.0.0",
  "node-cache": "^5.1.2",
  "express-rate-limit": "^7.0.0"
}