/* ============================================================
   EATSWADA — APP-LIKE HOME ↔ ORDERS TRANSITIONS
   Animates only page content. The fixed bottom island stays put.
   Works with ordinary multi-page HTML navigation; no SPA rewrite.
   ============================================================ */
(function () {
  'use strict';
  if (window.__eatswadaAppTransitions) return;
  window.__eatswadaAppTransitions = true;

  var KEY = 'ew_app_nav_direction';
  var LOCK = false;
  var DURATION = 340;

  function pageName() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }
  function isHomeOrdersLink(a) {
    if (!a) return false;
    if (!a.target || a.target === '_self' || a.target === '') {
      try {
        var u = new URL(a.href, location.href);
        if (u.origin !== location.origin) return false;
        var dest = u.pathname.split('/').pop().toLowerCase();
        return (dest === 'index.html' || dest === 'orders.html') &&
          dest !== pageName();
      } catch (_) {}
    }
    return false;
  }
  function contentNode() {
    return document.querySelector('main.page') ||
      document.querySelector('.orders-content') ||
      document.querySelector('main') ||
      document.body;
  }
  function directionFor(dest) {
    return dest === 'orders.html' ? 'forward' : 'back';
  }
  function playArrival() {
    var direction = null;
    try {
      direction = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch (_) {}
    if (direction !== 'forward' && direction !== 'back') return;
    var node = contentNode();
    if (!node) return;
    node.classList.add(direction === 'forward' ? 'ew-page-enter-forward' : 'ew-page-enter-back');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        node.classList.add('ew-page-enter-active');
        window.setTimeout(function () {
          node.classList.remove('ew-page-enter-forward','ew-page-enter-back','ew-page-enter-active');
        }, DURATION + 80);
      });
    });
    var bar = document.getElementById('nearbite-bottom-tabbar');
    if (bar) {
      var active = bar.querySelector('.nb-tab.is-active .nb-tab-pill');
      if (active) {
        active.classList.remove('ew-tab-arrive');
        void active.offsetWidth;
        active.classList.add('ew-tab-arrive');
        window.setTimeout(function(){ active.classList.remove('ew-tab-arrive'); }, 520);
      }
    }
  }

  document.addEventListener('click', function (event) {
    var a = event.target && event.target.closest ? event.target.closest('#nearbite-bottom-tabbar a.nb-tab') : null;
    if (!isHomeOrdersLink(a) || LOCK) return;
    // Respect modified clicks, browser open-in-new-tab gestures and downloads.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || a.hasAttribute('download')) return;

    event.preventDefault();
    LOCK = true;
    var dest = new URL(a.href, location.href).pathname.split('/').pop().toLowerCase();
    var direction = directionFor(dest);
    try { sessionStorage.setItem(KEY, direction); } catch (_) {}

    var node = contentNode();
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      location.href = a.href;
      return;
    }
    node.classList.remove('ew-page-exit-forward','ew-page-exit-back','ew-page-exit-active');
    node.classList.add(direction === 'forward' ? 'ew-page-exit-forward' : 'ew-page-exit-back');
    // Force style calculation so the outgoing animation reliably starts.
    void node.offsetWidth;
    requestAnimationFrame(function () {
      node.classList.add('ew-page-exit-active');
      window.setTimeout(function () { location.href = a.href; }, DURATION);
    });
  }, true);

  // Restore normal navigation if the page is restored from the back-forward cache.
  window.addEventListener('pageshow', function () { LOCK = false; });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', playArrival, { once: true });
  } else {
    playArrival();
  }
})();