/* Modul: assets/js/reveal.js — Scroll-Reveal im ZevWall-Stil */
(function () {
  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.zv-reveal').forEach((el) => el.classList.add('zv-on'));
      return;
    }
    document.documentElement.classList.add('zv-js');
    document.body.classList.add('zv-js');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('zv-on'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    const observeAll = () => document.querySelectorAll('.zv-reveal:not(.zv-on)').forEach((el) => io.observe(el));
    observeAll();
    // Partials werden asynchron nachgeladen -> erneut beobachten
    new MutationObserver(observeAll).observe(document.body, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
