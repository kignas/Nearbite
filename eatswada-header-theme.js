/* ================================================================
   EATSWADA — MULTI-HEADER COLOR SYSTEM (state)
   ----------------------------------------------------------------
   Owns ONE concern: which header color theme is active.

   - Keeps the light/dark engine (eatswada-theme.js) untouched.
   - Persists the choice in localStorage under `eatswada_header_theme`.
   - Applies the attribute before first paint (see the inline snippet in
     each page <head>) so the previous theme never flashes.
   - Adding a theme = adding one entry to THEMES. No component rewrites.
   ================================================================ */
(function () {
  'use strict';

  var KEY = 'eatswada_header_theme';
  var DEFAULT = 'raspberry';

  // Order defines the picker order. Only primary colors are declared here;
  // every other token (hover/active/soft/ink/muted/accent/on-light/cta) lives
  // in eatswada-header-theme.css so future themes stay CSS-only.
  var THEMES = [
    { id: 'raspberry', label: 'Raspberry', primary: '#E9546B' }
    // { id: 'future-theme-4', label: '...', primary: '#...' }
    // { id: 'future-theme-5', label: '...', primary: '#...' }
    // { id: 'future-theme-6', label: '...', primary: '#...' }
  ];

  function isKnown(id) {
    return THEMES.some(function (t) { return t.id === id; });
  }

  function get() {
    try {
      var v = localStorage.getItem(KEY);
      return isKnown(v) ? v : DEFAULT;
    } catch (_) {
      return DEFAULT;
    }
  }

  function apply(id) {
    var value = isKnown(id) ? id : DEFAULT;
    var root = document.documentElement;
    root.dataset.ewHeader = value;
    document.dispatchEvent(new CustomEvent('eatswada:headerthemechange', { detail: { theme: value } }));
    return value;
  }

  function set(id) {
    var value = isKnown(id) ? id : DEFAULT;
    try { localStorage.setItem(KEY, value); } catch (_) {}
    apply(value);
    syncSwitches(value);
    return value;
  }

  function syncSwitches(theme) {
    document.querySelectorAll('[data-ew-header-picker]').forEach(function (el) {
      var active = el.getAttribute('data-ew-header-picker') === theme;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-pressed', String(active));
    });
  }

  function bindSwitches() {
    syncSwitches(get());
    document.querySelectorAll('[data-ew-header-picker]').forEach(function (el) {
      if (el.dataset.ewHeaderBound === '1') return;
      el.dataset.ewHeaderBound = '1';
      el.addEventListener('click', function () {
        set(el.getAttribute('data-ew-header-picker'));
      });
    });
  }

  // Apply immediately (idempotent with the pre-paint inline snippet).
  apply(get());

  window.EatswadaHeaderTheme = {
    get: get,
    set: set,
    apply: apply,
    list: function () { return THEMES.map(function (t) { return t.id; }); },
    themes: THEMES,
    default: DEFAULT,
    key: KEY,
    // Concrete color for APIs that require a hex value (e.g. Razorpay theme).
    primary: function () {
      var v = '';
      try {
        v = getComputedStyle(document.documentElement).getPropertyValue('--hd-primary').trim();
      } catch (_) {}
      return v || '#E9546B';
    }
  };

  document.addEventListener('DOMContentLoaded', bindSwitches);

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    apply(get());
    syncSwitches(get());
  });
})();
