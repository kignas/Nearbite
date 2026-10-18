/* Floating "Menu" button: one tap opens a floating card of categories (with item counts) right above the button,
   and jumps to the one you pick. The button turns into "Close" while the card is open.
   Additive and self-contained: injects its own CSS, reads the categories from the rendered menu
   (.menu-cat-group), and reuses the page's own scrollToCategory() / toggleCategory().
   No network calls, no libraries, no blur, no timers - it only does work on scroll (one rAF-throttled check). */
(function () {
  'use strict';
  if (window.__ewMenuJump) return;
  window.__ewMenuJump = true;

  var SHOW_AFTER = 320;            /* px scrolled before the button appears */
  var BTN_H = 44, GAP = 12;
  var btn = null, sheet = null, backdrop = null, listEl = null;
  var isOpen = false, ticking = false, lastMeasure = 0;

  var CSS = '' +
    '.ew-mj-btn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:1000;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:104px;height:44px;padding:0 16px 0 14px;border:0;border-radius:14px;background:#1b1b1f;color:#fff;font:700 14px/1 Manrope,system-ui,-apple-system,sans-serif;letter-spacing:.2px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28);opacity:0;transform:translateY(10px) scale(.94);pointer-events:none;transition:opacity .2s ease,transform .22s cubic-bezier(.2,.8,.2,1),bottom .2s ease;-webkit-tap-highlight-color:transparent}' +
    '.ew-mj-btn.show{opacity:1;transform:none;pointer-events:auto}' +
    '.ew-mj-btn.open{z-index:100045}' +
    '.ew-mj-btn:active{transform:scale(.96)}' +
    '.ew-mj-btn svg{width:18px;height:18px;flex:none}' +
    'body.ewcs-custom-open .ew-mj-btn,body.menu-search-open .ew-mj-btn{opacity:0;pointer-events:none}' +
    '.ew-mj-backdrop{position:fixed;inset:0;z-index:100040;background:rgba(20,12,15,.56);opacity:0;pointer-events:none;touch-action:none;transition:opacity .2s}' +
    '.ew-mj-backdrop.show{opacity:1;pointer-events:auto}' +
    '.ew-mj-sheet{position:fixed;right:16px;bottom:90px;z-index:100041;box-sizing:border-box;width:min(80vw,380px);max-height:70dvh;display:flex;flex-direction:column;background:#fff;border-radius:22px;box-shadow:0 18px 48px rgba(20,8,14,.3);transform-origin:100% 100%;transform:translateY(8px) scale(.92);opacity:0;visibility:hidden;transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .18s ease,visibility 0s linear .22s}' +
    '.ew-mj-sheet.show{transform:none;opacity:1;visibility:visible;transition-delay:0s}' +
    '.ew-mj-list{list-style:none;margin:0;padding:12px 10px;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-radius:22px}' +
    '.ew-mj-list::-webkit-scrollbar{display:none}' +
    '.ew-mj-list.fade{-webkit-mask-image:linear-gradient(#000 calc(100% - 44px),transparent);mask-image:linear-gradient(#000 calc(100% - 44px),transparent)}' +
    '.ew-mj-item{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:13px 14px;border:0;border-radius:14px;background:transparent;text-align:left;font:500 16px/1.3 Manrope,system-ui,-apple-system,sans-serif;color:#1c1c1c;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.ew-mj-item:active{background:#F7F2F3}' +
    '.ew-mj-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ew-mj-count{flex:none;font-size:15px;font-weight:600;color:#5f5a5d}' +
    '.ew-mj-item.active{color:var(--hd-primary,#C13A50);font-weight:700}' +
    '.ew-mj-item.active .ew-mj-count{color:var(--hd-primary,#C13A50)}' +
    '@media (prefers-reduced-motion:reduce){.ew-mj-btn,.ew-mj-backdrop,.ew-mj-sheet{transition:none}}';

  var ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10"/><path d="M17 21V3c-2.5 1.5-4 4.5-4 8h4"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function build() {
    if (btn) return;
    var st = document.createElement('style'); st.id = 'ew-mj-style'; st.textContent = CSS; document.head.appendChild(st);

    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ew-mj-btn'; btn.id = 'ew-mj-btn';
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Browse menu categories');
    btn.innerHTML = ICON_MENU + '<span>Menu</span>';
    btn.addEventListener('click', function () { if (isOpen) close(); else open(); });

    backdrop = document.createElement('div'); backdrop.className = 'ew-mj-backdrop'; backdrop.id = 'ew-mj-backdrop';
    backdrop.addEventListener('click', close);

    sheet = document.createElement('div'); sheet.className = 'ew-mj-sheet'; sheet.id = 'ew-mj-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Menu categories');
    sheet.innerHTML = '<ul class="ew-mj-list" id="ew-mj-list"></ul>';
    listEl = sheet.querySelector('.ew-mj-list');
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ew-mj-item');
      if (b) jump(b.getAttribute('data-target'));
    });
    listEl.addEventListener('scroll', fade, { passive: true });
    document.addEventListener('keydown', function (e) { if (isOpen && e.key === 'Escape') close(); });

    document.body.appendChild(backdrop); document.body.appendChild(sheet); document.body.appendChild(btn);
  }

  /* ---- categories, read fresh from the rendered menu ---- */
  function groups() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#menu-container .menu-cat-group'), function (g) {
      if (!g.id || !g.getClientRects().length) return;                       /* hidden by a filter / search */
      var t = g.querySelector('.menu-cat-title'); if (!t) return;
      var name = '';
      Array.prototype.forEach.call(t.childNodes, function (n) { if (n.nodeType === 3) name += n.nodeValue; });
      name = name.trim(); if (!name) return;
      var n = g.querySelectorAll('.menu-item:not(.hidden-by-filter)').length;
      if (!n) { var c = g.querySelector('.menu-cat-count'); n = c ? parseInt(c.textContent.replace(/\D/g, ''), 10) || 0 : 0; }
      out.push({ id: g.id, name: name, count: n, el: g });
    });
    return out;
  }
  function currentId(list) {
    var line = 140, cur = list.length ? list[0].id : '';
    list.forEach(function (g) { var r = g.el.getBoundingClientRect(); if (r.top <= line) cur = g.id; });
    return cur;
  }
  function render() {
    var list = groups(), cur = currentId(list);
    listEl.innerHTML = list.map(function (g) {
      return '<li><button type="button" class="ew-mj-item' + (g.id === cur ? ' active' : '') + '" data-target="' + esc(g.id) + '"><span class="ew-mj-name">' + esc(g.name) + '</span><span class="ew-mj-count">' + g.count + '</span></button></li>';
    }).join('');
    return list.length;
  }
  function fade() { if (listEl) listEl.classList.toggle('fade', listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 4); }

  function setBtn(openState) {
    btn.classList.toggle('open', openState);
    btn.setAttribute('aria-expanded', openState ? 'true' : 'false');
    btn.innerHTML = (openState ? ICON_X : ICON_MENU) + '<span>' + (openState ? 'Close' : 'Menu') + '</span>';
  }

  function open() {
    if (isOpen) return;
    if (!render()) return;
    lift();
    /* card sits right above the button, and never taller than the room above it */
    var top = btn.getBoundingClientRect().top;
    var bottom = Math.max(16, Math.round(window.innerHeight - top + GAP));
    sheet.style.bottom = bottom + 'px';
    sheet.style.maxHeight = Math.max(160, Math.round(top - GAP - 96)) + 'px';
    isOpen = true; setBtn(true);
    backdrop.classList.add('show'); sheet.classList.add('show');
    var act = listEl.querySelector('.active');
    listEl.scrollTop = act ? Math.max(0, act.offsetTop - 60) : 0;
    fade();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; setBtn(false);
    backdrop.classList.remove('show'); sheet.classList.remove('show');
    lastMeasure = 0; schedule();
  }

  function jump(id) {
    var el = document.getElementById(id);
    close();
    if (!el) return;
    setTimeout(function () {
      /* open the category if it was collapsed, then use the page's own scroller */
      var head = el.querySelector('.menu-cat-header');
      if (head && head.classList.contains('collapsed') && typeof window.toggleCategory === 'function') window.toggleCategory(head);
      if (typeof window.scrollToCategory === 'function') window.scrollToCategory(id);
      else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 116, behavior: reduced() ? 'auto' : 'smooth' });
    }, 80);
  }

  /* ---- keep the button above the floating cart bar / delivery hint ---- */
  function lift() {
    var min = window.innerHeight;
    ['white-cart-root', 'order-hint'].forEach(function (id) {
      var root = document.getElementById(id); if (!root) return;
      var nodes = [root].concat(Array.prototype.slice.call(root.children));
      nodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.height > 24 && r.width > 150 && r.bottom >= window.innerHeight - 10 && r.top > window.innerHeight * 0.4 && r.top < min) min = r.top;
      });
    });
    var gap = min < window.innerHeight ? (window.innerHeight - min + 12) : 16;
    btn.style.bottom = 'calc(' + Math.max(16, Math.round(gap)) + 'px + env(safe-area-inset-bottom,0px))';
  }

  function update() {
    ticking = false;
    if (!btn) return;
    var pane = document.getElementById('menu-pane');
    var menuVisible = !pane || !pane.hidden;
    var shouldShow = isOpen || (menuVisible && window.scrollY > SHOW_AFTER && document.querySelectorAll('#menu-container .menu-cat-group').length > 1);
    btn.classList.toggle('show', shouldShow);
    if (shouldShow && !isOpen) {
      var now = Date.now();
      if (now - lastMeasure > 250) { lastMeasure = now; lift(); }
    }
  }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  function init() {
    build();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', function () { lastMeasure = 0; if (isOpen) close(); schedule(); });
    /* the cart bar appears/disappears without any scroll */
    ['white-cart-root', 'order-hint'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && window.MutationObserver) new MutationObserver(function () { lastMeasure = 0; schedule(); }).observe(el, { childList: true, attributes: true, subtree: true });
    });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  /* the cart root can be created after load */
  window.addEventListener('load', function () { lastMeasure = 0; schedule(); });
})();
