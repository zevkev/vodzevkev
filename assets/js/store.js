/* ============================================================
   Modul: assets/js/store.js — Watchlist + Zuletzt angesehen
   (localStorage, ohne Anmeldung) + Toast-Benachrichtigungen
   ============================================================ */
(function () {
  const WL_KEY = 'zv_watchlist_v1';
  const REC_KEY = 'zv_recent_v1';
  const REC_MAX = 12;

  function read(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function emit() {
    document.dispatchEvent(new CustomEvent('zv:store'));
  }

  function toast(msg) {
    const box = document.getElementById('zv-toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'zv-toast';
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('zv-on'));
    setTimeout(() => {
      el.classList.remove('zv-on');
      setTimeout(() => el.remove(), 400);
    }, 2600);
  }

  window.ZV_STORE = {
    getWatchlist() { return read(WL_KEY).filter((x) => typeof x === 'string'); },
    isWatched(id) { return read(WL_KEY).indexOf(id) !== -1; },
    toggleWatch(id, title) {
      const list = read(WL_KEY).filter((x) => typeof x === 'string');
      const i = list.indexOf(id);
      if (i === -1) {
        list.unshift(id);
        toast('Zur Watchlist hinzugefügt' + (title ? ': ' + title : ''));
      } else {
        list.splice(i, 1);
        toast('Von der Watchlist entfernt');
      }
      write(WL_KEY, list.slice(0, 60));
      emit();
      return i === -1;
    },
    clearWatchlist() { write(WL_KEY, []); emit(); },
    getRecent() { return read(REC_KEY).filter((x) => typeof x === 'string'); },
    recentPush(id) {
      const list = read(REC_KEY).filter((x) => typeof x === 'string' && x !== id);
      list.unshift(id);
      write(REC_KEY, list.slice(0, REC_MAX));
      emit();
    },
    toast
  };
})();
