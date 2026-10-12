// Background backfill of video lengths: one watch page at a time, a couple per
// second, only for rows that never got one (or whose last attempt is over a day
// old). Stops early if YouTube keeps refusing, so it never hammers it.
import { db } from './db.js';
import { fetchLength } from './youtube.js';

const DELAY_MS = 500;
const RETRY_AFTER_MS = 24 * 3600 * 1000;
const MAX_CONSECUTIVE_FAILURES = 10;

const save = db.prepare('UPDATE videos SET length_seconds = ?, length_checked_at = ? WHERE id = ?');

// Looks up one video and stores the result. Returns false when YouTube did not answer.
export async function updateLength(id, ytId) {
  const result = await fetchLength(ytId);
  save.run(result?.seconds ?? null, new Date().toISOString(), id);
  return result !== null;
}

let running = false;

export async function backfillLengths() {
  if (running) return;
  running = true;
  try {
    const cutoff = new Date(Date.now() - RETRY_AFTER_MS).toISOString();
    const rows = db
      .prepare(
        `SELECT id, yt_id FROM videos
         WHERE length_seconds IS NULL AND yt_id IS NOT NULL
           AND (length_checked_at IS NULL OR length_checked_at < ?)
         ORDER BY id DESC`,
      )
      .all(cutoff);
    if (!rows.length) return;
    console.log(`lengths: looking up ${rows.length} videos`);
    let done = 0;
    let failures = 0;
    for (const row of rows) {
      if (await updateLength(row.id, row.yt_id)) {
        done++;
        failures = 0;
      } else if (++failures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`lengths: ${failures} failures in a row, stopping (will retry at next start)`);
        break;
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    console.log(`lengths: done, ${done}/${rows.length} looked up`);
  } catch (err) {
    console.error('lengths: backfill failed:', err);
  } finally {
    running = false;
  }
}
