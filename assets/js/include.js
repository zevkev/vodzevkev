/* Modul: assets/js/include.js — lädt HTML-Partials (Header/Footer) ohne Build */
(function () {
  async function includeAll() {
    const slots = document.querySelectorAll('[data-include]');
    await Promise.all(Array.from(slots).map(async (el) => {
      const src = el.getAttribute('data-include');
      if (!src) return;
      try {
        const res = await fetch(src, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        el.innerHTML = await res.text();
      } catch (e) {
        console.warn('[include] Fallback für', src, e);
        // Vollwertiger Fallback (z. B. per file://, wo fetch blockiert ist)
        if (src.includes('header')) {
          el.innerHTML = '<div class="zv-header"><div class="zv-header__inner">'
            + '<a class="zv-logo" href="index.html"><img src="favicon.png" alt="ZevKev Logo" width="30" height="30"><span>zevkev<strong>vod</strong></span></a>'
            + '<nav class="zv-pills"><a href="index.html">Startseite</a><a href="index.html#streams">Streams</a><a href="index.html#clips">Clips</a></nav>'
            + '<button class="zv-watchbtn" id="watchlist-btn" type="button" aria-label="Watchlist öffnen">★ <span id="watchlist-count" style="display:none">0</span></button>'
            + '<a class="zv-login" href="https://www.twitch.tv/zevkev_" target="_blank" rel="noopener">Twitch</a>'
            + '</div></div>';
        }
        if (src.includes('footer')) {
          el.innerHTML = '<footer class="zv-footer"><div class="zv-footer__inner">'
            + '<nav aria-label="Footer"><a href="index.html">Startseite</a><a href="index.html#streams">Streams</a>'
            + '<a href="index.html#clips">Clips</a><a href="impressum.html" style="font-weight:700">Impressum</a></nav>'
            + '<p>© 2026 ZevKev · vod.zevkev.me · Stream & Videos.</p>'
            + '</div></footer>';
        }
      }
    }));
    markActiveNav();
    document.dispatchEvent(new CustomEvent('zv:partials-ready'));
  }
  function markActiveNav() {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const hash = (location.hash || '').toLowerCase();
    document.querySelectorAll('.zv-nav a, .zv-pills a').forEach((a) => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const file = href.split('#')[0];
      const frag = href.includes('#') ? '#' + href.split('#')[1] : '';
      let active = false;
      if (file !== page) active = false;
      else if (frag === '') active = (hash === '' || hash === '#live');
      else active = (frag === hash);
      // Startseite ohne Hash oder #live ist Standard-aktiv
      if (file === 'index.html' && page === 'index.html' && hash !== '#streams' && hash !== '#clips' && frag === '') active = true;
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  document.addEventListener('DOMContentLoaded', includeAll);
  window.addEventListener('hashchange', markActiveNav);
})();
