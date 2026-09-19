/* ============================================================
   NEARBITE — FLOATING ISLAND BOTTOM NAVIGATION
   Home • 99 Store • Orders
   Universal component for every Nearbite page.

   TRUE floating glass island at every screen width — phone
   included. There is no separate "flush mobile bar" mode; the
   island geometry (side margins, bottom margin, rounded corners,
   frosted glass) is the only mode.

   This bar owns ONLY the 3-column nav. The Cart is a separate
   floating island owned by cart-bar.js, positioned above this
   bar via the shared --nb-cart-bottom custom property (defined
   below, updated live as this bar hides/reveals on scroll).
   Do not add a Cart tab back into this grid — see cart-bar.js.

   Includes:
   • Floating glass island: left/right/bottom margins, 24px
     radius, frosted backdrop blur, soft border + shadow
   • Subtle inner capsule highlight on the active tab (icon in
     brand red, label in bold dark ink) — not a full-bleed block
   • Instant page navigation (no fade/slide transition)
   • Auto hide on downward scroll, auto reveal on upward scroll
   • Android safe-area support
   • Removes legacy Delivery / Dining bars
   • Publishes --nb-cart-bottom so cart-bar.js stays docked above,
     accounting for this bar's own bottom offset from the screen
     edge (it no longer sits flush at bottom: 0)
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
      --nb-tab-border: rgba(255,255,255,.65);
      --nb-tab-shadow: 0 10px 35px rgba(20,20,30,.14), 0 2px 8px rgba(20,20,30,.06);
      --nb-tab-bar-height: 56px;
      --nb-tab-bar-bottom-offset: 12px;
      --nb-tab-side-margin: 16px;
      --nb-tab-radius: 28px;
      --nb-cart-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 10px + env(safe-area-inset-bottom, 0px));
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      padding-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 20px + env(safe-area-inset-bottom, 0px)) !important;
      overflow-x: hidden;
    }

    /* ---------------- True floating glass island — same geometry at every width ---------------- */
    #nearbite-bottom-tabbar {
      box-sizing: border-box;
      position: fixed;
      left: 50%;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + env(safe-area-inset-bottom, 0px));
      width: calc(100% - 56px);
      max-width: 390px;
      min-height: var(--nb-tab-bar-height);
      z-index: 99999;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: stretch;
      padding: 3px 5px;
      background: linear-gradient(180deg, rgba(255,255,255,.88) 0%, rgba(248,249,251,.78) 100%);
      border: 1px solid rgba(255,255,255,.88);
      border-radius: var(--nb-tab-radius);
      box-shadow: 0 10px 28px rgba(15,23,42,.12), 0 2px 8px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.95);
      backdrop-filter: blur(28px) saturate(185%);
      -webkit-backdrop-filter: blur(28px) saturate(185%);
      transform: translate3d(-50%, 0, 0);
      opacity: 1;
      isolation: isolate;
      overflow: hidden;
      transition:
        transform .32s cubic-bezier(.22,1,.36,1),
        opacity .2s ease,
        box-shadow .25s ease;
      will-change: transform;
    }

    #nearbite-bottom-tabbar::before {
      content: "";
      position: absolute;
      inset: 1px;
      border-radius: calc(var(--nb-tab-radius) - 1px);
      background: linear-gradient(180deg, rgba(255,255,255,.38), rgba(255,255,255,0));
      pointer-events: none;
      z-index: -1;
    }


    #nearbite-help-center {
      position: fixed;
      right: 14px;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + 10px + env(safe-area-inset-bottom, 0px));
      width: 48px;
      height: 48px;
      z-index: 100000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,.9);
      border-radius: 50%;
      background: rgba(255,255,255,.84);
      color: #68717d;
      box-shadow:
        0 8px 22px rgba(15,23,42,.14),
        inset 0 1px 0 rgba(255,255,255,.95);
      backdrop-filter: blur(22px) saturate(180%);
      -webkit-backdrop-filter: blur(22px) saturate(180%);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
    }

    #nearbite-help-center:hover {
      transform: translateY(-1px);
      box-shadow:
        0 10px 25px rgba(15,23,42,.17),
        inset 0 1px 0 rgba(255,255,255,.95);
    }

    #nearbite-help-center:active {
      transform: scale(.94);
    }

    #nearbite-help-center span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 23px;
      height: 23px;
      border: 2px solid currentColor;
      border-radius: 50%;
      font-size: 15px;
      line-height: 1;
    }

    #nearbite-help-center i,
    #nearbite-help-center svg {
      width: 21px;
      height: 21px;
      font-size: 21px;
      line-height: 1;
    }

    @media (max-width: 380px) {
      #nearbite-help-center {
        right: 10px;
        width: 44px;
        height: 44px;
      }
    }

    #nearbite-bottom-tabbar::after {
      content: "";
      position: absolute;
      left: 24%;
      right: 24%;
      top: 0;
      height: 1px;
      background: rgba(255,255,255,.95);
      pointer-events: none;
    }

    #nearbite-bottom-tabbar.nb-hidden {
      transform: translate3d(-50%, calc(100% + 30px), 0);
      opacity: 0;
      pointer-events: none;
    }

    .nb-tab {
      position: relative;
      min-width: 0;
      min-height: 48px;
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
      gap: 4px;
      width: min(100%, 104px);
      max-width: 104px;
      min-height: 44px;
      padding: 3px 8px;
      border-radius: 22px;
      background: transparent;
      transition: background .26s cubic-bezier(.22,1,.36,1), transform .18s ease;
    }

    .nb-tab i {
      font-size: 18px;
      line-height: 1;
      color: var(--nb-tab-muted);
      transition: color .2s ease, transform .3s cubic-bezier(.175,.885,.32,1.275);
    }

    .nb-tab-label {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10.5px;
      font-weight: 650;
      letter-spacing: -.1px;
      line-height: 1.1;
      color: var(--nb-tab-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .nb-tab.is-active .nb-tab-pill {
      background: rgba(255,255,255,.74);
      box-shadow: 0 3px 10px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.9);
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

    @media (max-width: 380px) {
      :root {
        --nb-tab-bar-height: 54px;
        --nb-tab-side-margin: 14px;
        --nb-tab-radius: 27px;
      }
      #nearbite-bottom-tabbar { padding: 3px 5px; }
      .nb-tab { min-height: 46px; }
      .nb-tab-pill { min-height: 42px; padding-inline: 7px; }
      .nb-tab i { font-size: 20px; }
      .nb-tab-label { font-size: 11.5px; }
    }

    @media (min-width: 600px) {
      #nearbite-bottom-tabbar {
        max-width: 520px;
        min-height: 58px;
      }
      .nb-tab { min-height: 48px; }
      .nb-tab-pill { min-height: 44px; max-width: 118px; }
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

    // 3 columns only — Home, 99 Store, Orders. Cart is a separate
    // floating island (cart-bar.js), not a tab in this grid.
    const tabs = [
      { id: 'home',   label: 'Home',     href: 'index.html',   icon: 'fa-house' },
      { id: 'store',  label: '99 Store', href: 'under99.html', icon: 'fa-tag' },
      { id: 'orders', label: 'Orders',   href: 'orders.html',  icon: 'fa-receipt' }
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
      // Keep the floating cart island (cart-bar.js) docked to the top
      // edge of this island via the shared --nb-cart-bottom variable,
      // so both components stay in sync as this bar slides off-screen
      // and back. Both branches route through --nb-tab-bar-bottom-offset
      // (this bar's own resting gap from the screen edge) so the two
      // stay correct if that gap is ever tuned.
      document.documentElement.style.setProperty(
        '--nb-cart-bottom',
        hidden
          ? `calc(var(--nb-tab-bar-bottom-offset) + env(safe-area-inset-bottom, 0px))`
          : `calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 10px + env(safe-area-inset-bottom, 0px))`
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


    // Separate floating Help Center button — intentionally not part of the 3-column nav.
    if (!document.getElementById('nearbite-help-center')) {
      const help = document.createElement('a');
      help.id = 'nearbite-help-center';
      help.href = 'support.html';
      help.setAttribute('aria-label', 'Help Center');
      help.title = 'Help Center';
      help.innerHTML = '<span aria-hidden="true">?</span>';
      help.style.textDecoration = 'none';
      document.body.appendChild(help);
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
