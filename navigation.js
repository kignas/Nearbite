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

  /* ── Fast navigation layer ─────────────────────────────────────
     Prefetch only the page the user is likely to open. The previous
     implementation referenced currentPage() from a different IIFE,
     which threw a ReferenceError and stopped this entire script. */
  (function () {
    if (window.__esFastNavigation) return;
    window.__esFastNavigation = true;

    function pageName() {
      return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    }

    function prefetch(url) {
      try {
        const u = new URL(url, location.href);
        if (u.origin !== location.origin || !/\.html$/i.test(u.pathname)) return;
        if (u.pathname === location.pathname) return;
        if (document.querySelector('link[rel="prefetch"][href="' + u.href + '"]')) return;

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = u.href;
        link.as = 'document';
        document.head.appendChild(link);
      } catch (e) {}
    }

    const preferred = [
      'index.html', 'profile.html', 'orders.html', 'cart.html',
      'address.html', 'search.html'
    ];

    preferred.forEach(function (page) {
      if (page !== pageName()) {
        setTimeout(function () { prefetch(page); }, 900);
      }
    });

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
