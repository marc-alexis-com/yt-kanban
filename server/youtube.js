// Everything that talks to YouTube: id parsing, oEmbed metadata, thumbnails.
// No API key needed: oEmbed and i.ytimg.com are public.
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';

const ID_RE = /(?:[?&]v=|\/shorts\/|\/live\/|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
const ID_ONLY_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYtId(text) {
  const s = String(text).trim();
  if (ID_ONLY_RE.test(s)) return s;
  return s.match(ID_RE)?.[1] ?? null;
}

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

// Title and channel name. Returns null when YouTube does not answer (private,
// deleted or region-locked video): the caller keeps a placeholder title.
export async function fetchMetadata(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(id))}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const meta = await res.json();
    return { title: meta.title || '', author: meta.author_name || '' };
  } catch {
    return null;
  }
}

// Thumbnails are cached on disk the first time they are requested, so a lost
// or partial cache heals itself.
const inFlight = new Map();

export function thumbPath(id) {
  return join(config.thumbsDir, `${id}.jpg`);
}

export async function ensureThumb(id) {
  const dst = thumbPath(id);
  if (existsSync(dst)) return true;
  if (!inFlight.has(id)) {
    inFlight.set(id, downloadThumb(id, dst).finally(() => inFlight.delete(id)));
  }
  return inFlight.get(id);
}

async function downloadThumb(id, dst) {
  await mkdir(config.thumbsDir, { recursive: true });
  for (const quality of ['hqdefault', 'mqdefault']) {
    try {
      const res = await fetch(`https://i.ytimg.com/vi/${id}/${quality}.jpg`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok || !res.body) continue;
      const tmp = `${dst}.part`;
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      await rename(tmp, dst);
      return true;
    } catch {
      await unlink(`${dst}.part`).catch(() => {});
    }
  }
  return false;
}
