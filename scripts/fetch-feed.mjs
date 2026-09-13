#!/usr/bin/env node
/* Baut assets/data/videos.json aus dem YouTube-RSS des VOD-Kanals.
 * Lauf: lokal (node scripts/fetch-feed.mjs) oder per GitHub Action (stündlich).
 * Keine Dependencies, keine API-Keys. Schreibt nur bei Änderung. */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'data', 'videos.json');
const OUT_JS = join(ROOT, 'assets', 'data', 'videos.js');

const CHANNEL_ID = 'UCTTbSiyRUop-hMeZGIJD_QA';
const HANDLE = '@ZevKevPlus';
const CHANNEL_URL = 'https://www.youtube.com/@ZevKevPlus';
const MAX_ITEMS = 24;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const PROBE_DELAY_MS = 800;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadOldShorts() {
  try {
    if (!existsSync(OUT)) return new Map();
    const raw = readFileSync(OUT, 'utf8');
    const old = JSON.parse(raw);
    const map = new Map();
    for (const it of (old && old.items) || []) {
      if (it && typeof it.id === 'string' && Object.prototype.hasOwnProperty.call(it, 'shorts')) {
        map.set(it.id, it.shorts);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function probeShorts(id) {
  const url = 'https://www.youtube.com/shorts/' + id;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
      }
    });
    const s = res.status;
    // Body verwerfen, Verbindung freigeben
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    if (s === 200) return true;
    if (s === 429) return null;
    if ((s >= 300 && s < 400) || s === 404) return false;
    return null;
  } catch {
    return null;
  } finally { clearTimeout(t); }
}

async function withShortsFlags(items) {
  const known = loadOldShorts();
  let probed = 0;
  for (const it of items) {
    if (known.has(it.id)) {
      it.shorts = known.get(it.id);
      continue;
    }
    if (probed > 0) await sleep(PROBE_DELAY_MS);
    probed++;
    let flag = null;
    try {
      flag = await probeShorts(it.id);
    } catch {
      flag = null;
    }
    it.shorts = flag;
    console.log('shorts-probe ' + it.id + ' -> ' + String(flag));
  }
  return items;
}

function unescapeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function pick(block, re) {
  const m = block.match(re);
  return m ? unescapeXml(m[1].trim()) : '';
}

async function fetchRss() {
  const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ZEVKEV-VOD-Feedbot/1.0 (+https://vod.zevkev.me)', Accept: 'application/atom+xml' }
    });
    if (!res.ok) throw new Error('RSS HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(t); }
}

function parse(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  const seen = new Set();
  const items = [];
  for (const e of entries) {
    const id = pick(e, /<(?:yt:)?videoId>([^<]+)<\/(?:yt:)?videoId>/);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = pick(e, /<title>([\s\S]*?)<\/title>/) || 'Video';
    const published = pick(e, /<published>([^<]+)<\/published>/);
    const linkM = e.match(/<link[^>]*href="([^"]+)"[^>]*\/>/) || e.match(/<link[^>]*href="([^"]+)"/);
    const ts = Date.parse(published);
    items.push({
      id,
      title,
      published,
      ts: isNaN(ts) ? 0 : ts,
      link: linkM ? linkM[1] : 'https://www.youtube.com/watch?v=' + id,
      thumb: 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg',
      thumbFallback: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
      views: Number((e.match(/<media:statistics[^>]*views="(\d+)"/) || [0, 0])[1]) || 0
    });
  }
  return items
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_ITEMS);
}

const xml = await fetchRss();
const items = parse(xml);
if (!items.length) throw new Error('Feed enthält keine Entries — Abbruch ohne Schreiben.');
await withShortsFlags(items);

const data = {
  channel: { handle: HANDLE, channelId: CHANNEL_ID, label: 'VOD-Kanal', url: CHANNEL_URL },
  fetchedAt: new Date().toISOString(),
  items
};
mkdirSync(dirname(OUT), { recursive: true });
const next = JSON.stringify(data, null, 2) + '\n';
// videos.js: gleiche Daten als klassisches Script. Script-Tags unterliegen
// NICHT der fetch-CORS-Sperre, daher funktioniert die Seite auch per file://
const nextJs = 'window.ZV_FEED_DATA = ' + JSON.stringify(data) + ';\n';
let prev = '';
try { prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''; } catch { prev = ''; }
let prevJs = '';
try { prevJs = existsSync(OUT_JS) ? readFileSync(OUT_JS, 'utf8') : ''; } catch { prevJs = ''; }
if (prev === next && prevJs === nextJs) {
  console.log('videos.json/videos.js unverändert (' + items.length + ' Videos).');
} else {
  writeFileSync(OUT, next);
  writeFileSync(OUT_JS, nextJs);
  console.log('videos.json + videos.js geschrieben (' + items.length + ' Videos).');
}
