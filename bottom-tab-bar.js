/* ============================================================
   NEARBITE — FLOATING GLASS CAPSULE NAVIGATION (LIGHT UI MATCH)
   Slimmer proportions with frosted light glass to match the app.
   ============================================================ */
(function () {
  'use strict';

  if (window.__nearbiteBottomTabBar) return;
  window.__nearbiteBottomTabBar = true;

  const CSS = `
    :root {
      --nb-tab-accent: #0f172a;                   /* Dark slate for active icon */
      --nb-tab-active-bg: #ffffff;                /* Pure white pill for active state */
      --nb-tab-muted: #94a3b8;                    /* Crisp grey for inactive icons */
      --nb-tab-bar-height: 56px;                  /* Slimmer height to match reference */
      --nb-tab-bar-bottom-offset: 16px;           /* Floats off the bottom */
      --nb-tab-radius: 999px;                     /* Perfect capsule */
      --nb-cart-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 16px + env(safe-area-inset-bottom, 0px));
    }

    html { scroll-behavior: smooth; }
    body {
      padding-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 30px + env(safe-area-inset-bottom, 0px)) !important;
      overflow-x: hidden;
    }

    /* ---------------- Frosted Light Glass Capsule ---------------- */
    #nearbite-bottom-tabbar {
      box-sizing: border-box;
      position: fixed;
      left: 50%;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + env(safe-area-inset-bottom, 0px));
      width: calc(100% - 48px); 
      max-width: 320px; /* Tighter width for the true floating capsule look */
      height: var(--nb-tab-bar-height);
      z-index: 99999;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 6px; /* Matches the inner border gap of the reference */
      
      /* Light Glass Effect matching your UI */
      background: rgba(255, 255, 255, 0.75); 
      border: 1px solid rgba(255, 255, 255, 0.9); 
      border-radius: var(--nb-tab-radius);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08); /* Soft floating shadow */
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      
      transform: translate3d(-50%, 0, 0);
      transition: transform .32s cubic-bezier(.22,1,.36,1), opacity .2s ease;
      will-change: transform;
    }

    #nearbite-bottom-tabbar.nb-hidden {
      transform: translate3d(-50%, calc(100% + 40px), 0);
      opacity: 0;
      pointer-events: none;
    }

    .nb-tab {
      position: relative;
      height: 100%;
      width: 100%;
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
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border-radius: 999px; 
      background: transparent;
      transition: background .26s cubic-bezier(.22,1,.36,1), transform .18s ease;
    }

    .nb-tab i {
      font-size: 18px; /* Smaller, delicate icons like the reference */
      color: var(--nb-tab-muted);
      transition: color .2s ease;
    }

    .nb-tab-label {
      display: none;
    }

    .nb-tab.is-active .nb-tab-pill {
      background: var(--nb-tab-active-bg);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
    }

    .nb-tab.is-active i {
      color: var(--nb-tab-accent);
    }

    .nb-tab.nb-tap .nb-tab-pill {
      animation: nbTabTap .34s cubic-bezier(.175,.885,.32,1.275);
    }

    @keyframes nbTabTap {
      0%   { transform: scale(1); }
      40%  { transform: scale(.92); }
      100% { transform: scale(1); }
    }

    .nb-tab:active .nb-tab-pill { transform: scale(.96); }

    /* Floating Help Center Button (Updated to match light glass theme) */
    #nearbite-help-center {
      position: fixed;
      right: 16px;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + var(--nb-tab-bar-height) + 16px + env(safe-area-inset-bottom, 0px));
      width: 46px; 
      height: 46px;
      z-index: 100000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      
      /* Light glass matching the bar */
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.9);
      color: #0f172a;
      
      font-weight: 600;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .2s ease, opacity .2s ease;
    }

    #nearbite-help-center.nb-help-hidden {
      transform: translateY(calc(100% + 120px));
      opacity: 0;
      pointer-events: none;
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

      pill.appendChild(icon);
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
      const help = document.getElementById('nearbite-help-center');
      if (help) help.classList.toggle('nb-help-hidden', hidden);
      
      document.documentElement.style.setProperty(
        '--nb-cart-bottom',
        hidden
          ? `calc(var(--nb-tab-bar-bottom-offset) + env(safe-area-inset-bottom, 0px))`
          : `calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 16px + env(safe-area-inset-bottom, 0px))`
      );
    }

    function update() {
      ticking = false;
      const y = Math.max(0, window.scrollY || window.pageYOffset || 0);
      const delta = y - lastY;

      if (y <= TOP_REVEAL) {
        setHidden(false);
      } else if (Math.abs(delta) >= DELTA) {
        if (delta > 0 && y > HIDE_AFTER) setHidden(true);  
        if (delta < 0) setHidden(false);                   
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
    bar.addEventListener('click', function (event) {
      const link = event.target.closest('.nb-tab');
      if (!link) return;
      link.classList.remove('nb-tap');
      void link.offsetWidth;
      link.classList.add('nb-tap');
    });
  }

  if (!document.getElementById('nearbite-help-center')) {
    const help = document.createElement('a');
    help.id = 'nearbite-help-center';
    help.href = 'support.html';
    help.setAttribute('aria-label', 'Help Center');
    help.innerHTML = '<span aria-hidden="true">?</span>';
    help.style.textDecoration = 'none';
    document.body.appendChild(help);
  }

  function init() {
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
