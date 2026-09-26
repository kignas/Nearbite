/* ================================================================
   EATSWADA THEME
   - Existing users: no theme popup.
   - New accounts: one-time theme choice popup on Home.
   - Preference persists in localStorage and is applied before paint.
   - Browser-style dark compatibility layer: adapts legacy light UI
     surfaces/text at runtime without filtering food/promotional images.
   ================================================================ */
(function () {
  'use strict';

  const KEY = 'eatswada_theme';
  const NEW_USER_KEY = 'eatswada_theme_intro_pending';
  const DARK = 'dark';
  const LIGHT = 'light';
  const AUTO_STYLE_ID = 'eatswada-auto-dark-style';
  const AUTO_ATTR = 'data-ew-auto-dark';

  function getTheme() {
    try {
      return localStorage.getItem(KEY) === DARK ? DARK : LIGHT;
    } catch (_) {
      return LIGHT;
    }
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
    return meta;
  }

  function applyTheme(theme) {
    const value = theme === DARK ? DARK : LIGHT;
    const root = document.documentElement;
    root.dataset.ewTheme = value;
    root.style.colorScheme = value;
    ensureColorSchemeMeta();

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === DARK ? '#0B0C10' : '#FFFFFF');

    if (value === DARK) {
      // Build after the browser has calculated the page's normal styles.
      scheduleAutoDark(true);
    } else {
      clearAutoDark();
    }

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

  /* ----------------------------------------------------------------
     Browser-style dark compatibility layer
     ----------------------------------------------------------------
     This is deliberately not a page-wide invert/filter. Browser forced
     dark implementations preserve imagery and accent colors while mapping
     neutral light surfaces/text. We approximate that behavior at paint time
     for legacy hard-coded CSS that does not expose theme tokens.
  ------------------------------------------------------------------ */
  let autoDarkTimer = 0;
  let autoDarkObserver = null;
  let autoDarkRunning = false;
  let autoDarkGeneration = 0;

  function parseRGB(value) {
    if (!value || value === 'transparent') return null;
    const m = String(value).match(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : (m[4].includes('%') ? parseFloat(m[4]) / 100 : +m[4]) };
  }

  function luminance(c) {
    const s = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }

  function saturation(c) {
    const max = Math.max(c.r, c.g, c.b) / 255;
    const min = Math.min(c.r, c.g, c.b) / 255;
    const l = (max + min) / 2;
    if (max === min) return 0;
    return (max - min) / (1 - Math.abs(2 * l - 1));
  }

  function isNeutral(c) {
    return !!c && c.a > 0.02 && saturation(c) <= 0.16;
  }

  function cssColor(c) {
    return c.a < 0.999
      ? `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(1, c.a))})`
      : `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  function mapBackground(c) {
    const l = luminance(c);
    if (!isNeutral(c) || l < 0.62) return null;
    if (l >= 0.94) return '#1D1D1F';
    if (l >= 0.82) return '#222326';
    return '#292A2E';
  }

  function mapText(c) {
    const l = luminance(c);
    if (!isNeutral(c) || l > 0.46) return null;
    if (l <= 0.13) return '#F4F4F6';
    if (l <= 0.28) return '#D9DBE1';
    return '#A8A9B0';
  }

  function mapBorder(c) {
    const l = luminance(c);
    if (!isNeutral(c) || l < 0.62) return null;
    if (l >= 0.88) return '#44454A';
    return '#3A3B40';
  }

  function isProtected(el) {
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'PICTURE' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'SVG' || tag === 'IFRAME') return true;
    if (el.closest('.ew-theme-intro')) return true;
    const cls = String(el.className || '').toLowerCase();
    const id = String(el.id || '').toLowerCase();
    // Preserve obvious promotional/brand artwork and imagery containers.
    if (/hero|banner|promo|promotion|artwork|illustration|logo|brand|food-image|restaurant-image|item-image/.test(cls + ' ' + id)) return true;
    return false;
  }

  function selectorFor(el, id) {
    return `[${AUTO_ATTR}="${id}"]`;
  }

  function collectAutoDarkRules() {
    const rules = [];
    const all = document.body ? document.body.querySelectorAll('*') : [];
    let id = 0;
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (isProtected(el)) continue;
      const cs = getComputedStyle(el);
      const bg = parseRGB(cs.backgroundColor);
      const fg = parseRGB(cs.color);
      const borderValues = [
        cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0 ? mapBorder(parseRGB(cs.borderTopColor)) : null,
        cs.borderRightStyle !== 'none' && parseFloat(cs.borderRightWidth) > 0 ? mapBorder(parseRGB(cs.borderRightColor)) : null,
        cs.borderBottomStyle !== 'none' && parseFloat(cs.borderBottomWidth) > 0 ? mapBorder(parseRGB(cs.borderBottomColor)) : null,
        cs.borderLeftStyle !== 'none' && parseFloat(cs.borderLeftWidth) > 0 ? mapBorder(parseRGB(cs.borderLeftColor)) : null
      ];
      const bgMapped = mapBackground(bg);
      const fgMapped = mapText(fg);
      const hasBorder = borderValues.some(Boolean);

      // Only touch elements where the computed page is still visibly light.
      if (!bgMapped && !fgMapped && !hasBorder) continue;

      const token = String(++id);
      el.setAttribute(AUTO_ATTR, token);
      const sel = selectorFor(el, token);
      const declarations = [];
      if (bgMapped) declarations.push(`background-color:${bgMapped} !important`);
      if (fgMapped) declarations.push(`color:${fgMapped} !important`);
      if (borderValues[0]) declarations.push(`border-top-color:${borderValues[0]} !important`);
      if (borderValues[1]) declarations.push(`border-right-color:${borderValues[1]} !important`);
      if (borderValues[2]) declarations.push(`border-bottom-color:${borderValues[2]} !important`);
      if (borderValues[3]) declarations.push(`border-left-color:${borderValues[3]} !important`);
      if (declarations.length) rules.push(`${sel}{${declarations.join(';')}}`);
    }
    return rules;
  }

  function clearAutoDark() {
    autoDarkGeneration++;
    if (autoDarkTimer) clearTimeout(autoDarkTimer);
    autoDarkTimer = 0;
    if (autoDarkObserver) {
      autoDarkObserver.disconnect();
      autoDarkObserver = null;
    }
    const style = document.getElementById(AUTO_STYLE_ID);
    if (style) style.remove();
    document.querySelectorAll('[' + AUTO_ATTR + ']').forEach(function (el) {
      el.removeAttribute(AUTO_ATTR);
    });
    autoDarkRunning = false;
  }

  function buildAutoDark() {
    if (getTheme() !== DARK || !document.body) return;
    const generation = ++autoDarkGeneration;
    autoDarkRunning = true;

    // Remove only our generated rules/attributes; never touch authored CSS.
    const old = document.getElementById(AUTO_STYLE_ID);
    if (old) old.remove();
    document.querySelectorAll('[' + AUTO_ATTR + ']').forEach(function (el) {
      el.removeAttribute(AUTO_ATTR);
    });

    const rules = collectAutoDarkRules();
    if (generation !== autoDarkGeneration || getTheme() !== DARK) return;

    if (rules.length) {
      const style = document.createElement('style');
      style.id = AUTO_STYLE_ID;
      style.textContent = `/* Eatswada browser-style dark compatibility */\\n${rules.join('\\n')}`;
      (document.head || document.documentElement).appendChild(style);
    }
    autoDarkRunning = false;
  }

  function scheduleAutoDark(force) {
    if (getTheme() !== DARK) return;
    if (autoDarkTimer) clearTimeout(autoDarkTimer);
    autoDarkTimer = setTimeout(function () {
      autoDarkTimer = 0;
      // Let layout/async components settle before reading computed styles.
      requestAnimationFrame(function () {
        requestAnimationFrame(buildAutoDark);
      });
    }, force ? 40 : 140);
  }

  function startAutoDarkObserver() {
    if (!document.body || autoDarkObserver) return;
    autoDarkObserver = new MutationObserver(function (mutations) {
      if (getTheme() !== DARK || autoDarkRunning) return;
      let relevant = false;
      for (let i = 0; i < mutations.length; i++) {
        if (mutations[i].type === 'childList' && (mutations[i].addedNodes.length || mutations[i].removedNodes.length)) {
          relevant = true;
          break;
        }
      }
      if (relevant) scheduleAutoDark(false);
    });
    autoDarkObserver.observe(document.body, { childList: true, subtree: true });
  }

  ensureColorSchemeMeta();
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
    if (getTheme() === DARK) {
      scheduleAutoDark(true);
      startAutoDarkObserver();
    }
  });

  window.addEventListener('load', function () {
    if (getTheme() === DARK) {
      scheduleAutoDark(true);
      startAutoDarkObserver();
    }
  }, { once: true });

  document.addEventListener('eatswada:themechange', function (event) {
    if (event.detail && event.detail.theme === DARK) {
      scheduleAutoDark(true);
      startAutoDarkObserver();
    }
  });

  window.addEventListener('storage', function (event) {
    if (event.key === KEY) {
      applyTheme(event.newValue === DARK ? DARK : LIGHT);
      syncSwitches(getTheme());
      if (getTheme() === DARK) startAutoDarkObserver();
    }
  });
})();
