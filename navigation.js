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

  /* ── Shared request timeout ────────────────────────────────────
     Several pages use direct fetch() calls instead of api.js. A cold or
     unavailable backend must not leave Profile, Orders, Tracking, or Menu
     pages on an infinite loading skeleton. Preserve caller abort signals
     while adding a bounded timeout to requests made by page scripts. */
  if (!window.__nearbiteFetchTimeout) {
    const nativeFetch = window.fetch.bind(window);
    const DEFAULT_TIMEOUT_MS = 15000;

    window.fetch = function (input, init) {
      const options = init ? { ...init } : {};
      const callerSignal = options.signal || (input && input.signal);
      const controller = new AbortController();
      let timedOut = false;
      let timer = null;
      let removeCallerAbort = null;

      if (callerSignal) {
        if (callerSignal.aborted) controller.abort(callerSignal.reason);
        else {
          removeCallerAbort = function () {
            controller.abort(callerSignal.reason);
          };
          callerSignal.addEventListener('abort', removeCallerAbort, { once: true });
        }
      }

      const timeout = Number(options.timeout || DEFAULT_TIMEOUT_MS);
      delete options.timeout;
      options.signal = controller.signal;

      timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS);

      return nativeFetch(input, options).catch(function (error) {
        if (timedOut) {
          const timeoutError = new Error('The server took too long to respond.');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        throw error;
      }).finally(function () {
        clearTimeout(timer);
        if (callerSignal && removeCallerAbort) {
          callerSignal.removeEventListener('abort', removeCallerAbort);
        }
      });
    };

    window.__nearbiteFetchTimeout = true;
  }

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
