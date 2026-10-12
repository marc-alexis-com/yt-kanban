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

// Video length in seconds (oEmbed has no duration, and the Data API needs a key).
// Returns { seconds } with seconds = null for a live or upcoming stream, or null
// when YouTube did not tell (network error, rate limit, unavailable video).
//
// Two sources, both reading the player response's `videoDetails`:
// 1. the YouTube Music web client's player endpoint: small JSON, and it still
//    returns videoDetails from datacenter IPs, where the regular clients answer
//    "Sign in to confirm you're not a bot";
// 2. the watch page's ytInitialPlayerResponse, as a fallback.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function fetchLength(id) {
  return (await lengthFromMusicPlayer(id)) ?? (await lengthFromWatchPage(id));
}

function lengthFrom(player, id) {
  const details = player?.videoDetails;
  if (!details || details.videoId !== id) return null;
  const live = details.isLive || details.isUpcoming
    || player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow;
  const seconds = Number(details.lengthSeconds);
  return { seconds: !live && Number.isInteger(seconds) && seconds > 0 ? seconds : null };
}

async function lengthFromMusicPlayer(id) {
  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com', 'User-Agent': BROWSER_UA },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'en', gl: 'US' } },
        videoId: id,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? lengthFrom(await res.json(), id) : null;
  } catch {
    return null;
  }
}

async function lengthFromWatchPage(id) {
  try {
    const res = await fetch(watchUrl(id), {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'SOCS=CAI', // skips the EU cookie consent interstitial
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return lengthFrom(extractJsonAfter(await res.text(), 'ytInitialPlayerResponse = '), id);
  } catch {
    return null;
  }
}

// Parses the JSON object literal that follows `marker` in an HTML page,
// matching braces while skipping over string contents.
function extractJsonAfter(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0 || html[start + marker.length] !== '{') return null;
  let depth = 0;
  let inString = false;
  for (let i = start + marker.length; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      return JSON.parse(html.slice(start + marker.length, i + 1));
    }
  }
  return null;
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
