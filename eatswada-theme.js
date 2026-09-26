/* ================================================================
   EATSWADA THEME
   - Existing users: no theme popup.
   - New accounts: one-time theme choice popup on Home.
   - Preference persists in localStorage and is applied before paint.
   ================================================================ */
(function () {
  'use strict';

  const KEY = 'eatswada_theme';
  const NEW_USER_KEY = 'eatswada_theme_intro_pending';
  const DARK = 'dark';
  const LIGHT = 'light';

  function getTheme() {
    try {
      return localStorage.getItem(KEY) === DARK ? DARK : LIGHT;
    } catch (_) {
      return LIGHT;
    }
  }

  function applyTheme(theme) {
    const value = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;
    root.dataset.ewTheme = value;
    root.style.colorScheme = value;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === DARK ? '#0B0D12' : '#FFFFFF');

    document.dispatchEvent(new CustomEvent('eatswada:themechange', {
      detail: { theme: value }
    }));
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

    // Mark it as seen immediately: the prompt is intentionally one-time.
    try { localStorage.removeItem(NEW_USER_KEY); } catch (_) {}

    const backdrop = document.createElement('div');
    backdrop.className = 'ew-theme-intro';
    backdrop.innerHTML = `
      <div class="ew-theme-sheet" role="dialog" aria-modal="true"
           aria-labelledby="ewThemeIntroTitle">
        <div class="ew-theme-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"></path></svg>
        </div>
        <h2 id="ewThemeIntroTitle">Choose your Eatswada look</h2>
        <p>Dark mode is easier on the eyes at night. You can change this anytime from Profile.</p>
        <div class="ew-theme-actions">
          <button type="button" class="ew-theme-choice ew-theme-light" data-ew-choice="light">
            <span class="ew-choice-icon">☀</span>
            <span>Keep light</span>
          </button>
          <button type="button" class="ew-theme-choice ew-theme-dark" data-ew-choice="dark">
            <span class="ew-choice-icon">☾</span>
            <span>Use dark mode</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (event) {
      const choice = event.target.closest('[data-ew-choice]');
      if (!choice) return;
      setTheme(choice.getAttribute('data-ew-choice'));
      backdrop.classList.add('is-closing');
      setTimeout(function () { backdrop.remove(); }, 180);
    });
  }

  // Synchronous first-paint application.
  applyTheme(getTheme());

  window.EatswadaTheme = {
    get: getTheme,
    set: setTheme,
    toggle: function () { setTheme(getTheme() === DARK ? LIGHT : DARK); },
    keys: { theme: KEY, newUserPending: NEW_USER_KEY }
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindSwitches();
    showNewUserThemePrompt();
  });

  window.addEventListener('storage', function (event) {
    if (event.key === KEY) {
      applyTheme(event.newValue === DARK ? DARK : LIGHT);
      syncSwitches(getTheme());
    }
  });
})();
