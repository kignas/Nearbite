/* =====================================================================
   Eatswada persistent app-shell — flagged entry (?ewAppShell=1)
   ---------------------------------------------------------------------
   Mounts the real persistent React shell on the canonical Home document.
   Off by default: without the flag this file does nothing at all.

   The legacy `islands/nav-island.js` (ewNavIsland) remains the separate
   flag-OFF fallback and is left untouched; when ewAppShell is active this
   entry suppresses the legacy island so the two nav shells never conflict.

   Built by `modern-shell/` into `islands/app-shell.js` (single IIFE).
   ===================================================================== */
import { createRoot, type Root } from 'react-dom/client';
import AppShell from './AppShell';
import shellCss from './app-shell.css?inline';
import ordersCss from './orders-island.css?inline';
import navCss from './nav-island.css?inline';

declare global {
  interface Window {
    EATSWADA_APP_SHELL?: boolean;
  }
}

const MOUNT_ID = 'ew-app-shell-root';
const STYLE_ID = 'ew-app-shell-styles';
const LEGACY_NAV_HOST = 'ew-nav-island';

function isEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('ewAppShell');
    if (param === '1') return true;
    if (param === '0') return false;
  } catch {
    /* ignore malformed URLs and fall through to the deploy switch */
  }
  return window.EATSWADA_APP_SHELL === true;
}

function addStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

function mount(): void {
  if (!isEnabled()) return;

  const host = document.getElementById(MOUNT_ID);
  if (!host || host.dataset.ewAppShellMounted === '1') return;

  // Suppress the legacy flag-OFF nav fallback so the two shells do not both
  // render. Its script has already been fetched; we only neutralise its mount
  // node (reversible, nothing is deleted).
  const legacyNav = document.getElementById(LEGACY_NAV_HOST);
  if (legacyNav) {
    legacyNav.hidden = true;
    legacyNav.dataset.ewNavMounted = '1';
  }

  addStyle(STYLE_ID, shellCss);
  // The shell never applies the legacy `.ew-orders-island-active` class, and
  // that block contains a broad `body > *` hide. Strip the dead rule so the
  // shell never ships a body-wide hiding strategy; the shell switches routes
  // by opacity/visibility on its own sibling layers instead.
  addStyle(
    'ew-app-shell-orders-styles',
    ordersCss.replace(/html\.ew-orders-island-active\s+body\s*>\s*\*\s*\{[^}]*\}/g, ''),
  );
  addStyle('ew-app-shell-nav-styles', navCss);
  // Flag-scoped activation hook; also lifts the cart bar above the nav via
  // the shared --nb-cart-bottom variable cart-bar.js already reads.
  document.documentElement.classList.add('ew-app-shell-active');

  host.dataset.ewAppShellMounted = '1';
  host.hidden = false;

  const root: Root = createRoot(host);
  root.render(<AppShell />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
