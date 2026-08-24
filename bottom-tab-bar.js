/* ============================================================
   NEARBITE — FLOATING ISLAND BOTTOM NAVIGATION (SCALED UP)
   Home • 99 Store • Orders
   ============================================================ */
(function () {
  'use strict';

  if (window.__nearbiteBottomTabBar) return;
  window.__nearbiteBottomTabBar = true;

  const CSS = `
    :root {
      --nb-tab-accent: #000000; /* Dark icon for active state */
      --nb-tab-active-bg: #FFC107; /* Matches the yellow top banner */
      --nb-tab-muted: #8B95A5; /* Crisp grey for inactive icons */
      --nb-tab-bar-height: 66px; /* Increased from 56px for a bolder look */
      --nb-tab-bar-bottom-offset: 16px;
      --nb-tab-radius: 40px;
      --nb-cart-bottom: calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 12px + env(safe-area-inset-bottom, 0px));
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
      width: max-content; 
      min-width: 290px; /* Noticeably wider than the cart popup */
      max-width: calc(100% - 76px); /* Ensures it doesn't overlap the Help button on small screens */
      height: var(--nb-tab-bar-height);
      z-index: 99999;
      display: flex;
      justify-content: center;
      gap: 12px; /* Increased gap to spread out the tabs */
      padding: 8px 12px; /* Slightly thicker padding */
      background: rgba(255, 255, 255, 0.88); /* Light frosted glass */
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: var(--nb-tab-radius);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
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
      width: 76px; /* Wider touch targets (increased from 64px) */
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
      border-radius: 34px;
      background: transparent;
      transition: background .26s cubic-bezier(.22,1,.36,1), transform .18s ease;
    }

    .nb-tab i {
      font-size: 22px; /* Scaled up icons for better visibility */
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
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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

    /* Floating Help Center Button */
    #nearbite-help-center {
      position: fixed;
      right: 16px;
      bottom: calc(var(--nb-tab-bar-bottom-offset) + 8px + env(safe-area-inset-bottom, 0px));
      width: 48px; /* Slightly scaled up to match the beefier nav bar */
      height: 48px;
      z-index: 100000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.88);
      color: #333333;
      font-weight: 600;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
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
          : `calc(var(--nb-tab-bar-height) + var(--nb-tab-bar-bottom-offset) + 12px + env(safe-area-inset-bottom, 0px))`
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
