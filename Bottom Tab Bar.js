/* ============================================================
   NEARBITE — PREMIUM 3-WAY BOTTOM TAB BAR
   Food • 99 Store • Orders
   Universal component for every Nearbite page.

   Includes:
   • Zomato-style pill navigation
   • Active-tab animation
   • Page switch transition
   • Auto hide on downward scroll
   • Auto reveal on upward scroll
   • Android safe-area support
   • Removes legacy Delivery / Dining bars
   ============================================================ */
(function () {
  'use strict';

  if (window.__nearbiteBottomTabBar) return;
  window.__nearbiteBottomTabBar = true;

  const CSS = `
    :root {
      --nb-tab-accent: #E23744;
      --nb-tab-accent-soft: #FFF1F3;
      --nb-tab-ink: #20242B;
      --nb-tab-muted: #8A9099;
      --nb-tab-border: rgba(225,228,233,.96);
      --nb-tab-shadow:
        0 18px 42px rgba(22,25,31,.14),
        0 4px 12px rgba(22,25,31,.07);
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      padding-bottom: calc(104px + env(safe-area-inset-bottom)) !important;
      overflow-x: hidden;
    }

    /* ---------------- Page transition ---------------- */
    body.nb-page-enter {
      animation: nbPageEnter .34s cubic-bezier(.22,1,.36,1) both;
    }

    body.nb-page-exit {
      animation: nbPageExit .20s ease both;
      pointer-events: none;
    }

    @keyframes nbPageEnter {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes nbPageExit {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: .25; transform: translateY(-7px); }
    }

    /* ---------------- Bottom bar ---------------- */
    #nearbite-bottom-tabbar {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: calc(10px + env(safe-area-inset-bottom));
      height: 72px;
      z-index: 99999;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: stretch;
      padding: 4px;
      background: rgba(255,255,255,.97);
      border: 1px solid var(--nb-tab-border);
      border-radius: 38px;
      box-shadow: var(--nb-tab-shadow);
      backdrop-filter: blur(22px) saturate(1.35);
      -webkit-backdrop-filter: blur(22px) saturate(1.35);
      isolation: isolate;
      transform: translateY(0);
      opacity: 1;
      transition:
        transform .34s cubic-bezier(.22,1,.36,1),
        opacity .22s ease,
        box-shadow .25s ease;
      will-change: transform;
    }

    #nearbite-bottom-tabbar::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.98);
    }

    /* Zomato-style: disappear while scrolling down, return while scrolling up */
    #nearbite-bottom-tabbar.nb-hidden {
      transform: translate3d(0, calc(100% + 22px), 0);
      opacity: 0;
      pointer-events: none;
    }

    #nearbite-bottom-tabbar.nb-transitioning {
      box-shadow:
        0 22px 48px rgba(22,25,31,.18),
        0 5px 14px rgba(22,25,31,.08);
    }

    .nb-tab {
      position: relative;
      min-width: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 4px;
      border: 0;
      border-radius: 32px;
      background: transparent;
      color: var(--nb-tab-muted);
      text-decoration: none;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 650;
      letter-spacing: -.1px;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition:
        background .26s cubic-bezier(.22,1,.36,1),
        color .20s ease,
        transform .18s ease;
    }

    .nb-tab i {
      font-size: 18px;
      line-height: 1;
      transition: transform .30s cubic-bezier(.175,.885,.32,1.275),
                  filter .20s ease;
    }

    .nb-tab span {
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .nb-tab.is-active {
      background: var(--nb-tab-accent-soft);
      color: var(--nb-tab-accent);
      font-weight: 800;
    }

    .nb-tab.is-active i {
      transform: translateY(-1px) scale(1.06);
    }

    .nb-tab.is-active::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 4px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      transform: translateX(-50%) scale(0);
      animation: nbDotIn .28s .04s cubic-bezier(.175,.885,.32,1.275) forwards;
    }

    @keyframes nbDotIn {
      to { transform: translateX(-50%) scale(1); }
    }

    .nb-tab.nb-tap {
      animation: nbTabTap .34s cubic-bezier(.175,.885,.32,1.275);
    }

    @keyframes nbTabTap {
      0%   { transform: scale(1); }
      40%  { transform: scale(.92); }
      100% { transform: scale(1); }
    }

    .nb-tab:active {
      transform: scale(.965);
    }

    .nb-tab:focus-visible {
      outline: 2px solid rgba(226,55,68,.35);
      outline-offset: -2px;
    }

    @media (min-width: 700px) {
      #nearbite-bottom-tabbar {
        max-width: 620px;
        left: 50%;
        right: auto;
        width: calc(100% - 28px);
        transform: translateX(-50%);
      }
      #nearbite-bottom-tabbar.nb-hidden {
        transform: translate3d(-50%, calc(100% + 22px), 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      body.nb-page-enter,
      body.nb-page-exit,
      .nb-tab,
      .nb-tab i,
      #nearbite-bottom-tabbar {
        animation: none !important;
        transition: none !important;
      }
    }
  `;

  function currentPage() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function getActiveTab() {
    const page = currentPage();
    if (page === 'under99.html') return 'store';
    if (page === 'orders.html' || page === 'track-order.html') return 'orders';
    return 'food';
  }

  function removeLegacyBars() {
    document.querySelectorAll('.bottom-nav').forEach(function (el) { el.remove(); });
    document.querySelectorAll(
      '[data-nearbite-mode-switcher], .mode-switcher, .mode-switch, .delivery-dining-switcher'
    ).forEach(function (el) { el.remove(); });
  }

  function createBar() {
    if (document.getElementById('nearbite-bottom-tabbar')) return document.getElementById('nearbite-bottom-tabbar');

    if (!document.getElementById('nearbite-bottom-tabbar-style')) {
      const style = document.createElement('style');
      style.id = 'nearbite-bottom-tabbar-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const active = getActiveTab();
    const bar = document.createElement('nav');
    bar.id = 'nearbite-bottom-tabbar';
    bar.setAttribute('aria-label', 'Main navigation');

    const tabs = [
      { id: 'food',   label: 'Food',    href: 'index.html',   icon: 'fa-bowl-food' },
      { id: 'store',  label: '99 Store',href: 'under99.html', icon: 'fa-tag' },
      { id: 'orders', label: 'Orders',  href: 'orders.html',  icon: 'fa-receipt' }
    ];

    tabs.forEach(function (tab) {
      const a = document.createElement('a');
      a.className = 'nb-tab' + (active === tab.id ? ' is-active' : '');
      a.href = tab.href;
      a.dataset.tab = tab.id;
      a.setAttribute('aria-current', active === tab.id ? 'page' : 'false');

      const icon = document.createElement('i');
      icon.className = 'fa-solid ' + tab.icon;
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = tab.label;

      a.appendChild(icon);
      a.appendChild(label);
      bar.appendChild(a);
    });

    document.body.appendChild(bar);
    return bar;
  }

  function setupScrollBehavior(bar) {
    let lastY = Math.max(0, window.scrollY || window.pageYOffset || 0);
    let ticking = false;
    let hidden = false;
    const TOP_REVEAL = 80;
    const HIDE_AFTER = 140;
    const DELTA = 8;

    function setHidden(value) {
      if (hidden === value) return;
      hidden = value;
      bar.classList.toggle('nb-hidden', hidden);
    }

    function update() {
      ticking = false;
      const y = Math.max(0, window.scrollY || window.pageYOffset || 0);
      const delta = y - lastY;

      if (y <= TOP_REVEAL) {
        setHidden(false);
      } else if (Math.abs(delta) >= DELTA) {
        if (delta > 0 && y > HIDE_AFTER) setHidden(true);  // swipe down page
        if (delta < 0) setHidden(false);                   // swipe up page
      }

      lastY = y;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (window.scrollY < TOP_REVEAL) setHidden(false);
    }, { passive: true });
  }

  function setupPageTransitions(bar) {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    document.body.classList.add('nb-page-enter');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.remove('nb-page-enter');
      });
    });

    document.addEventListener('click', function (event) {
      const link = event.target.closest('a[href]');
      if (!link) return;
      if (event.defaultPrevented) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      if (link.href.startsWith('mailto:') || link.href.startsWith('tel:') || link.href.startsWith('javascript:')) return;
      if (link.origin !== location.origin) return;
      if (link.pathname === location.pathname && link.hash) return;
      if (link.dataset.noPageTransition === 'true') return;

      const url = new URL(link.href, location.href);
      if (!/\.html?$/i.test(url.pathname)) return;
      if (url.href === location.href) return;

      event.preventDefault();
      bar.classList.remove('nb-hidden');
      bar.classList.add('nb-transitioning');
      link.classList.remove('nb-tap');
      void link.offsetWidth;
      link.classList.add('nb-tap');
      document.body.classList.remove('nb-page-enter');
      document.body.classList.add('nb-page-exit');

      window.setTimeout(function () {
        location.href = url.href;
      }, 185);
    }, true);
  }

  function init() {
    // Remove any old Home-page / legacy bars BEFORE adding the universal bar.
    removeLegacyBars();

    const bar = createBar();
    setupScrollBehavior(bar);
    setupPageTransitions(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
