/* ============================================================
   NEARBITE — QUICK-COMMERCE STYLE BOTTOM TAB BAR
   Home • 99 Store • Orders • Cart
   Universal component for every Nearbite page.

   Redesigned to match a flush, edge-to-edge quick-commerce tab
   bar: a white bar sitting flat on the bottom edge, the active
   tab marked with a soft grey pill behind its icon + label
   (icon in brand red, label in bold dark ink), inactive tabs in
   neutral grey with no background. Reverts to the original
   floating rounded pill on wider (desktop) screens, since a
   full-bleed bar only reads correctly at phone widths.

   Includes:
   • Grey-pill active-tab highlight (icon red, label dark + bold)
   • Instant page navigation (no fade/slide transition)
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
      --nb-tab-pill-bg: #F0F1F4;
      --nb-tab-ink: #20242B;
      --nb-tab-muted: #90959D;
      --nb-tab-border: rgba(225,228,233,.9);
      --nb-tab-shadow: 0 -6px 18px rgba(22,25,31,.05);
      --nb-tab-bar-height: 66px;
      --nb-cart-bottom: calc(var(--nb-tab-bar-height) + 12px + env(safe-area-inset-bottom, 0px));
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      padding-bottom: calc(var(--nb-tab-bar-height) + env(safe-area-inset-bottom)) !important;
      overflow-x: hidden;
    }

    /* ---------------- Bottom bar: flush, edge-to-edge on mobile ---------------- */
    #nearbite-bottom-tabbar {
      box-sizing: border-box;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      min-height: var(--nb-tab-bar-height);
      z-index: 99999;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      align-items: stretch;
      padding: 7px 4px 7px;
      padding-bottom: calc(7px + env(safe-area-inset-bottom, 0px));
      background: #FFFFFF;
      border-top: 1px solid var(--nb-tab-border);
      box-shadow: var(--nb-tab-shadow);
      transform: translateY(0);
      opacity: 1;
      transition:
        transform .32s cubic-bezier(.22,1,.36,1),
        opacity .2s ease,
        box-shadow .25s ease;
      will-change: transform;
    }

    #nearbite-bottom-tabbar.nb-hidden {
      transform: translate3d(0, 100%, 0);
      opacity: 0;
      pointer-events: none;
    }

    .nb-tab {
      position: relative;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      background: transparent;
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }

    .nb-tab-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      max-width: 100%;
      padding: 6px 12px;
      border-radius: 18px;
      background: transparent;
      transition: background .26s cubic-bezier(.22,1,.36,1), transform .18s ease;
    }

    .nb-tab i {
      font-size: 19px;
      line-height: 1;
      color: var(--nb-tab-muted);
      transition: color .2s ease, transform .3s cubic-bezier(.175,.885,.32,1.275);
    }

    .nb-tab-label {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: -.1px;
      line-height: 1.1;
      color: var(--nb-tab-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .nb-tab.is-active .nb-tab-pill {
      background: var(--nb-tab-pill-bg);
    }

    .nb-tab.is-active i {
      color: var(--nb-tab-accent);
      transform: translateY(-1px) scale(1.05);
    }

    .nb-tab.is-active .nb-tab-label {
      color: var(--nb-tab-ink);
      font-weight: 800;
    }

    .nb-tab.nb-tap .nb-tab-pill {
      animation: nbTabTap .34s cubic-bezier(.175,.885,.32,1.275);
    }

    @keyframes nbTabTap {
      0%   { transform: scale(1); }
      40%  { transform: scale(.92); }
      100% { transform: scale(1); }
    }

    .nb-tab:active .nb-tab-pill {
      transform: scale(.96);
    }

    .nb-tab:focus-visible .nb-tab-pill {
      outline: 2px solid rgba(226,55,68,.35);
      outline-offset: 1px;
    }

    /* ---------------- Wider screens: revert to the floating pill ---------------- */
    @media (min-width: 700px) {
      :root {
        --nb-tab-bar-height: 72px;
      }
      #nearbite-bottom-tabbar {
        left: 50%;
        right: auto;
        bottom: calc(14px + env(safe-area-inset-bottom));
        width: calc(100% - 28px);
        max-width: 480px;
        transform: translateX(-50%);
        border: 1px solid var(--nb-tab-border);
        border-radius: 34px;
        box-shadow:
          0 18px 42px rgba(22,25,31,.14),
          0 4px 12px rgba(22,25,31,.07);
        backdrop-filter: blur(18px) saturate(1.3);
        -webkit-backdrop-filter: blur(18px) saturate(1.3);
      }
      #nearbite-bottom-tabbar.nb-hidden {
        transform: translate3d(-50%, calc(100% + 22px), 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .nb-tab i,
      .nb-tab-pill,
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
    if (page === 'cart.html') return 'cart';
    return 'home';
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

    // Adapted from the reference's Home / Categories / Buy Again / Offers
    // to Nearbite's actual pages: Home, 99 Store, Orders and Cart.
    const tabs = [
      { id: 'home',   label: 'Home',     href: 'index.html',   icon: 'fa-house' },
      { id: 'store',  label: '99 Store', href: 'under99.html', icon: 'fa-tag' },
      { id: 'orders', label: 'Orders',   href: 'orders.html',  icon: 'fa-receipt' },
      { id: 'cart',   label: 'Cart',     href: 'cart.html',    icon: 'fa-cart-shopping' }
    ];

    tabs.forEach(function (tab) {
      const isActive = active === tab.id;

      const a = document.createElement('a');
      a.className = 'nb-tab' + (isActive ? ' is-active' : '');
      a.href = tab.href;
      a.dataset.tab = tab.id;
      a.setAttribute('aria-current', isActive ? 'page' : 'false');

      const pill = document.createElement('span');
      pill.className = 'nb-tab-pill';

      const icon = document.createElement('i');
      icon.className = 'fa-solid ' + tab.icon;
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'nb-tab-label';
      label.textContent = tab.label;

      pill.appendChild(icon);
      pill.appendChild(label);
      a.appendChild(pill);
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
      hidden = !!value;
      bar.classList.toggle('nb-hidden', hidden);
      // Keep a floating cart bar (if present elsewhere on the page) docked
      // to the top edge of this tab bar via the shared --nb-cart-bottom
      // variable, so both components stay in sync as this bar slides
      // off-screen and back. Nudge the two constants below if your cart
      // bar sits with a different gap once you see it live.
      document.documentElement.style.setProperty(
        '--nb-cart-bottom',
        hidden
          ? `calc(12px + env(safe-area-inset-bottom, 0px))`
          : `calc(var(--nb-tab-bar-height) + 12px + env(safe-area-inset-bottom, 0px))`
      );
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

    setHidden(false);

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

  function setupTapAnimation(bar) {
    // Keeps the little bounce feedback on tap. Unlike the old page-transition
    // system, this never calls preventDefault() and never delays the actual
    // navigation — the link follows through immediately, the bounce just
    // plays alongside it.
    bar.addEventListener('click', function (event) {
      const link = event.target.closest('.nb-tab');
      if (!link) return;
      link.classList.remove('nb-tap');
      void link.offsetWidth;
      link.classList.add('nb-tap');
    });
  }

  function init() {
    // Remove any old Home-page / legacy bars BEFORE adding the universal bar.
    removeLegacyBars();

    const bar = createBar();
    setupScrollBehavior(bar);
    setupTapAnimation(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
