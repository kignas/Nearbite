/* =====================================================================
   Eatswada persistent navigation shell (Phase 2/3)
   ---------------------------------------------------------------------
   This is the reference `AppShell` navigation, kept mounted as a single
   React instance per document. The active pill is the original shared
   Motion `layoutId="eatswada-active-nav-pill"` spring — the pill
   genuinely travels between tabs because the component never unmounts
   within a document.

   Phase 3 (Option A): the two tabs navigate between the two real
   documents (index.html / orders.html) with ordinary full-page loads, so
   both keep their URLs, titles, canonicals, refresh and native history.
   The cross-document cross-fade is provided by the existing
   `@view-transition { navigation: auto }` rule in
   eatswada-app-transitions.css; no competing transition system is added.
   The React instance remounts on each cross-document navigation — this is
   inherent to multi-page navigation and is the accepted Phase 3
   limitation.

   Route transition determined from the supplied screen recording: the
   content cross-fades with no horizontal slide (column-shift analysis
   showed dx=0), matching the current AppShell.tsx opacity transition
   { duration: 0.18, ease: 'easeOut' } rather than the .bak spring/slide
   variant.
   ===================================================================== */
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export type Screen = 'home' | 'orders';

const ROUTE_TRANSITION = { duration: 0.18, ease: 'easeOut' as const };
const PILL_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.72 };

/* Cross-document targets. Navigation is a normal full-page load so both
   documents keep their URLs, titles, canonicals, refresh and native
   history. Only the flags that keep this island enabled are carried over,
   so an explicitly enabled shell stays enabled across Home ↔ Orders. */
const PAGE_FOR: Record<Screen, string> = { home: 'index.html', orders: 'orders.html' };

function buildTargetUrl(screen: Screen): string {
  const url = new URL(PAGE_FOR[screen], window.location.href);
  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  (['ewNavIsland', 'ewNavHarness'] as const).forEach((key) => {
    if (current.get(key) === '1') next.set(key, '1');
  });
  url.search = next.toString();
  return url.href;
}

function screenForPath(pathname: string): Screen {
  return pathname.replace(/\/+$/, '').toLowerCase().endsWith('orders.html') ? 'orders' : 'home';
}

type NavStore = {
  get: () => Screen;
  set: (screen: Screen) => void;
  subscribe: (listener: () => void) => () => void;
};

function createNavStore(initial: Screen): NavStore {
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

export const navStore: NavStore = createNavStore(screenForPath(window.location.pathname));

/* Navigate between the two real documents. This is an ordinary same-origin
   full-page navigation, so both pages keep their URLs, titles, canonicals,
   refresh and native history. The cross-document cross-fade is provided by
   the existing `@view-transition { navigation: auto }` rule in
   eatswada-app-transitions.css (already loaded by both pages), which also
   honours prefers-reduced-motion. No second transition system is added. */
function navigateTo(screen: Screen): void {
  if (screen === screenForPath(window.location.pathname)) return;
  window.location.href = buildTargetUrl(screen);
}

/* ------------------------------------------------------------------ *
 * Persistent bottom navigation — original reference implementation.
 * ------------------------------------------------------------------ */
function BottomNavigation({ active, reduceMotion }: { active: Screen; reduceMotion: boolean }) {
  const [tap, setTap] = useState<{ id: Screen; nonce: number } | null>(null);
  const tapSequence = useRef(0);
  const tabs = useMemo(
    () => [
      { id: 'home' as const, label: 'Home', icon: 'fa-house' },
      { id: 'orders' as const, label: 'Orders', icon: 'fa-receipt' },
    ],
    [],
  );

  const handleTabPress = (id: Screen) => {
    tapSequence.current += 1;
    setTap({ id, nonce: tapSequence.current });
    // Give immediate pill feedback, then perform the real cross-document
    // navigation (the store re-initialises from the URL on the next page).
    navStore.set(id);
    navigateTo(id);
  };

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
            onClick={() => handleTabPress(tab.id)}
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
 * Dev-only harness. Shows the shared layoutId pill moving between Home
 * and Orders and proves the shell instance is not remounted. Rendered
 * only when explicitly enabled; never for normal visitors.
 * ------------------------------------------------------------------ */
function RouteStage({ active, reduceMotion }: { active: Screen; reduceMotion: boolean }) {
  const transition = reduceMotion ? { duration: 0.01 } : ROUTE_TRANSITION;
  return (
    <div className="ew-nav-harness-stage" aria-hidden="true">
      <AnimatePresence mode="sync" initial={false}>
        <motion.section
          key={active}
          className={`ew-route-pane is-${active}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          {active === 'home' ? 'Home pane' : 'Orders pane'}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function NavHarness({ active, reduceMotion }: { active: Screen; reduceMotion: boolean }) {
  const mounts = (window as unknown as { __ewNavMounts?: number }).__ewNavMounts ?? 0;
  const instance = (window as unknown as { __ewNavInstance?: string }).__ewNavInstance ?? '?';
  const [showStage, setShowStage] = useState(true);

  return (
    <div className="ew-nav-harness" role="region" aria-label="Navigation shell test harness">
      <div className="ew-nav-harness-row">
        <span className="ew-nav-harness-title">Nav shell harness</span>
        <span className="ew-nav-harness-meta">dev-only</span>
        <button
          type="button"
          className={active === 'home' ? 'is-on' : ''}
          onClick={() => navStore.set('home')}
        >
          Home
        </button>
        <button
          type="button"
          className={active === 'orders' ? 'is-on' : ''}
          onClick={() => navStore.set('orders')}
        >
          Orders
        </button>
        <button type="button" onClick={() => setShowStage((v) => !v)}>
          {showStage ? 'Hide stage' : 'Show stage'}
        </button>
        <span className="ew-nav-harness-pill">
          <span className="ew-nav-harness-dot" />
          instance {instance} · mounts {mounts}
        </span>
      </div>
      {showStage ? <RouteStage active={active} reduceMotion={reduceMotion} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shell root. Mounted once; never unmounts during tab changes, which is
 * what preserves the Motion layoutId continuity.
 * ------------------------------------------------------------------ */
export default function NavShell({ harness }: { harness: boolean }) {
  const reduceMotion = useReducedMotion();
  const active = useSyncExternalStore(navStore.subscribe, navStore.get, navStore.get);

  // Lazy initialiser runs exactly once per mount, so these counters prove
  // whether the shell remounts during a tab change. They are only read by
  // the dev harness.
  const [mountInfo] = useState(() => {
    const w = window as unknown as { __ewNavMounts?: number; __ewNavInstance?: string };
    w.__ewNavMounts = (w.__ewNavMounts ?? 0) + 1;
    w.__ewNavInstance = Math.random().toString(36).slice(2, 8);
    return { mounts: w.__ewNavMounts, instance: w.__ewNavInstance };
  });
  void mountInfo;

  return (
    <>
      {harness ? <NavHarness active={active} reduceMotion={!!reduceMotion} /> : null}
      <BottomNavigation active={active} reduceMotion={!!reduceMotion} />
    </>
  );
}
