/* =====================================================================
   Eatswada persistent nav island — Phase 2/3 entry
   ---------------------------------------------------------------------
   Mounts the persistent React navigation shell (reference AppShell nav)
   as a single instance per document. It is a floating overlay: it does
   NOT hide, replace, or reorder any existing page content.

   Phase 3 (Option A): the same component/bundle is loaded on both
   index.html and orders.html. Its tabs navigate between those two real
   documents with ordinary full-page loads, so URLs, titles, canonicals,
   refresh and native history are preserved. Off by default; enabled only
   via an explicit flag so normal visitors are unaffected. Built by
   `modern-shell/` into `islands/nav-island.js`.
   ===================================================================== */
import { createRoot, type Root } from 'react-dom/client';
import NavShell from './NavShell';
import navCss from './nav-island.css?inline';

declare global {
  interface Window {
    EATSWADA_NAV_ISLAND?: boolean;
    __EW_NAV_HARNESS__?: boolean;
  }
}

const MOUNT_ID = 'ew-nav-island';
const STYLE_ID = 'ew-nav-island-styles';

function readFlag(param: string, globalKey: keyof Window): boolean {
  try {
    const value = new URLSearchParams(window.location.search).get(param);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    /* ignore malformed URLs */
  }
  return window[globalKey] === true;
}

function mount(): void {
  const harness = readFlag('ewNavHarness', '__EW_NAV_HARNESS__');
  const enabled = harness || readFlag('ewNavIsland', 'EATSWADA_NAV_ISLAND');
  if (!enabled) return;

  const host = document.getElementById(MOUNT_ID);
  if (!host || host.dataset.ewNavMounted === '1') return;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = navCss;
    document.head.appendChild(style);
  }

  host.dataset.ewNavMounted = '1';
  host.hidden = false;
  host.classList.add('ew-nav-island-host');
  // Flag-scoped hook. Also offsets the cart bar above the nav via the
  // shared --nb-cart-bottom variable that cart-bar.js already reads.
  document.documentElement.classList.add('ew-nav-island-active');

  const root: Root = createRoot(host);
  root.render(<NavShell harness={harness} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
