/* ============================================================
   Modul: assets/js/youtube-feed.js
   Quelle 1: assets/data/videos.json (stündlicher Action-Cache,
   same-origin = Millisekunden, kein Proxy nötig).
   Quelle 2 (Fallback): parallele Proxy-Race direkt/allorigins/
   rss2json. Diagnose per ?debug=yt in #vod-count + Konsole.
   Tabs: Alle / Videos / Stream-VODs + Suche. Klick -> Modal.
   ============================================================ */
(function () {
  const cfg = () => window.ZV_CONFIG.youtube;
  const CACHE_KEY = 'zv_yt_cache_v5';
  const NS_MEDIA = 'http://search.yahoo.com/mrss/';
  const DEBUG = /[?&]debug=yt\b/.test(location.search);
  let PLUS = [];
  let source = '…';
  let loaded = false;
  let activeFilter = 'alle'; // 'alle' | 'videos' | 'streams'
  let query = '';
  let searchTimer = null;

  function log() { if (DEBUG) console.log.apply(console, ['[yt]'].concat([].slice.call(arguments))); }

  function elText(parent, local) {
    try {
      const list = parent.getElementsByTagNameNS('*', local);
      if (list.length && list[0].textContent) return list[0].textContent.trim();
    } catch (e) {}
    const el = parent.querySelector(local);
    return el && el.textContent ? el.textContent.trim() : '';
  }

  function norm(raw) {
    const ts = Date.parse(raw.published || '');
    const id = String(raw.id || '').trim();
    if (!id) return null;
    return {
      id,
      title: String(raw.title || 'Video'),
      published: raw.published || '',
      ts: isNaN(ts) ? 0 : ts,
      link: raw.link || 'https://www.youtube.com/watch?v=' + id,
      thumb: raw.thumb || 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg',
      thumbFallback: raw.thumbFallback || 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
      views: Number(raw.views) || 0,
      shorts: raw.shorts === true ? true : raw.shorts === false ? false : null
    };
  }

  /* ---------- Quelle 1: Action-Cache ---------- */
  async function loadJson() {
    const res = await fetch('assets/data/videos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('videos.json HTTP ' + res.status);
    const json = await res.json();
    const items = (json.items || []).map(norm).filter(Boolean);
    if (!items.length) throw new Error('videos.json ohne Items');
    return items;
  }

  /* ---------- Quelle 2: Live-Fallback (Proxy-Race) ---------- */
  function rssUrl(id) { return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(id); }

  function parseXml(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML-Parsefehler');
    return Array.from(doc.querySelectorAll('entry')).map((e) => {
      const videoId = elText(e, 'videoId');
      const linkEl = e.querySelector('link[rel="alternate"]');
      const link = linkEl ? linkEl.getAttribute('href') : '';
      let thumb = '', views = 0;
      try {
        const thumbs = e.getElementsByTagNameNS(NS_MEDIA, 'thumbnail');
        if (thumbs.length && thumbs[0].getAttribute('url')) thumb = thumbs[0].getAttribute('url');
        const stats = e.getElementsByTagNameNS(NS_MEDIA, 'statistics');
        if (stats.length) views = parseInt(stats[0].getAttribute('views') || '0', 10) || 0;
      } catch (err) {}
      return norm({ id: videoId, title: elText(e, 'title'), published: elText(e, 'published'), link, thumb, views });
    }).filter(Boolean);
  }

  async function fetchText(url, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 7000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } finally { clearTimeout(t); }
  }

  function nonEmpty(p) { return p.then((items) => (items && items.length ? items : Promise.reject(new Error('leer')))); }

  async function loadLive() {
    const url = rssUrl(cfg().primary.channelId);
    const jobs = [
      nonEmpty(fetchText(url, 4000).then((xml) => (xml.includes('<entry') ? parseXml(xml) : []))),
      nonEmpty(fetchText('https://api.allorigins.win/get?url=' + encodeURIComponent(url), 7000).then((raw) => {
        const c = JSON.parse(raw).contents || '';
        return c.includes('<entry') ? parseXml(c) : [];
      })),
      nonEmpty(fetchText('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url), 7000).then((raw) => {
        const j = JSON.parse(raw);
        if (j.status !== 'ok') return [];
        return (j.items || []).map((it) => {
          const m = String(it.link || '').match(/[?&]v=([\w-]{6,})/) || String(it.guid || '').match(/([\w-]{11})/);
          return norm({ id: m ? m[1] : '', title: it.title, published: it.pubDate, link: it.link });
        }).filter(Boolean);
      }))
    ];
    return Promise.any(jobs);
  }

  /* ---------- Cache (Browser) ---------- */
  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const json = JSON.parse(raw);
      if (!json || !Array.isArray(json.items)) return null;
      return json;
    } catch (e) { return null; }
  }
  function isFresh(ts) {
    try { return (Date.now() - ts) / 60000 <= cfg().cacheMinutes; } catch (e) { return false; }
  }
  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 5, ts: Date.now(), items: PLUS })); } catch (e) {}
  }

  /* ---------- Filter/Format ---------- */
  function isStreamLike(v) {
    const t = ' ' + v.title.toLowerCase() + ' ';
    return cfg().streamKeywords.some((k) => t.includes(String(k).toLowerCase()));
  }
  function isNeu(v) {
    if (!v.ts) return false;
    return (Date.now() - v.ts) / 86400000 <= cfg().neuDays;
  }
  function fmtDate(v) {
    if (!v.ts) return '';
    try { return new Date(v.ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  }
  function fmtViews(n) {
    if (!n || n <= 0) return '';
    try { return n.toLocaleString('de-DE') + ' Aufrufe'; } catch (e) { return n + ' Aufrufe'; }
  }
  function fmtViewsShort(n) {
    if (!n || n <= 0) return '';
    if (n >= 1000) return '👁 ' + (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Tsd';
    return '👁 ' + n;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function matchesTab(v) {
    if (activeFilter === 'videos') return !isStreamLike(v);
    if (activeFilter === 'streams') return isStreamLike(v);
    return true;
  }

  function thumbImg(v, eager) {
    return '<img ' + (eager ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"')
      + ' width="480" height="360" src="' + v.thumb + '" data-fb="' + v.thumbFallback + '"'
      + ' onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=\'\';}"'
      + ' alt="' + escapeHtml(v.title) + '">';
  }

  function cardHtml(v, num) {
    const date = fmtDate(v);
    const views = fmtViews(v.views);
    const meta = [views, date].filter(Boolean).join(' · ');
    const kind = isStreamLike(v) ? 'Stream-VOD' : 'Video';
    const right = (typeof num === 'number')
      ? '<span class="zv-chip zv-chip--right">#' + num + '</span>'
      : (v.views > 0 ? '<span class="zv-chip zv-chip--right">' + escapeHtml(fmtViewsShort(v.views)) + '</span>' : '');
    return '<a class="zv-card zv-reveal zv-on" data-video="' + v.id + '" href="' + v.link + '" target="_blank" rel="noopener">'
      + '<span class="zv-card__thumb">' + thumbImg(v, false)
      + '<span class="zv-chip zv-chip--left">▶ ' + kind + '</span>' + right
      + (isNeu(v) ? '<span class="zv-chip zv-chip--neu">Neu</span>' : '')
      + '</span>'
      + '<span class="zv-card__body"><h3>' + escapeHtml(v.title) + '</h3>'
      + (meta ? '<span class="zv-card__meta">' + escapeHtml(meta) + '</span>' : '')
      + '</span></a>';
  }

  function emptyHtml(hint) {
    return '<p class="zv-empty">' + hint
      + ' <a href="' + cfg().channelUrl + '" target="_blank" rel="noopener">VOD-Kanal @ZevKevPlus öffnen →</a></p>';
  }

  function longs() { return PLUS.filter((v) => v.shorts !== true); }

  function renderRail(id, list, emptyHint) {
    const rail = document.getElementById(id);
    if (!rail) return;
    rail.innerHTML = list.length ? list.map((v) => cardHtml(v)).join('') : emptyHtml(emptyHint);
  }

  function renderClips() {
    const grid = document.getElementById('clips-grid');
    const count = document.getElementById('clips-count');
    const clips = PLUS.filter((v) => v.shorts === true);
    if (grid) {
      grid.innerHTML = clips.length
        ? clips.map((v) => cardHtml(v)).join('')
        : emptyHtml('Noch keine Clips.');
    }
    if (count) {
      count.textContent = clips.length
        ? clips.length + (clips.length === 1 ? ' Clip' : ' Clips') + ' vom VOD-Kanal'
        : 'Noch keine Clips.';
    }
    const skel = document.getElementById('clips-skeleton');
    if (skel) skel.style.display = 'none';
  }

  function renderAll() {
    const q = query;
    const inTab = PLUS.filter((v) => matchesTab(v) && (!q || v.title.toLowerCase().includes(q)));
    const count = document.getElementById('vod-count');
    if (!PLUS.length) {
      const rail = document.getElementById('vod-rail');
      if (rail) rail.innerHTML = emptyHtml('Der VOD-Kanal lädt gerade bzw. ist noch leer.');
    } else if (!inTab.length) {
      renderRail('vod-rail', [], q ? 'Keine Treffer für diese Suche.' : 'In diesem Tab ist gerade nichts.');
    } else {
      renderRail('vod-rail', inTab);
    }
    // Weiter ansehen (lokal gespeichert)
    renderContinue();
    // Top-VODs nach Views
    const top = PLUS.slice().sort((a, b) => b.views - a.views).filter((v) => v.views > 0).slice(0, 6);
    const topRail = document.getElementById('top-rail');
    if (topRail) topRail.innerHTML = top.length ? top.map((v) => cardHtml(v)).join('') : emptyHtml('Noch keine Aufrufzahlen. Schau bald wieder vorbei.');
    const topSec = document.getElementById('top-section');
    if (topSec) topSec.style.display = top.length ? '' : 'none';
    // Clips vom VOD-Kanal (nur sicher erkannte Shorts, neueste zuerst)
    renderClips();
    if (count) {
      let txt;
      if (!PLUS.length) txt = 'Wird geladen …';
      else if (!inTab.length) txt = '0 Treffer vom VOD-Kanal';
      else txt = inTab.length + (inTab.length === 1 ? ' Video' : ' Videos') + ' vom VOD-Kanal' + (q ? ' · Suche: „' + query + '“' : '');
      if (DEBUG) txt = '[Quelle: ' + source + '] ' + txt;
      count.textContent = txt;
    }
    ['vod-skeleton', 'clips-skeleton'].forEach((id) => {
      const s = document.getElementById(id);
      if (s) s.style.display = 'none';
    });
    log('render', { total: PLUS.length, inTab: inTab.length, source });
  }

  function renderContinue() {
    const sec = document.getElementById('continue-section');
    const rail = document.getElementById('continue-rail');
    if (!sec || !rail || !window.ZV_STORE) return;
    const ids = window.ZV_STORE.getRecent();
    const vids = ids.map((id) => PLUS.find((v) => v.id === id)).filter(Boolean).slice(0, 8);
    sec.style.display = vids.length ? '' : 'none';
    if (vids.length) rail.innerHTML = vids.map((v) => cardHtml(v)).join('');
  }

  function fireReady() {
    document.dispatchEvent(new CustomEvent('zv:yt-ready', { detail: { plus: PLUS } }));
    document.dispatchEvent(new CustomEvent('zv:feed', { detail: { plus: PLUS } }));
  }

  function applyItems(items, src) {
    const seen = new Set();
    PLUS = items
      .filter((v) => v && v.id && (seen.has(v.id) ? false : (seen.add(v.id), true)))
      .sort((x, y) => y.ts - x.ts)
      .slice(0, cfg().maxItems);
    source = src;
    if (PLUS.length) writeCache();
  }

  async function load() {
    // 1) Browser-Cache sofort (stale-while-revalidate)
    const cached = readCache();
    if (cached && cached.items.length) {
      PLUS = cached.items;
      source = isFresh(cached.ts) ? 'browser-cache' : 'browser-cache (alt)';
      renderAll();
      fireReady();
      log('cache hit', PLUS.length, source);
    }
    // 2) Action-JSON (schnell, same-origin)
    try {
      const items = await loadJson();
      applyItems(items, 'videos.json');
      loaded = true;
      renderAll();
      fireReady();
      log('videos.json OK', items.length);
      return;
    } catch (e) { log('videos.json fail:', e.message || e); }
    // 2b) Eingebettete Daten (klassisches Script, funktioniert auch per file://)
    try {
      const embedded = window.ZV_FEED_DATA;
      const items = embedded && Array.isArray(embedded.items)
        ? embedded.items.map(norm).filter(Boolean) : [];
      if (!items.length) throw new Error('videos.js ohne Items');
      applyItems(items, 'videos.js (eingebettet)');
      loaded = true;
      renderAll();
      fireReady();
      log('videos.js OK', items.length);
      return;
    } catch (e) { log('videos.js fail:', e.message || e); }
    // 3) Live-Fallback (Proxy-Race)
    try {
      const raced = await Promise.race([
        loadLive(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('live-timeout')), 14000))
      ]);
      applyItems(raced, 'live-proxy');
      log('live-proxy OK', raced.length);
    } catch (e) { log('live-proxy fail:', e.message || e); }
    if (!loaded) {
      loaded = true;
      // Falls Cache schon gezeigt wurde, nicht überschreiben
      if (!PLUS.length) { source = 'leer'; }
      renderAll();
      fireReady();
    }
  }

  function firstVod() { return (longs()[0] || PLUS[0] || null); }

  function setTab(name) {
    activeFilter = name;
    document.querySelectorAll('[data-yt-filter]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.getAttribute('data-yt-filter') === name)));
    renderAll();
  }

  function bindUi() {
    document.querySelectorAll('[data-yt-filter]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.getAttribute('data-yt-filter')));
    });
    const s = document.getElementById('vod-search');
    if (s) s.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        query = s.value.trim().toLowerCase();
        renderAll();
      }, 250);
    });
    document.querySelectorAll('[data-rail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.zv-railwrap');
        const rail = wrap ? wrap.querySelector('.zv-rail') : document.getElementById('vod-rail');
        if (!rail) return;
        const w = rail.clientWidth * 0.8;
        rail.scrollBy({ left: btn.getAttribute('data-rail') === 'next' ? w : -w, behavior: 'smooth' });
      });
    });
    // Klick auf Card/Chip -> Modal (Mittelklick/strg+Klick bleibt YouTube-Tab)
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest ? ev.target.closest('[data-video]') : null;
      if (!a || ev.metaKey || ev.ctrlKey || ev.button === 1) return;
      const id = a.getAttribute('data-video');
      if (id && window.ZV_MODAL) {
        ev.preventDefault();
        window.ZV_MODAL.open(id);
      }
    });
    document.addEventListener('zv:store', renderContinue);
  }

  window.ZV_FEED = {
    getLatestVod() {
      const v = firstVod();
      if (v || loaded) return Promise.resolve(v);
      return new Promise((resolve) => {
        const to = setTimeout(() => resolve(firstVod()), 15000);
        document.addEventListener('zv:yt-ready', function h() {
          clearTimeout(to);
          document.removeEventListener('zv:yt-ready', h);
          resolve(firstVod());
        });
      });
    },
    getCurrent() { return firstVod(); },
    getById(id) { return PLUS.find((v) => v.id === id) || null; },
    onReady(cb) {
      if (loaded) { try { cb({ plus: PLUS }); } catch (e) {} return; }
      document.addEventListener('zv:yt-ready', function h(e) {
        document.removeEventListener('zv:yt-ready', h);
        try { cb(e.detail); } catch (err) {}
      });
    },
    getAll: () => PLUS
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindUi();
    load();
    // Failsafe: Skeleton nie länger als 2,5 s
    setTimeout(() => { if (!loaded) { renderAll(); } }, 2500);
  });
})();
