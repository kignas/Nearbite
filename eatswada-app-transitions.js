/* Eatswada — Home ↔ Orders cross-document transitions.
   Uses Chrome's cross-document View Transitions when available; preserves normal links/URLs.
   Older browsers fall back to the previous directional page animation. */
(function () {
  'use strict';
  if (window.__eatswadaAppTransitions) return;
  window.__eatswadaAppTransitions = true;
  var KEY = 'ew_app_nav_direction';
  var DURATION = 340;
  function pageName() { return (location.pathname.split('/').pop() || 'index.html').toLowerCase(); }
  function isHomeOrdersLink(a) {
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return false;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return false;
      var dest = u.pathname.split('/').pop().toLowerCase();
      return (dest === 'index.html' || dest === 'orders.html') && dest !== pageName();
    } catch (_) { return false; }
  }
  function directionFor(dest) { return dest === 'orders.html' ? 'forward' : 'back'; }
  document.addEventListener('click', function (event) {
    var a = event.target && event.target.closest ? event.target.closest('#nearbite-bottom-tabbar a.nb-tab') : null;
    if (!isHomeOrdersLink(a) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var dest = new URL(a.href, location.href).pathname.split('/').pop().toLowerCase();
    var direction = directionFor(dest);
    try { sessionStorage.setItem(KEY, direction); } catch (_) {}
    document.documentElement.classList.remove('ew-dir-forward', 'ew-dir-back');
    document.documentElement.classList.add('ew-dir-' + direction);
    /* Modern Chrome performs a native cross-document transition and morphs the shared active pill. */
    if (typeof document.startViewTransition === 'function') return;
    /* Progressive fallback: animate the current screen, then navigate normally. */
    event.preventDefault();
    var node = document.querySelector('main.page, .orders-content');
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { location.href = a.href; return; }
    node.classList.add(direction === 'forward' ? 'ew-page-exit-forward' : 'ew-page-exit-back');
    void node.offsetWidth;
    requestAnimationFrame(function () {
      node.classList.add('ew-page-exit-active');
      window.setTimeout(function () { location.href = a.href; }, DURATION);
    });
  }, true);
})();
