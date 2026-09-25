/* ================================================================
   NEARBITE — PRODUCTION SAFE BACK NAVIGATION
   Keeps in-app Back buttons deterministic and prevents accidental
   browser-history / external-page jumps.
   ================================================================ */
(function () {
  'use strict';

  if (window.__nearbiteSafeNavigation) return;
  window.__nearbiteSafeNavigation = true;

  function currentPage() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function isCartReturn() {
    return new URLSearchParams(location.search).get('return') === 'cart';
  }

  const PARENT = {
    'cart.html': 'index.html',
    'orders.html': 'index.html',
    'profile.html': 'index.html',
    'category.html': 'index.html',
    'search.html': 'index.html',
    'under99.html': 'index.html',
    'restaurant.html': 'index.html',
    'support.html': 'orders.html',
    'track-order.html': 'orders.html',
    'legal.html': 'profile.html',
    'location-onboarding.html': 'index.html',
    'service-unavailable.html': 'index.html',
    'complete-profile.html': 'login.html',
    'address-new.html': 'index.html'
  };

  window.nearbiteSafeBack = function () {
    const page = currentPage();

    if (page === 'address.html' && isCartReturn()) {
      location.replace('cart.html');
      return;
    }

    const fallback = PARENT[page] || 'index.html';
    location.replace(fallback);
  };

  window.goBack = window.nearbiteSafeBack;

  window.premiumBack = function () {
    const elementsToHide = document.querySelectorAll(
      '.res-card, .delivery-strip, .filter-bar, .menu-section, .cat-nav, .closed-warning-card'
    );

    elementsToHide.forEach(function (el) {
      el.classList.add('slide-out-active');
    });

    setTimeout(function () {
      window.nearbiteSafeBack();
    }, 250);
  };

  /* ── Intent-based navigation warming ──────────────────────────
     Do not prefetch several complete HTML documents after every page
     opens. Those requests compete with the page's API calls, fonts and
     images, especially on mobile connections and cold backend starts. */
  (function () {
    if (window.__esFastNavigation) return;
    window.__esFastNavigation = true;

    let lastPrefetchUrl = '';

    function prefetch(url) {
      try {
        const u = new URL(url, location.href);
        if (u.origin !== location.origin || !/\.html$/i.test(u.pathname)) return;
        if (u.pathname === location.pathname) return;
        if (u.href === lastPrefetchUrl) return;
        if (document.querySelector('link[rel="prefetch"][href="' + u.href + '"]')) return;

        lastPrefetchUrl = u.href;
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = u.href;
        link.as = 'document';
        document.head.appendChild(link);
      } catch (e) {}
    }

    /* Desktop: warm only after the pointer rests over a same-origin link.
       Mobile: pointerover is unreliable, so pointerdown warms the link the
       user is actually about to open. */
    let hoverTimer = null;
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { prefetch(link.href); }, 120);
    }, { passive: true });

    document.addEventListener('pointerout', function (e) {
      if (e.pointerType === 'touch') return;
      const link = e.target.closest && e.target.closest('a[href]');
      if (link && !link.contains(e.relatedTarget)) clearTimeout(hoverTimer);
    }, { passive: true });

    document.addEventListener('pointerdown', function (e) {
      const link = e.target.closest && e.target.closest('a[href]');
      if (link) prefetch(link.href);
    }, { passive: true });
  })();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }, { once: true });
  }
})();
