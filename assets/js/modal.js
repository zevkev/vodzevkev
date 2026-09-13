/* ============================================================
   Modul: assets/js/modal.js — Video-Detail-Modal (Prime-Stil),
   Watchlist-Drawer (Shop-Muster) + Header-Zähler
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  let currentId = null;
  let lastFocus = null;

  function video(id) {
    return (window.ZV_FEED && window.ZV_FEED.getById(id)) || null;
  }

  function fmtMeta(v) {
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

  function syncWatchButtons() {
    const on = currentId && window.ZV_STORE && window.ZV_STORE.isWatched(currentId);
    [['modal-watch'], ['billboard-watch']].forEach(([id]) => {
      const b = $(id);
      if (b) b.textContent = on ? '✓ Auf der Watchlist' : '+ Watchlist';
    });
  }

  function open(id) {
    const v = video(id);
    if (!v) return;
    currentId = id;
    if (window.ZV_STORE) window.ZV_STORE.recentPush(id);
    const m = $('zv-modal');
    if (!m) return;
    lastFocus = document.activeElement;
    showFacade(v);
    $('modal-title').textContent = v.title;
    $('modal-meta').textContent = fmtMeta(v);
    const yt = $('modal-yt');
    if (yt) yt.href = v.link;
    syncWatchButtons();
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    const x = m.querySelector('.zv-modal__x');
    if (x) x.focus();
  }

  function playerBox() {
    const m = $('zv-modal');
    if (!m) return null;
    return m.querySelector('.zv-modal__player') || null;
  }

  function showFacade(v) {
    const box = playerBox();
    if (!box) return;
    const note = $('modal-note');
    if (note) note.hidden = true;
    const thumb = v.thumb || v.thumbFallback || '';
    const fb = v.thumbFallback || '';
    box.innerHTML = '<button type="button" class="zv-modal__facade" data-facade aria-label="Video abspielen">'
      + (thumb ? '<img loading="eager" fetchpriority="high" src="' + thumb + '" data-fb="' + fb + '"'
        + ' onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=\'\';}"'
        + ' alt="' + escapeHtml(v.title) + '">' : '')
      + '<span class="zv-modal__play" aria-hidden="true">▶</span>'
      + '</button>';
    const btn = box.querySelector('[data-facade]');
    if (btn) btn.addEventListener('click', () => mountIframe(v), { once: true });
  }

  function mountIframe(v) {
    const box = playerBox();
    if (!box) return;
    // youtube.com + origin statt nocookie: vermeidet Fehler 153 bei
    // geblockten Drittanbieter Cookies. Start erst nach Klick (Geste).
    let origin = '';
    try {
      if (location.protocol.indexOf('http') === 0) origin = '&origin=' + encodeURIComponent(location.origin);
    } catch (e) {}
    box.innerHTML = '<iframe id="modal-frame" title="' + escapeHtml(v.title) + '"'
      + ' src="https://www.youtube.com/embed/' + v.id + '?rel=0&autoplay=1' + origin + '"'
      + ' allowfullscreen allow="accelerometer; autoplay; encrypted-media; picture-in-picture"></iframe>';
    const note = $('modal-note');
    if (note) note.hidden = false;
  }

  function ensureModalFullscreen() {
    const m = $('zv-modal');
    if (!m) return;
    const row = m.querySelector('.zv-modal__body .zv-row');
    if (!row || row.querySelector('#modal-fullscreen')) return;
    const b = document.createElement('button');
    b.className = 'zv-btn zv-btn-ghost zv-btn-sm';
    b.id = 'modal-fullscreen';
    b.type = 'button';
    b.textContent = 'Vollbild';
    b.addEventListener('click', () => {
      const card = m.querySelector('.zv-modal__card');
      if (!card) return;
      try {
        if (card.requestFullscreen) card.requestFullscreen();
        else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen();
        else if (window.ZV_STORE) window.ZV_STORE.toast('Vollbild wird hier nicht unterstützt.');
      } catch (e) {
        if (window.ZV_STORE) window.ZV_STORE.toast('Vollbild wird hier nicht unterstützt.');
      }
    });
    row.appendChild(b);
  }

  function close() {
    const m = $('zv-modal');
    if (!m || m.hidden) return;
    m.hidden = true;
    const f = $('modal-frame');
    if (f) {
      try { f.src = ''; } catch (e) {}
      if (f.remove) f.remove();
    }
    currentId = null;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function renderDrawer() {
    const list = $('drawer-list');
    const count = $('drawer-count');
    if (!list) return;
    const ids = window.ZV_STORE ? window.ZV_STORE.getWatchlist() : [];
    if (count) count.textContent = ids.length ? ids.length + (ids.length === 1 ? ' Video' : ' Videos') : '';
    if (!ids.length) {
      list.innerHTML = '<p class="zv-empty">Noch nichts gemerkt. Tippe bei einem Video auf „+ Watchlist“.</p>';
      return;
    }
    list.innerHTML = ids.map((id) => {
      const v = video(id);
      if (!v) return '';
      return '<div class="zv-drawer__item">'
        + '<a href="' + v.link + '" data-video="' + v.id + '"><img loading="lazy" src="' + v.thumbFallback + '" alt="">'
        + '<span>' + escapeHtml(v.title) + '</span></a>'
        + '<button type="button" data-unwatch="' + v.id + '" aria-label="Entfernen">✕</button>'
        + '</div>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function b64urlEncode(str) {
    const bin = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(s) {
    let b64 = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const enc = bin.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('');
    return decodeURIComponent(enc);
  }

  function ensureDrawerSync() {
    if (document.getElementById('drawer-sync')) return;
    const clear = $('drawer-clear');
    const foot = document.querySelector('.zv-drawer__foot');
    const b = document.createElement('button');
    b.className = 'zv-filter zv-btn-sm';
    b.id = 'drawer-sync';
    b.type = 'button';
    b.style.width = '100%';
    b.textContent = 'Sync-Link kopieren';
    b.addEventListener('click', async () => {
      const ids = window.ZV_STORE ? window.ZV_STORE.getWatchlist() : [];
      const url = location.href.split('#')[0] + '#wl=' + b64urlEncode(JSON.stringify(ids));
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
        else throw new Error('no-clipboard');
        if (window.ZV_STORE) window.ZV_STORE.toast('Sync-Link kopiert!');
      } catch (e) {
        if (window.ZV_STORE) window.ZV_STORE.toast(url);
      }
    });
    if (foot && clear && clear.parentElement === foot) foot.insertBefore(b, clear);
    else if (clear && clear.parentElement) clear.parentElement.insertBefore(b, clear);
    else if (foot) foot.appendChild(b);
  }

  function importWatchlistFromHash() {
    try {
      const h = location.hash || '';
      if (h.indexOf('#wl=') !== 0) return;
      const raw = b64urlDecode(h.slice(4));
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      const incoming = arr.filter((x) => typeof x === 'string' && x);
      if (!incoming.length) return;
      const current = window.ZV_STORE ? window.ZV_STORE.getWatchlist() : [];
      const seen = new Set();
      const merged = [];
      incoming.concat(current).forEach((id) => {
        if (!seen.has(id)) { seen.add(id); merged.push(id); }
      });
      try { localStorage.setItem('zv_watchlist_v1', JSON.stringify(merged.slice(0, 60))); } catch (e) {}
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      document.dispatchEvent(new CustomEvent('zv:store'));
      renderDrawer();
      updateBadge();
      if (window.ZV_STORE) window.ZV_STORE.toast('Watchlist synchronisiert');
    } catch (e) {}
  }

  function openDrawer() {
    renderDrawer();
    const d = $('zv-drawer');
    if (!d) return;
    lastFocus = document.activeElement;
    d.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    const d = $('zv-drawer');
    if (!d || d.hidden) return;
    d.hidden = true;
    if ($('zv-modal') && !$('zv-modal').hidden) return;
    document.body.style.overflow = '';
  }

  function updateBadge() {
    const b = $('watchlist-count');
    if (!b || !window.ZV_STORE) return;
    const n = window.ZV_STORE.getWatchlist().length;
    b.textContent = n;
    b.style.display = n ? '' : 'none';
  }

  function bindHeader() {
    const btn = $('watchlist-btn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', openDrawer);
    }
    updateBadge();
  }

  function bind() {
    const m = $('zv-modal');
    if (m && !m.dataset.bound) {
      m.dataset.bound = '1';
      m.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { close(); closeDrawer(); } });
    }
    const share = $('modal-share');
    if (share && !share.dataset.bound) {
      share.dataset.bound = '1';
      share.addEventListener('click', async () => {
        const v = currentId ? video(currentId) : null;
        const url = v ? v.link : location.href;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
          else throw new Error('no-clipboard');
          if (window.ZV_STORE) window.ZV_STORE.toast('Link kopiert!');
        } catch (e) {
          if (window.ZV_STORE) window.ZV_STORE.toast(url);
        }
      });
    }
    const mw = $('modal-watch');
    if (mw && !mw.dataset.bound) {
      mw.dataset.bound = '1';
      mw.addEventListener('click', () => {
        if (!currentId || !window.ZV_STORE) return;
        const v = video(currentId);
        window.ZV_STORE.toggleWatch(currentId, v ? v.title : '');
        syncWatchButtons();
        renderDrawer();
      });
    }
    const bw = $('billboard-watch');
    if (bw && !bw.dataset.bound) {
      bw.dataset.bound = '1';
      bw.addEventListener('click', () => {
        const id = bw.getAttribute('data-video');
        if (!id || !window.ZV_STORE) return;
        const v = video(id);
        window.ZV_STORE.toggleWatch(id, v ? v.title : '');
        syncWatchButtons();
      });
    }
    const bp = $('billboard-play');
    if (bp && !bp.dataset.bound) {
      bp.dataset.bound = '1';
      bp.addEventListener('click', () => {
        const id = bp.getAttribute('data-video');
        if (id) open(id);
      });
    }
    const d = $('zv-drawer');
    if (d && !d.dataset.bound) {
      d.dataset.bound = '1';
      d.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeDrawer));
      d.addEventListener('click', (ev) => {
        const rm = ev.target.closest ? ev.target.closest('[data-unwatch]') : null;
        if (rm && window.ZV_STORE) {
          window.ZV_STORE.toggleWatch(rm.getAttribute('data-unwatch'));
          renderDrawer();
          syncWatchButtons();
          return;
        }
        const a = ev.target.closest ? ev.target.closest('[data-video]') : null;
        if (a && !ev.metaKey && !ev.ctrlKey) {
          ev.preventDefault();
          closeDrawer();
          open(a.getAttribute('data-video'));
        }
      });
      const clear = $('drawer-clear');
      if (clear) clear.addEventListener('click', () => {
        if (window.ZV_STORE) window.ZV_STORE.clearWatchlist();
        renderDrawer();
        syncWatchButtons();
      });
    }
    bindHeader();
    ensureModalFullscreen();
    ensureDrawerSync();
  }

  window.ZV_MODAL = { open, close, openDrawer, renderDrawer };

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    importWatchlistFromHash();
    document.addEventListener('zv:partials-ready', bind);
    document.addEventListener('zv:store', () => { updateBadge(); renderDrawer(); });
    document.addEventListener('zv:feed', () => { renderDrawer(); });
  });
})();
