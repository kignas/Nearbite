/* ============================================================
   NEARBITE — PREMIUM 3-WAY BOTTOM TAB BAR
   Food • 99 Store • Orders
   Universal component for every Nearbite page.
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
      --nb-tab-border: #E9EBEF;
      --nb-tab-shadow:
        0 16px 38px rgba(22, 25, 31, .12),
        0 3px 10px rgba(22, 25, 31, .06);
    }

    body {
      padding-bottom: calc(102px + env(safe-area-inset-bottom)) !important;
    }

    #nearbite-bottom-tabbar {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: calc(10px + env(safe-area-inset-bottom));
      height: 72px;
      z-index: 9999;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: stretch;
      padding: 4px;
      background: rgba(255,255,255,.96);
      border: 1px solid rgba(225,228,233,.95);
      border-radius: 38px;
      box-shadow: var(--nb-tab-shadow);
      backdrop-filter: blur(22px) saturate(1.35);
      -webkit-backdrop-filter: blur(22px) saturate(1.35);
      isolation: isolate;
    }

    #nearbite-bottom-tabbar::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
    }

    .nb-tab {
      position: relative;
      min-width: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 6px 4px;
      border: 0;
      border-radius: 32px;
      background: transparent;
      color: var(--nb-tab-muted);
      text-decoration: none;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: -.1px;
      -webkit-tap-highlight-color: transparent;
      transition:
        background .22s cubic-bezier(.16,1,.3,1),
        color .18s ease,
        transform .15s ease;
    }

    .nb-tab i {
      font-size: 17px;
      line-height: 1;
      transition: transform .22s cubic-bezier(.16,1,.3,1);
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
      font-weight: 700;
    }

    .nb-tab.is-active i {
      transform: translateY(-.5px);
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
    }

    @media (prefers-reduced-motion: reduce) {
      .nb-tab, .nb-tab i { transition: none; }
    }
  `;

  function currentPage() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function getActiveTab() {
    const page = currentPage();

    if (page === 'under99.html') return 'store';
    if (page === 'orders.html' || page === 'track-order.html') return 'orders';

    // Restaurant, category, search, cart, profile and all other
    // customer pages belong to the Food section.
    return 'food';
  }

  function removeLegacyBars() {
    document.querySelectorAll('.bottom-nav').forEach(function (el) {
      el.remove();
    });

    // Remove the old Delivery / Dining mode switcher if a page has one.
    document.querySelectorAll('[data-nearbite-mode-switcher], .mode-switcher, .mode-switch').forEach(function (el) {
      el.remove();
    });
  }

  function createBar() {
    if (document.getElementById('nearbite-bottom-tabbar')) return;

    const style = document.createElement('style');
    style.id = 'nearbite-bottom-tabbar-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    const active = getActiveTab();

    const bar = document.createElement('nav');
    bar.id = 'nearbite-bottom-tabbar';
    bar.setAttribute('aria-label', 'Main navigation');

    const tabs = [
      {
        id: 'food',
        label: 'Food',
        href: 'index.html',
        icon: 'fa-bowl-food'
      },
      {
        id: 'store',
        label: '99 Store',
        href: 'under99.html',
        icon: 'fa-tag'
      },
      {
        id: 'orders',
        label: 'Orders',
        href: 'orders.html',
        icon: 'fa-receipt'
      }
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
  }

  function init() {
    removeLegacyBars();
    createBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
