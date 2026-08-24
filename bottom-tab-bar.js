/* ============================================================
   NEARBITE — FLOATING ISLAND BOTTOM NAVIGATION (UPDATED)
   Home • 99 Store • Orders
   ============================================================ */
(function () {
  'use strict';

  if (window.__nearbiteBottomTabBar) return;
  window.__nearbiteBottomTabBar = true;

  const CSS = `
    :root {
      --nb-tab-accent: #FFFFFF;
      --nb-tab-ink: #FFFFFF;
      --nb-tab-muted: rgba(255, 255, 255, 0.55);
      --nb-tab-active-bg: rgba(255, 255, 255, 0.15);
      --nb-tab-bar-height: 72px;
      --nb-tab-bar-bottom-offset: 24px;
      --nb-tab-side-margin: 16px;
      --nb-tab-radius: 50px;
      --nb-cart-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 10px + env(safe-area-inset-bottom, 0px));
    }

    html { scroll-behavior: smooth; }
    body {
      padding-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 20px + env(safe-area-inset-bottom, 0px)) !important;
      overflow-x: hidden;
    }

    /* ---------------- True floating glass island ---------------- */
    #nearbite-bottom-tabbar {
      box-sizing: border-box;
      position: fixed;
      left: 50%;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + env(safe-area-inset-bottom, 0px));
      width: calc(100% - 40px);
      max-width: 420px;
      height: var(--nb-tab-bar-height);
      z-index: 99999;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: center;
      padding: 8px;
      background: rgba(25, 30, 40, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: var(--nb-tab-radius);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(24px) saturate(150%);
      -webkit-backdrop-filter: blur(24px) saturate(150%);
      transform: translate3d(-50%, 0, 0);
      transition: transform .32s cubic-bezier(.22,1,.36,1), opacity .2s ease;
      will-change: transform;
    }

    #nearbite-bottom-tabbar.nb-hidden {
      transform: translate3d(-50%, calc(100% + 30px), 0);
      opacity: 0;
      pointer-events: none;
    }

    .nb-tab {
      position: relative;
      height: 100%;
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
      border-radius: 40px;
      background: transparent;
      transition: background .26s cubic-bezier(.22,1,.36,1), transform .18s ease;
    }

    .nb-tab i {
      font-size: 22px;
      color: var(--nb-tab-muted);
      transition: color .2s ease, transform .3s cubic-bezier(.175,.885,.32,1.275);
    }

    /* Visually hide labels for the icon-only minimalist look */
    .nb-tab-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .nb-tab.is-active .nb-tab-pill {
      background: var(--nb-tab-active-bg);
    }

    .nb-tab.is-active i {
      color: var(--nb-tab-accent);
      transform: translateY(0) scale(1.1);
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

    /* Floating Help Center Button (Updated for Dark Theme) */
    #nearbite-help-center {
      position: fixed;
      right: 20px;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + 10px + env(safe-area-inset-bottom, 0px));
      width: 50px;
      height: 50px;
      z-index: 100000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 50%;
      background: rgba(25, 30, 40, 0.4);
      color: rgba(255,255,255,.8);
      box-shadow: 0 8px 22px rgba(0,0,0,.2);
      backdrop-filter: blur(24px) saturate(150%);
      -webkit-backdrop-filter: blur(24px) saturate(150%);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .2s ease;
    }

    #nearbite-help-center.nb-help-hidden {
      transform: translateY(calc(100% + 28px));
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
      const help = document.getElementById('nearbite-help-center');
      if (help) help.classList.toggle('nb-help-hidden', hidden);
      
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
