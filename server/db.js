// SQLite storage (built-in node:sqlite, no native dependency).
// Schema changes are numbered migrations tracked with PRAGMA user_version.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { config } from './config.js';
import { extractYtId } from './youtube.js';

mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

const migrations = [
  // 1: the original table (databases from v1 already have it)
  `CREATE TABLE IF NOT EXISTS videos (
     id        INTEGER PRIMARY KEY AUTOINCREMENT,
     url       TEXT NOT NULL UNIQUE,
     title     TEXT NOT NULL,
     author    TEXT NOT NULL DEFAULT '',
     duration  TEXT NOT NULL DEFAULT '',
     views     TEXT NOT NULL DEFAULT '',
     theme     TEXT NOT NULL,
     viewed    INTEGER NOT NULL DEFAULT 0,
     viewed_at TEXT
   )`,
  // 2: YouTube id as its own column (thumbnails, dedup), and when a video was added
  `ALTER TABLE videos ADD COLUMN yt_id TEXT;
   ALTER TABLE videos ADD COLUMN added_at TEXT;
   CREATE INDEX IF NOT EXISTS videos_theme ON videos(theme);`,
  // 3: video length in seconds (NULL: unknown or live), and when it was last looked up
  //    so failures are not retried in a loop. Seeded from v1's "1:02:15" text column.
  `ALTER TABLE videos ADD COLUMN length_seconds INTEGER;
   ALTER TABLE videos ADD COLUMN length_checked_at TEXT;`,
];

const current = db.prepare('PRAGMA user_version').get().user_version;
for (let v = current; v < migrations.length; v++) {
  db.exec('BEGIN');
  try {
    db.exec(migrations[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// "4:07" / "1:02:15" -> seconds, or null when the text is not a duration.
export function parseDuration(text) {
  const m = String(text ?? '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return seconds > 0 ? seconds : null;
}

// Legacy (v1 or imported) durations: use them instead of asking YouTube again.
const setLength = db.prepare('UPDATE videos SET length_seconds = ? WHERE id = ?');
for (const row of db.prepare("SELECT id, duration FROM videos WHERE length_seconds IS NULL AND duration != ''").all()) {
  const seconds = parseDuration(row.duration);
  if (seconds) setLength.run(seconds, row.id);
}

// Rows imported from v1 (or a JSON import) may lack the YouTube id.
const setId = db.prepare('UPDATE videos SET yt_id = ? WHERE id = ?');
for (const row of db.prepare('SELECT id, url FROM videos WHERE yt_id IS NULL').all()) {
  const ytId = extractYtId(row.url);
  if (ytId) setId.run(ytId, row.id);
}
