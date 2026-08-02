import { Platform } from 'react-native';

export interface DownloadRecord {
  id: string;
  url: string;
  shortcode: string;
  mediaType: 'post' | 'reel' | 'story' | 'highlight' | 'carousel' | 'profile';
  author: string;
  authorDisplayName: string;
  thumbnailUrl: string;
  caption: string | null;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  quality: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  errorMessage: string | null;
  downloadedAt: string;
  savedToGallery: boolean;
}

// SQLite is only available on native platforms
let db: import('expo-sqlite').SQLiteDatabase | null = null;

function getDb(): import('expo-sqlite').SQLiteDatabase {
  if (!db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLite = require('expo-sqlite');
    db = SQLite.openDatabaseSync('instavault.db');
  }
  return db!;
}

export function initDatabase(): void {
  if (Platform.OS === 'web') return;
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY NOT NULL,
      url TEXT NOT NULL,
      shortcode TEXT NOT NULL,
      mediaType TEXT NOT NULL,
      author TEXT NOT NULL,
      authorDisplayName TEXT NOT NULL,
      thumbnailUrl TEXT NOT NULL,
      caption TEXT,
      filePath TEXT NOT NULL,
      fileName TEXT NOT NULL,
      fileSize INTEGER NOT NULL DEFAULT 0,
      mimeType TEXT NOT NULL,
      quality TEXT NOT NULL,
      status TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      errorMessage TEXT,
      downloadedAt TEXT NOT NULL,
      savedToGallery INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_downloadedAt ON downloads(downloadedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_status ON downloads(status);
  `);
}

export function insertDownload(record: DownloadRecord): void {
  if (Platform.OS === 'web') return;
  getDb().runSync(
    `INSERT OR REPLACE INTO downloads
      (id, url, shortcode, mediaType, author, authorDisplayName, thumbnailUrl,
       caption, filePath, fileName, fileSize, mimeType, quality, status,
       progress, errorMessage, downloadedAt, savedToGallery)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.url,
      record.shortcode,
      record.mediaType,
      record.author,
      record.authorDisplayName,
      record.thumbnailUrl,
      record.caption ?? null,
      record.filePath,
      record.fileName,
      record.fileSize,
      record.mimeType,
      record.quality,
      record.status,
      record.progress,
      record.errorMessage ?? null,
      record.downloadedAt,
      record.savedToGallery ? 1 : 0,
    ],
  );
}

export function updateDownloadStatus(
  id: string,
  status: DownloadRecord['status'],
  extra?: Partial<Pick<DownloadRecord, 'progress' | 'errorMessage' | 'filePath' | 'savedToGallery'>>,
): void {
  if (Platform.OS === 'web') return;
  const fields: string[] = ['status = ?'];
  const values: (string | number | null)[] = [status];

  if (extra?.progress !== undefined) {
    fields.push('progress = ?');
    values.push(extra.progress);
  }
  if (extra?.errorMessage !== undefined) {
    fields.push('errorMessage = ?');
    values.push(extra.errorMessage);
  }
  if (extra?.filePath !== undefined) {
    fields.push('filePath = ?');
    values.push(extra.filePath);
  }
  if (extra?.savedToGallery !== undefined) {
    fields.push('savedToGallery = ?');
    values.push(extra.savedToGallery ? 1 : 0);
  }

  values.push(id);
  getDb().runSync(`UPDATE downloads SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function getDownloads(limit = 20, offset = 0, filter?: {
  mediaType?: string;
  status?: string;
  search?: string;
}): DownloadRecord[] {
  if (Platform.OS === 'web') return [];

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter?.mediaType && filter.mediaType !== 'all') {
    conditions.push('mediaType = ?');
    params.push(filter.mediaType);
  }
  if (filter?.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter?.search) {
    conditions.push('(author LIKE ? OR authorDisplayName LIKE ? OR caption LIKE ? OR fileName LIKE ?)');
    const q = `%${filter.search}%`;
    params.push(q, q, q, q);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const rows = getDb().getAllSync<Record<string, unknown>>(
    `SELECT * FROM downloads ${where} ORDER BY downloadedAt DESC LIMIT ? OFFSET ?`,
    params,
  );

  return rows.map(rowToRecord);
}

export function getDownloadById(id: string): DownloadRecord | null {
  if (Platform.OS === 'web') return null;
  const row = getDb().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM downloads WHERE id = ?',
    [id],
  );
  return row ? rowToRecord(row) : null;
}

export function deleteDownload(id: string): void {
  if (Platform.OS === 'web') return;
  getDb().runSync('DELETE FROM downloads WHERE id = ?', [id]);
}

export function searchDownloads(query: string, limit = 50): DownloadRecord[] {
  if (Platform.OS === 'web') return [];
  return getDownloads(limit, 0, { search: query });
}

function rowToRecord(row: Record<string, unknown>): DownloadRecord {
  return {
    id: row['id'] as string,
    url: row['url'] as string,
    shortcode: row['shortcode'] as string,
    mediaType: row['mediaType'] as DownloadRecord['mediaType'],
    author: row['author'] as string,
    authorDisplayName: row['authorDisplayName'] as string,
    thumbnailUrl: row['thumbnailUrl'] as string,
    caption: (row['caption'] as string | null) ?? null,
    filePath: row['filePath'] as string,
    fileName: row['fileName'] as string,
    fileSize: row['fileSize'] as number,
    mimeType: row['mimeType'] as string,
    quality: row['quality'] as string,
    status: row['status'] as DownloadRecord['status'],
    progress: row['progress'] as number,
    errorMessage: (row['errorMessage'] as string | null) ?? null,
    downloadedAt: row['downloadedAt'] as string,
    savedToGallery: row['savedToGallery'] === 1,
  };
}
