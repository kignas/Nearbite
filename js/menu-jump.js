/* Floating "Menu" button: one tap opens a list of categories (with item counts) and jumps to the one you pick.
   Additive and self-contained: injects its own CSS, reads the categories from the rendered menu
   (.menu-cat-group), and reuses the page's own scrollToCategory() / toggleCategory().
   No network calls, no libraries, no timers - it only does work on scroll (one rAF-throttled check). */
(function () {
  'use strict';
  if (window.__ewMenuJump) return;
  window.__ewMenuJump = true;

  var SHOW_AFTER = 320;            /* px scrolled before the button appears */
  var btn = null, sheet = null, backdrop = null, listEl = null, closeBtn = null;
  var isOpen = false, ticking = false, lastMeasure = 0, lastFocus = null;

  var CSS = '' +
    '.ew-mj-btn{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:1000;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px 0 14px;border:0;border-radius:14px;background:#1b1b1f;color:#fff;font:700 14px/1 Manrope,system-ui,-apple-system,sans-serif;letter-spacing:.2px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.28);opacity:0;transform:translateY(10px) scale(.94);pointer-events:none;transition:opacity .2s ease,transform .22s cubic-bezier(.2,.8,.2,1),bottom .2s ease;-webkit-tap-highlight-color:transparent}' +
    '.ew-mj-btn.show{opacity:1;transform:none;pointer-events:auto}' +
    '.ew-mj-btn:active{transform:scale(.96)}' +
    '.ew-mj-btn svg{width:18px;height:18px;flex:none}' +
    'body.ewcs-custom-open .ew-mj-btn,body.menu-search-open .ew-mj-btn{opacity:0;pointer-events:none}' +
    '.ew-mj-backdrop{position:fixed;inset:0;z-index:100040;background:rgba(24,12,16,.5);opacity:0;pointer-events:none;transition:opacity .2s}' +
    '.ew-mj-backdrop.show{opacity:1;pointer-events:auto}' +
    '.ew-mj-sheet{position:fixed;left:50%;bottom:0;z-index:100041;width:100%;max-width:520px;max-height:72dvh;display:flex;flex-direction:column;background:#fff;border-radius:26px 26px 0 0;box-shadow:0 -16px 48px rgba(40,12,22,.22);transform:translate(-50%,100%);transition:transform .3s cubic-bezier(.2,.8,.2,1);visibility:hidden}' +
    '.ew-mj-sheet.show{transform:translate(-50%,0);visibility:visible}' +
    '.ew-mj-handle{width:40px;height:4px;border-radius:99px;background:#E4D9DC;margin:10px auto 2px;flex:none}' +
    '.ew-mj-head{display:flex;align-items:center;justify-content:space-between;padding:8px 18px 12px;border-bottom:1px solid #EFE7E9;flex:none}' +
    '.ew-mj-title{margin:0;font-size:19px;font-weight:800;color:#101828;letter-spacing:-.02em}' +
    '.ew-mj-close{width:32px;height:32px;border:0;border-radius:50%;background:#F6EFF1;color:#6B5A60;font-size:15px;cursor:pointer}' +
    '.ew-mj-list{list-style:none;margin:0;padding:6px 8px calc(14px + env(safe-area-inset-bottom,0px));overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.ew-mj-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 12px;border:0;border-radius:12px;background:transparent;text-align:left;font:600 15px/1.3 Manrope,system-ui,-apple-system,sans-serif;color:#101828;cursor:pointer}' +
    '.ew-mj-item:active{background:#FAF6F7}' +
    '.ew-mj-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ew-mj-count{flex:none;font-size:13px;font-weight:700;color:#697077}' +
    '.ew-mj-item.active{background:#FFF0F3;color:var(--hd-primary,#C13A50);font-weight:800}' +
    '.ew-mj-item.active .ew-mj-count{color:var(--hd-primary,#C13A50)}' +
    '@media (prefers-reduced-motion:reduce){.ew-mj-btn,.ew-mj-backdrop,.ew-mj-sheet{transition:none}}';

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10"/><path d="M17 21V3c-2.5 1.5-4 4.5-4 8h4"/></svg>';

  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function build() {
    if (btn) return;
    var st = document.createElement('style'); st.id = 'ew-mj-style'; st.textContent = CSS; document.head.appendChild(st);

    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ew-mj-btn'; btn.id = 'ew-mj-btn';
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-label', 'Browse menu categories');
    btn.innerHTML = ICON + '<span>Menu</span>';
    btn.addEventListener('click', open);

    backdrop = document.createElement('div'); backdrop.className = 'ew-mj-backdrop'; backdrop.id = 'ew-mj-backdrop';
    backdrop.addEventListener('click', close);

    sheet = document.createElement('div'); sheet.className = 'ew-mj-sheet'; sheet.id = 'ew-mj-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Menu categories');
    sheet.innerHTML = '<div class="ew-mj-handle"></div><div class="ew-mj-head"><h3 class="ew-mj-title">Menu</h3><button type="button" class="ew-mj-close" aria-label="Close">\u2715</button></div><ul class="ew-mj-list" id="ew-mj-list"></ul>';
    closeBtn = sheet.querySelector('.ew-mj-close'); listEl = sheet.querySelector('.ew-mj-list');
    closeBtn.addEventListener('click', close);
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ew-mj-item');
      if (b) jump(b.getAttribute('data-target'));
    });
    document.addEventListener('keydown', function (e) { if (isOpen && e.key === 'Escape') close(); });

    document.body.appendChild(btn); document.body.appendChild(backdrop); document.body.appendChild(sheet);
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

  function open() {
    if (isOpen) return;
    if (!render()) return;
    isOpen = true; lastFocus = document.activeElement;
    backdrop.classList.add('show'); sheet.classList.add('show');
    var act = listEl.querySelector('.active');
    if (act) listEl.scrollTop = Math.max(0, act.offsetTop - 80);
    setTimeout(function () { try { closeBtn.focus({ preventScroll: true }); } catch (e) {} }, 120);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    backdrop.classList.remove('show'); sheet.classList.remove('show');
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
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
    var shouldShow = menuVisible && window.scrollY > SHOW_AFTER && document.querySelectorAll('#menu-container .menu-cat-group').length > 1;
    btn.classList.toggle('show', shouldShow);
    if (shouldShow) {
      var now = Date.now();
      if (now - lastMeasure > 250) { lastMeasure = now; lift(); }
    }
  }
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  function init() {
    build();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', function () { lastMeasure = 0; schedule(); });
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
