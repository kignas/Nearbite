(function () {
  'use strict';

  if (window.__nearbiteBottomTabBar) return;
  window.__nearbiteBottomTabBar = true;

  const CSS = `
    :root {
      --nb-tab-accent: #E23744;          /* Brand red for active accent */
      --nb-tab-active-bg: #FFF3F4;       /* Soft tint for active capsule */
      --nb-tab-ink: #1C1C1C;             /* Bold dark text for active tab */
      --nb-tab-muted: #696969;           /* Clean grey for inactive tabs */
      --nb-tab-bar-height: 62px;         /* Standard ergonomic mobile height */
      --nb-tab-border: rgba(0, 0, 0, 0.08);
      --nb-cart-bottom: calc(var(--nb-tab-bar-height) + 12px + env(safe-area-inset-bottom, 0px));
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      padding-bottom: calc(var(--nb-tab-bar-height) + 24px + env(safe-area-inset-bottom, 0px)) !important;
      overflow-x: hidden;
    }

    /* ---------------- Full-Width Docked Bar (Zomato-Style) ---------------- */
    #nearbite-bottom-tabbar {
      box-sizing: border-box;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: calc(var(--nb-tab-bar-height) + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      z-index: 99999;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      align-items: center;
      background: #FFFFFF;
      border-top: 1px solid var(--nb-tab-border);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
      transform: translate3d(0, 0, 0);
      transition: transform .3s cubic-bezier(.22, 1, .36, 1), opacity .2s ease;
      will-change: transform;
    }

    #nearbite-bottom-tabbar.nb-hidden {
      transform: translate3d(0, 100%, 0);
      opacity: 0;
      pointer-events: none;
    }

    .nb-tab {
      position: relative;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
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
      width: 82%;
      max-width: 90px;
      height: 46px;
      border-radius: 16px;
      background: transparent;
      transition: background .2s ease, transform .15s ease;
    }

    .nb-tab i {
      font-size: 19px;
      line-height: 1;
      color: var(--nb-tab-muted);
      transition: color .2s ease, transform .2s ease;
    }

    .nb-tab-label {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.1;
      color: var(--nb-tab-muted);
      letter-spacing: -0.2px;
      transition: color .2s ease;
    }

    /* Active State Styling */
    .nb-tab.is-active .nb-tab-pill {
      background: var(--nb-tab-active-bg);
    }

    .nb-tab.is-active i {
      color: var(--nb-tab-accent);
      transform: scale(1.05);
    }

    .nb-tab.is-active .nb-tab-label {
      color: var(--nb-tab-accent);
      font-weight: 700;
    }

    /* Tap feedback */
    .nb-tab.nb-tap .nb-tab-pill {
      animation: nbTabTap .3s cubic-bezier(.175, .885, .32, 1.275);
    }

    @keyframes nbTabTap {
      0%   { transform: scale(1); }
      40%  { transform: scale(.92); }
      100% { transform: scale(1); }
    }

    /* Floating Help Center Button docked relative to bar */
    #nearbite-help-center {
      position: fixed;
      right: 14px;
      bottom: calc(var(--nb-tab-bar-height) + 14px + env(safe-area-inset-bottom, 0px));
      width: 42px;
      height: 42px;
      z-index: 99998;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 50%;
      background: #FFFFFF;
      color: #4A4A4A;
      font-size: 15px;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .25s ease, opacity .2s ease;
      text-decoration: none;
    }

    #nearbite-help-center.nb-help-hidden {
      transform: translateY(calc(100% + 40px));
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
      { id: 'home',   label: 'Delivery', href: 'index.html',   icon: 'fa-motorcycle' },
      { id: 'store',  label: 'Under ₹99', href: 'under99.html', icon: 'fa-tags' },
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
