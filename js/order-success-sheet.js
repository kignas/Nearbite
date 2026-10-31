/* ================================================================
   EATSWADA — ORDER SUCCESS SHEET  (window.EWOrderSuccess)
   ----------------------------------------------------------------
   Presentation only. Call show() AFTER the backend has confirmed the
   order/payment; this module never decides success itself.

     EWOrderSuccess.show({
       title, message,            // strings
       rows: [{label, value, tone}],   // tone: 'good' for the green figure
       buttonText,                // default "Track my order"
       autoMs,                    // auto-continue delay, default 7000; 0 = never
       onContinue                 // called once: button, close, Escape or timer
     });

   Requires: css/order-success-sheet.css. All text is set with textContent.
   ================================================================ */
(function () {
  'use strict';
  if (window.EWOrderSuccess) return;
  var active = false;

  /* [angle°, distance px, kind, colour, size px, delay s, spin°] around the badge.
     The badge ring is 54px in radius, so every piece sits 14-22px outside it:
     a tight, even sprinkle close to the badge rather than a wide scatter. */
  var PIECES = [
    [-98,  68, 'dot',  '#A855F7', 6,  .50, 0],
    [-48,  74, 'curl', '#F97316', 16, .56, 25],
    [-6,   72, 'dot',  '#38BDF8', 7,  .52, 0],
    [18,   76, 'tri',  '#B6E02B', 11, .60, 40],
    [56,   70, 'moon', '#2563EB', 11, .58, -20],
    [112,  68, 'dot',  '#22C55E', 6,  .54, 0],
    [158,  74, 'wave', '#2F7CE0', 16, .60, 10],
    [-170, 70, 'dot',  '#FBBF24', 8,  .48, 0],
    [-128, 70, 'bar',  '#EF4444', 10, .64, 55],
    [134,  72, 'curl', '#EF4444', 13, .66, 70]
  ];
  var SHAPES = {
    curl: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 12c-1-7 9-8 9-2s-8 3-5-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    wave: '<svg viewBox="0 0 20 12" fill="none"><path d="M1 7c2-6 4 5 6 0s4 5 6 0 4 5 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    tri:  '<svg viewBox="0 0 14 14"><path d="M1 12 13 7 3 1z" fill="currentColor"/></svg>',
    moon: '<svg viewBox="0 0 14 14" fill="none"><path d="M1.5 5a6 6 0 0 0 11 0" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    bar:  '<svg viewBox="0 0 12 12"><rect x="1" y="4.5" width="10" height="3" rx="1.5" fill="currentColor"/></svg>'
  };
  var NS_CHECK = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path class="ew-os__check" d="M8 16.8 13.8 22.5 24.5 10.5" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var NS_X = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function confetti() {
    var wrap = el('div', 'ew-os__mark');
    wrap.setAttribute('aria-hidden', 'true');
    ['ew-os__ripple', 'ew-os__ring ew-os__ring--3', 'ew-os__ring ew-os__ring--2'].forEach(function (c) { wrap.appendChild(el('span', c)); });
    var core = el('span', 'ew-os__core'); core.innerHTML = NS_CHECK; wrap.appendChild(core);
    PIECES.forEach(function (p, i) {
      var a = p[0] * Math.PI / 180;
      var c = el('span', 'ew-os__c' + (p[2] === 'dot' ? ' ew-os__c--dot' : ''));
      c.style.setProperty('--x', Math.round(Math.cos(a) * p[1]) + 'px');
      c.style.setProperty('--y', Math.round(Math.sin(a) * p[1] * .9) + 'px');
      c.style.setProperty('--sz', p[4] + 'px');
      c.style.setProperty('--d', p[5] + 's');
      c.style.setProperty('--r', p[6] + 'deg');
      c.style.setProperty('--c', p[3]);
      c.style.setProperty('--t', (3 + (i % 4) * .45).toFixed(2) + 's');
      c.style.setProperty('--dy', (i % 2 ? -5 : 4) + 'px');
      c.style.setProperty('--dr', (i % 2 ? 14 : -12) + 'deg');
      var inner = el('span', 'ew-os__ci');
      if (SHAPES[p[2]]) inner.innerHTML = SHAPES[p[2]];
      c.appendChild(inner);
      wrap.appendChild(c);
    });
    return wrap;
  }

  function show(opts) {
    if (active) return false;
    opts = opts || {};
    active = true;
    var prevFocus = document.activeElement;
    var autoMs = opts.autoMs == null ? 7000 : opts.autoMs;

    var root = el('div', 'ew-os');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ew-os-title');
    var scrim = el('div', 'ew-os__scrim');
    var sheet = el('div', 'ew-os__sheet'); sheet.tabIndex = -1;
    sheet.appendChild(el('span', 'ew-os__grab'));

    var close = el('button', 'ew-os__close'); close.type = 'button';
    close.setAttribute('aria-label', 'Close'); close.innerHTML = NS_X;

    var hero = el('div', 'ew-os__hero'); hero.appendChild(confetti());
    var title = el('h2', 'ew-os__title', opts.title || 'Order placed!'); title.id = 'ew-os-title';
    var msg = el('p', 'ew-os__msg', opts.message || '');
    sheet.appendChild(close); sheet.appendChild(hero); sheet.appendChild(title);
    if (opts.message) sheet.appendChild(msg);

    var now = new Date();
    var timeTxt = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    var dateTxt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    var meta = [{ label: 'Status', value: 'Confirmed', tone: 'status' }];
    if (opts.orderNumber) meta.push({ label: 'Order number', value: opts.orderNumber });
    meta.push({ label: 'Time', value: timeTxt }, { label: 'Date', value: dateTxt });
    var amounts = (opts.rows || []).filter(function (r) { return r && r.value; });

    function group(list, totalLast) {
      var g = el('div', 'ew-os__group');
      list.forEach(function (r, i) {
        var isTotal = totalLast && i === list.length - 1;
        var row = el('div', 'ew-os__row' + (isTotal ? ' ew-os__row--total' : ''));
        row.appendChild(el('span', 'ew-os__label', r.label));
        var cls = 'ew-os__value' + (r.tone === 'good' ? ' ew-os__value--good' : '') + (r.tone === 'status' ? ' ew-os__value--status' : '');
        row.appendChild(el('span', cls, r.value));
        g.appendChild(row);
      });
      return g;
    }
    var box = el('div', 'ew-os__rows');
    box.appendChild(el('h3', 'ew-os__head', 'Order details'));
    box.appendChild(group(meta, false));
    if (amounts.length) { box.appendChild(el('div', 'ew-os__dash')); box.appendChild(group(amounts, true)); }
    sheet.appendChild(box);

    var actions = el('div', 'ew-os__actions');
    var btn = el('button', 'ew-os__btn', opts.buttonText || 'Track my order'); btn.type = 'button';
    actions.appendChild(btn);
    if (autoMs > 0) {
      var bar = el('div', 'ew-os__bar'); bar.setAttribute('aria-hidden', 'true');
      bar.appendChild(el('span', 'ew-os__fill'));
      root.style.setProperty('--os-auto', (autoMs / 1000) + 's');
      actions.appendChild(bar);
    }
    sheet.appendChild(actions);
    root.appendChild(scrim); root.appendChild(sheet);

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(root);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-open'); sheet.focus({ preventScroll: true }); }); });
    try { if (navigator.vibrate) navigator.vibrate([18, 40, 22]); } catch (_) {}

    var finished = false, timer = null;
    function finish() {
      if (finished) return; finished = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      root.classList.add('is-leaving');
      setTimeout(function () {
        document.body.style.overflow = prevOverflow;
        if (root.parentNode) root.parentNode.removeChild(root);
        active = false;
        try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (_) {}
        if (typeof opts.onContinue === 'function') opts.onContinue();
      }, 260);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        (document.activeElement === btn ? close : btn).focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    btn.addEventListener('click', finish);
    close.addEventListener('click', finish);
    scrim.addEventListener('click', finish);
    if (autoMs > 0) timer = setTimeout(finish, autoMs + 1000);
    return true;
  }

  window.EWOrderSuccess = { show: show };
})();
