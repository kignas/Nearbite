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
    'complete-profile.html': 'login.html',
    'address-new.html': 'index.html'
  };

  window.nearbiteSafeBack = function () {
    const page = currentPage();

    // Address has a real contextual parent when opened from Cart.
    if (page === 'address.html' && isCartReturn()) {
      location.replace('cart.html');
      return;
    }

    const fallback = PARENT[page] || 'index.html';

    // Always use a deterministic in-app destination.
    // This avoids history.back() jumping into another site, an old
    // duplicate page, or a stale authentication/onboarding screen.
    location.replace(fallback);
  };

  // Alias for existing inline handlers.
  window.goBack = window.nearbiteSafeBack;

  // Restaurant currently has an exit animation before history.back().
  // Keep that visual behavior, but make the final destination deterministic.
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
})();


/* ── Fast navigation layer ─────────────────────────────────────
   Warm likely same-origin pages while the user is reading the current page.
   This makes the next full-page navigation much less likely to start cold. */
(function(){
  if (window.__esFastNavigation) return;
  window.__esFastNavigation = true;

  function prefetch(url){
    try{
      const u = new URL(url, location.href);
      if(u.origin !== location.origin || !/\.html$/i.test(u.pathname)) return;
      if(u.pathname === location.pathname) return;
      if(document.querySelector('link[rel="prefetch"][href="'+u.href+'"]')) return;
      const l=document.createElement('link');
      l.rel='prefetch'; l.href=u.href; l.as='document';
      document.head.appendChild(l);
    }catch(e){}
  }

  // Only warm high-value navigation targets; don't flood mobile connections.
  const preferred=['index.html','profile.html','orders.html','cart.html','address.html','search.html'];
  preferred.forEach(function(page){ if(page !== currentPage()) setTimeout(function(){prefetch(page)}, 900); });

  document.addEventListener('pointerdown',function(e){
    const a=e.target.closest && e.target.closest('a[href]');
    if(a) prefetch(a.href);
  },{passive:true});
})();

if ('serviceWorker' in navigator) window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});
