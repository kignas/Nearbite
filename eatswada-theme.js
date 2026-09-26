/* ================================================================
   EATSWADA THEME — Dark Reader Dynamic integration
   - New users: one-time theme choice on Home.
   - Existing users: no popup; Profile controls the theme.
   - Preference persists in localStorage.
   - Dark mode uses Dark Reader's Dynamic Theme engine rather than a
     second hand-written dark stylesheet. This is intentionally close
     to browser forced-dark behavior while remaining web-controlled.
   ================================================================ */
(function () {
  'use strict';

  const KEY = 'eatswada_theme';
  const NEW_USER_KEY = 'eatswada_theme_intro_pending';
  const DARK = 'dark';
  const LIGHT = 'light';
  const DARK_READER_VERSION = '4.9.133';
  const DARK_READER_SRC = 'https://cdn.jsdelivr.net/npm/darkreader@' + DARK_READER_VERSION + '/darkreader.js';

  let darkReaderReady = false;
  let darkReaderLoadPromise = null;

  function getTheme() {
    try { return localStorage.getItem(KEY) === DARK ? DARK : LIGHT; }
    catch (_) { return LIGHT; }
  }

  function ensureColorSchemeMeta() {
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      const first = document.head && document.head.firstElementChild;
      if (first) document.head.insertBefore(meta, first);
      else if (document.head) document.head.appendChild(meta);
    }
    meta.content = 'light dark';
  }

  function darkReaderFixes() {
    return {
      // Keep customer food/restaurant photos natural. Dynamic mode already
      // protects normal photos; these selectors cover common Eatswada image
      // wrappers/background-image components without globally disabling image analysis.
      invert: [],
      css: `
        /* Keep Eatswada brand accent colors readable while allowing neutral UI to transform. */
        .ew-theme-intro .ew-theme-dark { background: #151820 !important; color: #f5f7fa !important; }
        .ew-theme-intro .ew-theme-light { color: #242831 !important; }
      `,
      ignoreInlineStyle: [],
      ignoreImageAnalysis: [
        'img',
        'picture img',
        'video',
        'canvas',
        '.hero img',
        '.hero-image',
        '.banner img',
        '.promo img',
        '.restaurant-image',
        '.food-image',
        '.item-image'
      ],
      disableStyleSheetsProxy: false,
      ignoreCSSUrl: []
    };
  }

  function loadDarkReader() {
    if (window.DarkReader) {
      darkReaderReady = true;
      return Promise.resolve(window.DarkReader);
    }
    if (darkReaderLoadPromise) return darkReaderLoadPromise;

    darkReaderLoadPromise = new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-ew-dark-reader]');
      if (existing) {
        existing.addEventListener('load', function () { darkReaderReady = !!window.DarkReader; resolve(window.DarkReader); });
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = DARK_READER_SRC;
      script.async = false;
      script.dataset.ewDarkReader = '1';
      script.onload = function () {
        darkReaderReady = !!window.DarkReader;
        if (darkReaderReady) resolve(window.DarkReader);
        else reject(new Error('Dark Reader API did not initialize'));
      };
      script.onerror = function () { reject(new Error('Dark Reader CDN failed to load')); };
      (document.head || document.documentElement).appendChild(script);
    });
    return darkReaderLoadPromise;
  }

  function enableDarkReader() {
    return loadDarkReader().then(function (DR) {
      if (!DR || typeof DR.enable !== 'function') throw new Error('Dark Reader API unavailable');
      DR.enable({
        mode: 1,
        brightness: 100,
        contrast: 100,
        grayscale: 0,
        sepia: 0,
        useFont: false,
        textStroke: 0,
        darkSchemeBackgroundColor: '#181A1B',
        darkSchemeTextColor: '#E8E6E3',
        lightSchemeBackgroundColor: '#DCDAD7',
        lightSchemeTextColor: '#181A1B',
        scrollbarColor: 'auto',
        selectionColor: 'auto',
        styleSystemControls: true
      }, darkReaderFixes());
      darkReaderReady = true;
    }).catch(function () {
      // If a network/CSP blocks the CDN, keep the site functional. The root
      // color-scheme still tells the browser that dark controls are supported.
      darkReaderReady = false;
    });
  }

  function disableDarkReader() {
    if (window.DarkReader && typeof window.DarkReader.disable === 'function') {
      try { window.DarkReader.disable(); } catch (_) {}
    }
    darkReaderReady = false;
  }

  function applyTheme(theme) {
    const value = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;
    root.dataset.ewTheme = value;
    root.style.colorScheme = value;
    ensureColorSchemeMeta();

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === DARK ? '#181A1B' : '#FFFFFF');

    if (value === DARK) enableDarkReader();
    else disableDarkReader();

    document.dispatchEvent(new CustomEvent('eatswada:themechange', { detail: { theme: value } }));
  }

  function setTheme(theme) {
    const value = theme === DARK ? DARK : LIGHT;
    try { localStorage.setItem(KEY, value); } catch (_) {}
    applyTheme(value);
    syncSwitches(value);
  }

  function isHomePage() {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return page === '' || page === 'index.html';
  }

  function syncSwitches(theme) {
    document.querySelectorAll('[data-ew-theme-toggle]').forEach(function (el) {
      const on = theme === DARK;
      el.setAttribute('aria-checked', String(on));
      el.classList.toggle('is-on', on);
      const visual = el.querySelector('.ew-theme-switch');
      if (visual) visual.classList.toggle('is-on', on);
      const state = el.querySelector('[data-ew-theme-state]');
      if (state) state.textContent = on ? 'On' : 'Off';
    });
  }

  function bindSwitches() {
    syncSwitches(getTheme());
    document.querySelectorAll('[data-ew-theme-toggle]').forEach(function (el) {
      if (el.dataset.ewThemeBound === '1') return;
      el.dataset.ewThemeBound = '1';
      el.addEventListener('click', function () {
        setTheme(getTheme() === DARK ? LIGHT : DARK);
      });
    });
  }

  function showNewUserThemePrompt() {
    if (!isHomePage()) return;
    let pending = false;
    try { pending = localStorage.getItem(NEW_USER_KEY) === '1'; } catch (_) {}
    if (!pending) return;
    try { localStorage.removeItem(NEW_USER_KEY); } catch (_) {}

    const backdrop = document.createElement('div');
    backdrop.className = 'ew-theme-intro';
    backdrop.innerHTML = `
      <div class="ew-theme-sheet" role="dialog" aria-modal="true" aria-labelledby="ewThemeIntroTitle">
        <div class="ew-theme-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"></path></svg>
        </div>
        <h2 id="ewThemeIntroTitle">Choose your Eatswada look</h2>
        <p>Dark mode is easier on the eyes at night. You can change this anytime from Profile.</p>
        <div class="ew-theme-actions">
          <button type="button" class="ew-theme-choice ew-theme-light" data-ew-choice="light"><span class="ew-choice-icon">☀</span><span>Keep light</span></button>
          <button type="button" class="ew-theme-choice ew-theme-dark" data-ew-choice="dark"><span class="ew-choice-icon">☾</span><span>Use dark mode</span></button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (event) {
      const choice = event.target.closest('[data-ew-choice]');
      if (!choice) return;
      setTheme(choice.getAttribute('data-ew-choice'));
      backdrop.classList.add('is-closing');
      setTimeout(function () { backdrop.remove(); }, 180);
    });
  }

  ensureColorSchemeMeta();
  // First paint: state only. Dark Reader is then enabled immediately.
  applyTheme(getTheme());

  window.EatswadaTheme = {
    get: getTheme,
    set: setTheme,
    toggle: function () { setTheme(getTheme() === DARK ? LIGHT : DARK); },
    keys: { theme: KEY, newUserPending: NEW_USER_KEY },
    darkReaderVersion: DARK_READER_VERSION
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindSwitches();
    showNewUserThemePrompt();
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    applyTheme(event.newValue === DARK ? DARK : LIGHT);
    syncSwitches(getTheme());
  });
})();
