/* =====================================================================
   Eatswada persistent React app-shell (real integration, flagged)
   ---------------------------------------------------------------------
   Canonical entrypoint: index.html. The shell adopts the existing Home
   DOM (#home-header + main.page) instead of recreating it, and renders the
   real OrdersScreen for Orders. Both screens live in this one document, so
   the Motion `layoutId` pill travels between Home and Orders without a
   document reload.

   Both screens are kept mounted and cross-faded with opacity. This is
   deliberate: React unmounting the Home wrapper would detach the adopted
   Home nodes and destroy their DOM identity, so the shell never unmounts
   them. Keeping both mounted also preserves each screen's scroll position
   natively.

   Scrolling model:
   - Home keeps scrolling on the window/documentElement (unchanged), so the
     adopted Home lives in a static wrapper, not an overflow container.
   - Orders scrolls inside its own #ew-app-orders box so it keeps a separate
     scroll position; its sticky header sticks within that box.

   Only mounted when ?ewAppShell=1 is present (see app-shell.tsx).
   ===================================================================== */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import OrdersScreen from './OrdersScreen';

export type Screen = 'home' | 'orders';

const PILL_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.72 };

declare global {
  interface Window {
    __ewAppShellMounts?: number;
    __ewAppShellAdopted?: boolean;
  }
}

/* ------------------------------------------------------------------ *
 * Route store — the single source of truth for the active screen.
 * ------------------------------------------------------------------ */
type RouteStore = {
  get: () => Screen;
  set: (screen: Screen) => void;
  subscribe: (listener: () => void) => () => void;
};

function createRouteStore(initial: Screen): RouteStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (screen) => {
      if (screen === value) return;
      value = screen;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function bootstrapScreen(): Screen {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('screen') === 'orders') return 'orders';
    if (window.location.hash.replace(/^#\/?/, '') === 'orders') return 'orders';
    return 'home';
  } catch {
    return 'home';
  }
}

export const routeStore: RouteStore = createRouteStore(bootstrapScreen());

function buildUrl(screen: Screen): string {
  const url = new URL(window.location.href);
  if (screen === 'orders') url.searchParams.set('screen', 'orders');
  else url.searchParams.delete('screen');
  url.hash = '';
  return url.pathname + url.search;
}

/* Push a real history entry so Back/Forward work natively. */
function navigateTo(screen: Screen): void {
  if (screen === routeStore.get()) return;
  window.history.pushState({ ewAppShell: true, screen }, '', buildUrl(screen));
  routeStore.set(screen);
}

/* ------------------------------------------------------------------ *
 * Persistent bottom navigation. Never unmounted during tab changes, so
 * the shared layoutId pill travels between Home and Orders.
 * ------------------------------------------------------------------ */
function ShellNav({ active, reduceMotion }: { active: Screen; reduceMotion: boolean }) {
  const [tap, setTap] = useState<{ id: Screen; nonce: number } | null>(null);
  const tapSequence = useRef(0);
  const tabs = useMemo(
    () => [
      { id: 'home' as const, label: 'Home', icon: 'fa-house' },
      { id: 'orders' as const, label: 'Orders', icon: 'fa-receipt' },
    ],
    [],
  );

  return (
    <nav className="ew-bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`ew-nav-tab${selected ? ' is-active' : ''}`}
            aria-current={selected ? 'page' : undefined}
            onClick={() => {
              tapSequence.current += 1;
              setTap({ id: tab.id, nonce: tapSequence.current });
              navigateTo(tab.id);
            }}
          >
            <span className="ew-nav-pill">
              {selected ? (
                <motion.span
                  className="ew-nav-active-bg"
                  layoutId="eatswada-active-nav-pill"
                  transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                />
              ) : null}
              <span className="ew-nav-icon-wrap" aria-hidden="true">
                {tap?.id === tab.id && !reduceMotion ? (
                  <>
                    <motion.span
                      key={`ring-outer-${tap.nonce}`}
                      className="ew-nav-tap-ring ew-nav-tap-ring--outer"
                      initial={{ scale: 0.55, opacity: 0.48 }}
                      animate={{ scale: 2.35, opacity: 0 }}
                      transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.span
                      key={`ring-inner-${tap.nonce}`}
                      className="ew-nav-tap-ring ew-nav-tap-ring--inner"
                      initial={{ scale: 0.72, opacity: 0.38 }}
                      animate={{ scale: 1.65, opacity: 0 }}
                      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.035 }}
                      onAnimationComplete={() =>
                        setTap((current) => (current?.nonce === tap.nonce ? null : current))
                      }
                    />
                  </>
                ) : null}
                <motion.i
                  key={tap?.id === tab.id ? `icon-${tap.nonce}` : `icon-${tab.id}`}
                  className={`fa-solid ${tab.icon}`}
                  animate={
                    tap?.id === tab.id && !reduceMotion
                      ? { scale: [1, 0.84, 1.16, 1], y: [0, 1.5, -2.5, 0], rotate: [0, -4, 3, 0] }
                      : { scale: 1, y: 0, rotate: 0 }
                  }
                  transition={{ duration: 0.46, times: [0, 0.28, 0.62, 1], ease: [0.2, 0.8, 0.2, 1] }}
                />
              </span>
              <span className="ew-nav-label">{tab.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ *
 * Home screen — adopts the existing Home DOM into the shell. Mounted
 * once and never unmounted, so the adopted nodes keep their identity.
 * ------------------------------------------------------------------ */
function HomeScreen({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.__ewAppShellAdopted) return;
    const header = document.getElementById('home-header');
    const main = document.querySelector('main.page');
    if (!header || !main) return;
    host.appendChild(header);
    host.appendChild(main);
    window.__ewAppShellAdopted = true;
  }, []);

  return (
    <motion.div
      className="ew-app-route ew-app-home"
      ref={hostRef}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: reduceMotion ? 0.01 : active ? 0.18 : 0.12, ease: 'easeOut' }}
      style={{ pointerEvents: active ? 'auto' : 'none' }}
      aria-hidden={!active}
      inert={!active}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Shell root.
 * ------------------------------------------------------------------ */
