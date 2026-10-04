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

// Rows imported from v1 (or a JSON import) may lack the YouTube id.
const setId = db.prepare('UPDATE videos SET yt_id = ? WHERE id = ?');
for (const row of db.prepare('SELECT id, url FROM videos WHERE yt_id IS NULL').all()) {
  const ytId = extractYtId(row.url);
  if (ytId) setId.run(ytId, row.id);
}
