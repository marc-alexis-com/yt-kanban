// HTTP server: JSON API under /api, cached thumbnails under /thumbs, and the
// built frontend (web/dist) for everything else.
// There is no login here on purpose: put the app behind your reverse proxy's
// authentication (see README).
import express from 'express';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { db, parseDuration } from './db.js';
import { extractYtId, watchUrl, fetchMetadata, fetchLength, ensureThumb, thumbPath } from './youtube.js';
import { backfillLengths } from './lengths.js';
import { suggestThemes, triageEnabled } from './triage.js';

const webDist = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

const getVideo = db.prepare('SELECT * FROM videos WHERE id = ?');
const toJson = (v) => ({ ...v, viewed: Boolean(v.viewed) });

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.json({ inboxTheme: config.inboxTheme, triage: triageEnabled() });
});

app.get('/api/videos', (req, res) => {
  const rows = db.prepare('SELECT * FROM videos ORDER BY theme, LOWER(author), LOWER(title)').all();
  res.json(rows.map(toJson));
});

// Add videos from a block of text: one URL (or bare id) per line.
// Non-YouTube lines and duplicates come back in `ignored` with a reason.
app.post('/api/videos', async (req, res) => {
  const lines = String(req.body?.urls ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const added = [];
  const ignored = [];
  const seen = new Set();
  const exists = db.prepare('SELECT 1 FROM videos WHERE yt_id = ? OR url = ?');
  const insert = db.prepare(
    `INSERT INTO videos (url, yt_id, title, author, theme, added_at, length_seconds, length_checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  );

  for (const line of lines) {
    const ytId = extractYtId(line);
    if (!ytId) { ignored.push({ url: line, reason: 'not a YouTube link' }); continue; }
    if (seen.has(ytId)) { ignored.push({ url: line, reason: 'twice in the list' }); continue; }
    seen.add(ytId);
    const url = watchUrl(ytId);
    if (exists.get(ytId, url)) { ignored.push({ url: line, reason: 'already on the board' }); continue; }

    const [meta, length] = await Promise.all([fetchMetadata(ytId), fetchLength(ytId), ensureThumb(ytId)]);
    const now = new Date().toISOString();
    const row = insert.get(
      url, ytId, meta?.title || `Video ${ytId}`, meta?.author || '', config.inboxTheme, now,
      length?.seconds ?? null, now,
    );
    added.push(toJson(row));
  }
  res.json({ added, ignored });
});

// Partial update: { theme } and/or { viewed }.
app.patch('/api/videos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getVideo.get(id)) return res.status(404).json({ error: 'not found' });
  const { theme, viewed } = req.body ?? {};
  if (theme !== undefined) {
    if (typeof theme !== 'string' || !theme.trim()) return res.status(400).json({ error: 'theme must be a non-empty string' });
    db.prepare('UPDATE videos SET theme = ? WHERE id = ?').run(theme.trim(), id);
  }
  if (viewed !== undefined) {
    if (typeof viewed !== 'boolean') return res.status(400).json({ error: 'viewed must be a boolean' });
    db.prepare('UPDATE videos SET viewed = ?, viewed_at = ? WHERE id = ?')
      .run(viewed ? 1 : 0, viewed ? new Date().toISOString() : null, id);
  }
  res.json(toJson(getVideo.get(id)));
});

app.delete('/api/videos/:id', (req, res) => {
  const r = db.prepare('DELETE FROM videos WHERE id = ?').run(Number(req.params.id));
  if (r.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// Rename a whole column (every video of a theme moves to the new name, which
// merges the two columns if it already exists).
app.post('/api/themes/rename', (req, res) => {
  const from = String(req.body?.from ?? '').trim();
  const to = String(req.body?.to ?? '').trim();
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  const r = db.prepare('UPDATE videos SET theme = ? WHERE theme = ?').run(to, from);
  res.json({ moved: r.changes });
});

// AI triage, in two steps so nothing moves without the user's say-so.
app.post('/api/triage/suggest', async (req, res) => {
  if (!triageEnabled()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set' });
  try {
    res.json({ suggestions: await suggestThemes() });
  } catch (err) {
    console.error('triage failed:', err);
    res.status(502).json({ error: String(err.message || err) });
  }
});

app.post('/api/triage/apply', (req, res) => {
  const items = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
  const move = db.prepare('UPDATE videos SET theme = ? WHERE id = ? AND theme = ?');
  let moved = 0;
  db.exec('BEGIN');
  for (const { id, theme } of items) {
    if (Number.isInteger(id) && typeof theme === 'string' && theme.trim()) {
      moved += move.run(theme.trim(), id, config.inboxTheme).changes;
    }
  }
  db.exec('COMMIT');
  res.json({ moved });
});

// Export / import: the whole board as JSON (thumbnails are re-downloaded on demand).
app.get('/api/export', (req, res) => {
  const videos = db
    .prepare('SELECT url, title, author, duration, length_seconds, views, theme, viewed, viewed_at, added_at FROM videos ORDER BY id')
    .all()
    .map(toJson);
  const date = new Date().toISOString().slice(0, 10);
  res.attachment(`yt-kanban-${date}.json`);
  res.json({ format: 'yt-kanban', version: 1, exported_at: new Date().toISOString(), videos });
});

// Merges by URL: new videos are added, existing ones get the imported theme and
// viewed state. Nothing is deleted.
app.post('/api/import', (req, res) => {
  const videos = Array.isArray(req.body?.videos) ? req.body.videos : null;
  if (!videos) return res.status(400).json({ error: 'expected { videos: [...] } (a file from Export)' });
  const upsert = db.prepare(
    `INSERT INTO videos (url, yt_id, title, author, duration, length_seconds, views, theme, viewed, viewed_at, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET theme = excluded.theme, viewed = excluded.viewed, viewed_at = excluded.viewed_at,
       length_seconds = COALESCE(videos.length_seconds, excluded.length_seconds)`,
  );
  const before = db.prepare('SELECT COUNT(*) AS n FROM videos').get().n;
  let skipped = 0;
  db.exec('BEGIN');
  for (const v of videos) {
    if (!v?.url || !v?.title) { skipped++; continue; }
    const ytId = extractYtId(v.url);
    const length = Number.isInteger(v.length_seconds) && v.length_seconds > 0
      ? v.length_seconds
      : parseDuration(v.duration);
    upsert.run(
      ytId ? watchUrl(ytId) : String(v.url), ytId, String(v.title), String(v.author ?? ''),
      String(v.duration ?? ''), length, String(v.views ?? ''), String(v.theme || config.inboxTheme),
      v.viewed ? 1 : 0, v.viewed_at ?? null, v.added_at ?? null,
    );
  }
  db.exec('COMMIT');
  backfillLengths(); // imported videos without a length, in the background
  const after = db.prepare('SELECT COUNT(*) AS n FROM videos').get().n;
  res.json({ added: after - before, updated: videos.length - skipped - (after - before), skipped });
});

app.get('/thumbs/:file', async (req, res) => {
  const ytId = req.params.file.replace(/\.jpg$/, '');
  if (!/^[A-Za-z0-9_-]{11}$/.test(ytId)) return res.status(404).end();
  if (!(await ensureThumb(ytId))) return res.status(404).end();
  res.sendFile(thumbPath(ytId), { maxAge: '30d', immutable: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: '1y', immutable: true }));
  // index.html must not be cached: it points to the hashed assets of the current build
  app.get('/{*any}', (req, res) => res.sendFile(join(webDist, 'index.html'), { maxAge: 0 }));
}

app.listen(config.port, () => {
  console.log(`yt-kanban listening on :${config.port} (data: ${config.dataDir}, triage: ${triageEnabled() ? 'on' : 'off'})`);
  // Not awaited: runs in the background, then again every 6 hours for failed lookups.
  backfillLengths();
  setInterval(backfillLengths, 6 * 3600 * 1000).unref();
});
