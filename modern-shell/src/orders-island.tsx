/* =====================================================================
   Eatswada Orders island — Phase 1 entry
   ---------------------------------------------------------------------
   Mounts the reference React OrdersScreen directly (no iframe) into the
   existing orders.html, behind a feature flag. The vanilla Orders page
   stays in the HTML and is shown whenever the island is disabled, the
   flag is off, or JS fails.

   This file is built by `modern-shell/` into `islands/orders-island.js`
   (a single self-contained IIFE). It is the only React code that runs
   in production, and only on orders.html when explicitly enabled.
   ===================================================================== */
import { createRoot, type Root } from 'react-dom/client';
import OrdersScreen from './OrdersScreen';
// Inlined so the island ships zero extra requests and loads no styles at all
// when the feature flag is off.
import islandCss from './orders-island.css?inline';

declare global {
  interface Window {
    EATSWADA_ORDERS_ISLAND?: boolean;
  }
}

const MOUNT_ID = 'ew-orders-island';
const STYLE_ID = 'ew-orders-island-styles';

function isEnabled(): boolean {
  // Feature flag, in priority order:
  //   1. ?ewOrdersIsland=1  -> force on  (for testing / staged rollout)
  //   2. ?ewOrdersIsland=0  -> force off
  //   3. window.EATSWADA_ORDERS_ISLAND  -> deploy-time switch
  // Default: OFF. The vanilla page runs unless explicitly enabled.
  try {
    const param = new URLSearchParams(window.location.search).get('ewOrdersIsland');
    if (param === '1') return true;
    if (param === '0') return false;
  } catch {
    /* ignore malformed URLs and fall through to the deploy switch */
  }
  return window.EATSWADA_ORDERS_ISLAND === true;
}

function mount(): void {
  if (!isEnabled()) return;

  const host = document.getElementById(MOUNT_ID);
  if (!host || host.dataset.ewMounted === '1') return;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = islandCss;
    document.head.appendChild(style);
  }

  // Neutralise the legacy Orders page before React takes over: it is kept in
  // the DOM (reversible), just hidden by `html.ew-orders-island-active`.
  document.documentElement.classList.add('ew-orders-island-active');

  host.dataset.ewMounted = '1';
  host.hidden = false;

  const root: Root = createRoot(host);
  root.render(
    <div className="ew-react-orders">
      <OrdersScreen />
    </div>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
