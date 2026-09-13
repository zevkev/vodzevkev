/* ============================================================
   Modul: assets/js/twitch-status.js
   Regel: Twitch-Player (+ Chat) NUR bei bestätigtem Live-Status.
   Sonst: neuestes Video vom VOD-Kanal (@ZevKevPlus).
   Live gilt nur bei doppelter Bestätigung (Thumbnail UND
   Twitch-Seite meldet live) — kein False-Live.
   Hinweis: per file:// wird Twitch nie eingebettet (Twitch
   lehnt dort die Verbindung ab) — Seite per http(s) öffnen.
   ============================================================ */
(function () {
  const RECHECK_MS = 120000;
  const VISIBLE_RECHECK_MS = 60000;
  let liveNow = false;
  let checking = false;
  let lastCheck = 0;
  let showingFallback = false;
  let baseTitle = '';
  try { baseTitle = document.title; } catch (e) {}

  const $ = (id) => document.getElementById(id);
  const feed = () => (window.ZV_FEED || null);

  function twitchCfg() { return window.ZV_CONFIG.twitch; }

  function parentHosts() {
    const base = (twitchCfg().parents || ['vod.zevkev.me']).slice();
    const host = location.hostname;
    if (host && base.indexOf(host) === -1) base.push(host);
    return base;
  }
  function parentsParam() {
    return parentHosts().map((p) => '&parent=' + encodeURIComponent(p)).join('');
  }

  function setBadge(mode, text) {
    const badge = $('live-badge');
    const label = $('live-text');
    if (!badge) return;
    badge.classList.remove('zv-badge--live', 'zv-badge--offline', 'zv-badge--loading');
    badge.classList.add(mode === 'live' ? 'zv-badge--live' : mode === 'offline' ? 'zv-badge--offline' : 'zv-badge--loading');
    const txt = badge.querySelector('.txt');
    if (txt) txt.textContent = mode === 'live' ? 'Live' : mode === 'offline' ? 'Offline' : 'Prüfe …';
    if (label && typeof text === 'string') label.textContent = text;
  }

  function frame() { return $('player-frame'); }

  function setCta(href, label, external) {
    const cta = $('hero-cta');
    if (!cta) return;
    if (href) cta.setAttribute('href', href);
    const t = cta.querySelector('.cta-txt');
    if (t && label) t.textContent = label;
    if (external === true) { cta.setAttribute('target', '_blank'); cta.setAttribute('rel', 'noopener'); }
    else if (external === false) { cta.removeAttribute('target'); cta.removeAttribute('rel'); }
  }

  function setHeroMeta(text) {
    const m = $('hero-meta');
    if (m && typeof text === 'string') m.textContent = text;
  }

  function paintTitle(live) {
    try {
      if (!baseTitle) return;
      document.title = live && liveNow ? '🔴 LIVE · ' + baseTitle : baseTitle;
    } catch (e) {}
  }

  function mountTwitch() {
    const f = frame();
    if (!f) return;
    const ch = twitchCfg().channel;
    f.innerHTML = '<iframe src="https://player.twitch.tv/?channel=' + encodeURIComponent(ch)
      + parentsParam() + '&autoplay=true&muted=true" '
      + 'allowfullscreen allow="autoplay; fullscreen" title="Twitch Livestream zevkev_"></iframe>';
    const meta = $('player-meta-title');
    if (meta) meta.textContent = 'zevkev_ streamt jetzt live auf Twitch.';
    setHeroMeta('zevkev_ · live auf Twitch');
    setCta(twitchCfg().channelUrl, 'Jetzt Zuschauen', true);
    const note = $('player-note');
    if (note) {
      note.innerHTML = 'Falls der Player „Verbindung abgelehnt“ zeigt: Seite über '
        + '<a href="https://vod.zevkev.me/">vod.zevkev.me</a> öffnen. Twitch erlaubt nur freigegebene Domains.';
      ensurePlayerFullscreen(note);
    }
    mountChat(true);
  }

  function ensurePlayerFullscreen(note) {
    const box = note || $('player-note');
    if (!box) return;
    if (box.querySelector('[data-player-fs]')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zv-filter zv-btn-sm';
    b.setAttribute('data-player-fs', '1');
    b.textContent = '⛶ Vollbild';
    b.addEventListener('click', () => {
      const fr = frame();
      if (!fr) return;
      try {
        if (fr.requestFullscreen) fr.requestFullscreen();
        else if (fr.webkitRequestFullscreen) fr.webkitRequestFullscreen();
      } catch (e) {}
    });
    box.appendChild(document.createTextNode(' '));
    box.appendChild(b);
  }

  function clearPlayerNote() {
    const note = $('player-note');
    if (note) note.textContent = '';
  }

  function mountChat(show) {
    const panel = $('chat-panel');
    const box = $('chat-box');
    const toggle = $('chat-toggle');
    if (!panel || !box) return;
    if (show && location.protocol !== 'file:') {
      if (!box.getAttribute('data-on')) {
        const ch = twitchCfg().channel;
        const src = 'https://www.twitch.tv/embed/' + encodeURIComponent(ch) + '/chat?'
          + parentHosts().map((p) => 'parent=' + encodeURIComponent(p)).join('&') + '&darkpopout';
        box.innerHTML = '<iframe src="' + src + '" title="Twitch Live-Chat zevkev_"></iframe>';
        box.setAttribute('data-on', '1');
      }
      panel.hidden = false;
      if (toggle) toggle.hidden = false;
    } else {
      panel.hidden = true;
      if (toggle) toggle.hidden = true;
    }
  }

  function showHero(mode) {
    const bb = $('billboard');
    const lg = $('livegrid');
    if (bb) bb.hidden = mode !== 'billboard';
    if (lg) lg.hidden = mode !== 'live';
  }

  function fmtMetaLine(v) {
    const parts = [];
    if (v.views > 0) {
      try { parts.push(v.views.toLocaleString('de-DE') + ' Aufrufe'); }
      catch (e) { parts.push(v.views + ' Aufrufe'); }
    }
    if (v.ts) {
      try { parts.push(new Date(v.ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })); }
      catch (e) {}
    }
    parts.push('VOD-Kanal · @ZevKevPlus');
    return parts.join(' · ');
  }

  // Offline-Hero: Billboard mit neuestem VOD-Kanal-Video (kein Iframe nötig)
  function renderBillboard(video) {
    const bg = $('billboard-bg');
    const title = $('billboard-title');
    const meta = $('billboard-meta');
    const play = $('billboard-play');
    const watch = $('billboard-watch');
    const yt = $('billboard-yt');
    const badge = $('billboard-badge');
    if (video) {
      showingFallback = false;
      if (bg) {
        bg.onerror = function () {
          if (bg.getAttribute('src') !== video.thumbFallback) bg.src = video.thumbFallback;
          else bg.onerror = null;
        };
        bg.src = video.thumb;
        bg.alt = video.title;
      }
      if (title) title.textContent = video.title;
      if (meta) meta.textContent = fmtMetaLine(video);
      if (play) play.setAttribute('data-video', video.id);
      if (watch) {
        watch.setAttribute('data-video', video.id);
        const on = window.ZV_STORE && window.ZV_STORE.isWatched(video.id);
        watch.textContent = on ? '✓ Auf der Watchlist' : '+ Watchlist';
      }
      if (yt) yt.href = video.link;
      setHeroMeta('VOD-Kanal · @ZevKevPlus · neuestes Video');
      setCta(video.link, 'Jetzt Ansehen', true);
    } else {
      showingFallback = true;
      if (title) title.textContent = 'ZEVKEV VOD';
      if (meta) meta.textContent = 'Stream & Videos · vod.zevkev.me';
      if (play) play.removeAttribute('data-video');
      if (watch) watch.removeAttribute('data-video');
      if (yt) yt.href = window.ZV_CONFIG.youtube.channelUrl;
      setHeroMeta('VOD-Kanal · @ZevKevPlus');
      setCta(window.ZV_CONFIG.youtube.channelUrl, 'Jetzt Ansehen', true);
    }
    if (badge) {
      const t = badge.querySelector('.txt');
      if (t) t.textContent = video ? 'Neueste vom VOD-Kanal' : 'VOD-Kanal';
    }
    showHero('billboard');
    // Alten Twitch-Hinweis zurücksetzen (z. B. nach Live → Offline)
    clearPlayerNote();
  }

  function showOffline(video) {
    liveNow = false;
    setBadge('offline', 'Aktuell offline. Oben läuft das neueste Video vom VOD-Kanal.');
    renderBillboard(video);
    mountChat(false);
    paintTitle(false);
    syncSeo(false, video);
  }

  function showLive() {
    liveNow = true;
    setBadge('live', 'zevkev_ ist jetzt live auf Twitch. Direkt hier schauen.');
    showHero('live');
    mountTwitch();
    paintTitle(true);
    syncSeo(true, null);
  }

  function syncSeo(isLive, video) {
    try {
      const el = $('jsonld-broadcast');
      if (!el) return;
      const data = JSON.parse(el.textContent);
      data.isLiveBroadcast = isLive;
      if (data.publication) data.publication.isLiveBroadcast = isLive;
      if (video && video.title) data.name = video.title;
      el.textContent = JSON.stringify(data);
    } catch (e) {}
  }

  async function fetchText(url, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 10000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } finally { clearTimeout(t); }
  }

  // Signal 1: Preview-Thumbnail — Hinweis, kein Beweis
  function probeThumbnail(channel, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const img = new Image();
      img.onload = () => finish(img.naturalWidth >= 320 && img.naturalHeight >= 180);
      img.onerror = () => finish(false);
      img.src = 'https://static-cdn.jtvnw.net/previews-ttv/live_user_' + channel.toLowerCase()
        + '-640x360.jpg?t=' + Date.now();
      setTimeout(() => finish(false), timeoutMs || 6000);
    });
  }

  // Signal 2: Twitch-Kanal-Seite (über Proxy) meldet live
  async function probePage(channel, timeoutMs) {
    try {
      const raw = await fetchText(
        'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.twitch.tv/' + channel)
        + '&t=' + Date.now(), timeoutMs || 9000);
      const html = (JSON.parse(raw).contents || '');
      if (/"isLiveBroadcast"\s*:\s*true/i.test(html)) return true;
      if (/"isLiveBroadcast"\s*:\s*false/i.test(html)) return false;
      if (/live_user_[a-z0-9_]+-640x360/i.test(html) && /"broadcastType"\s*:\s*"live"/i.test(html)) return true;
      return null;
    } catch (e) { return null; }
  }

  async function isReallyLive() {
    const ch = twitchCfg().channel;
    // file:// → Twitch verweigert grundsätzlich die Verbindung
    if (location.protocol === 'file:') return false;
    const t = twitchCfg();
    const [thumb, page] = await Promise.all([
      probeThumbnail(ch, t.thumbTimeoutMs),
      probePage(ch, t.pageTimeoutMs)
    ]);
    // Nur doppelte Bestätigung zählt — Thumbnail allein reicht nie
    if (page === true && thumb) return true;
    if (page === true && !thumb) {
      // Seite sagt live, Thumbnail hängt: einmalig nachprüfen
      return probeThumbnail(ch, t.thumbTimeoutMs);
    }
    return false;
  }

  function setBusy(busy) {
    const btn = $('recheck-live');
    if (!btn) return;
    if (busy) { btn.setAttribute('disabled', ''); btn.setAttribute('aria-busy', 'true'); }
    else { btn.removeAttribute('disabled'); btn.removeAttribute('aria-busy'); }
  }

  async function check(reason) {
    if (checking) return;
    const f = feed();
    if (!f) {
      // Feed-Modul fehlt (Adblock/Reihenfolge): ehrlicher Fallback, kein Absturz
      if (reason === 'init' || reason === 'manual') showOffline(null);
      return;
    }
    checking = true;
    setBusy(true);
    try {
      if (reason === 'manual') setBadge('loading', 'Status wird neu geprüft …');
      const live = await Promise.race([
        isReallyLive(),
        new Promise((r) => setTimeout(() => r(false), twitchCfg().liveCheckBudgetMs || 16000))
      ]);
      lastCheck = Date.now();
      if (live && !liveNow) {
        showLive();
      } else if (live && liveNow && reason === 'manual') {
        setBadge('live', 'zevkev_ ist jetzt live auf Twitch. Direkt hier schauen.');
      } else if (!live && liveNow) {
        // Live → Offline: zurück zum neuesten VOD-Kanal-Video
        showOffline(await f.getLatestVod().catch(() => f.getCurrent()));
      } else if (!live && reason === 'manual') {
        // Manueller Refresh: neuestes Video neu laden
        showOffline(await f.getLatestVod().catch(() => f.getCurrent()));
      }
      // 'init'/'auto' ohne Statuswechsel: Player unangetastet (kein Reload-Flackern)
    } finally { checking = false; setBusy(false); }
  }

  async function init() {
    if (!frame()) return;
    setBadge('loading', 'Status wird geprüft …');
    const f = feed();
    if (f) {
      // Erster Paint + Nachfüllen, sobald der Feed da ist
      f.onReady(() => {
        if (liveNow) return;
        const v = f.getCurrent();
        if (v) showOffline(v);
        else if (!showingFallback) showOffline(null);
      });
    } else {
      showOffline(null);
    }
    check('init');
    setInterval(() => check('auto'), RECHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastCheck > VISIBLE_RECHECK_MS) check('auto');
    });
    const btn = $('recheck-live');
    if (btn) btn.addEventListener('click', () => check('manual'));
    const toggle = $('chat-toggle');
    if (toggle) toggle.addEventListener('click', () => {
      const panel = $('chat-panel');
      if (!panel) return;
      const collapsed = panel.classList.toggle('is-collapsed');
      toggle.textContent = collapsed ? 'Chat einblenden' : 'Chat ausblenden';
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