export default function AppShell() {
  const reduceMotion = useReducedMotion();
  const active = useSyncExternalStore(routeStore.subscribe, routeStore.get, routeStore.get);
  const ordersRef = useRef<HTMLDivElement>(null);
  // Orders mounts on first visit and then stays mounted, so its scroll
  // position and fetched state survive Home ↔ Orders changes.
  const [ordersMounted, setOrdersMounted] = useState(active === 'orders');

  // Counts mounts once per document; proves the shell does not remount
  // during a same-document Home ↔ Orders change.
  useState(() => {
    window.__ewAppShellMounts = (window.__ewAppShellMounts ?? 0) + 1;
    return null;
  });

  useEffect(() => {
    if (active === 'orders') setOrdersMounted(true);
  }, [active]);

  // Seed history state so the first Back returns to the shell entrypoint.
  useEffect(() => {
    if (!window.history.state?.ewAppShell) {
      window.history.replaceState(
        { ewAppShell: true, screen: routeStore.get() },
        '',
        buildUrl(routeStore.get()),
      );
    }
    const onPop = () => {
      const state = window.history.state;
      const screen: Screen =
        state?.ewAppShell && state.screen === 'orders' ? 'orders' : bootstrapScreen();
      routeStore.set(screen);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Bring the Orders scroller to the top the first time it appears.
  useEffect(() => {
    if (active === 'orders' && ordersRef.current) {
      ordersRef.current.scrollTop = 0;
    }
  }, [ordersMounted, active]);

  return (
    <div id="ew-app-shell">
      <HomeScreen active={active === 'home'} reduceMotion={!!reduceMotion} />

      {ordersMounted ? (
        <motion.div
          id="ew-app-orders"
          ref={ordersRef}
          className="ew-app-route ew-app-orders"
          animate={{ opacity: active === 'orders' ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0.01 : active === 'orders' ? 0.18 : 0.12, ease: 'easeOut' }}
          style={{ pointerEvents: active === 'orders' ? 'auto' : 'none' }}
          aria-hidden={active !== 'orders'}
          inert={active !== 'orders'}
        >
          <div className="ew-react-orders">
            <OrdersScreen />
          </div>
        </motion.div>
      ) : null}

      {/* Persistent nav: mounted once, never remounted on tab change. */}
      <div className="ew-nav-island-host ew-app-nav-host">
        <ShellNav active={active} reduceMotion={!!reduceMotion} />
      </div>
    </div>
  );
}
