import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import HomeHeader from './HomeHeader';

type Screen = 'home' | 'orders';

type EatswadaNavMessage = {
  type: 'EATSWADA_NAVIGATE';
  to: Screen;
};

function getScreen(pathname: string): Screen {
  return pathname.replace(/\/+$/, '').endsWith('/orders') ? 'orders' : 'home';
}

function HomeScreen() {
  return (
    <div className="ew-screen-content ew-home-screen">
      <HomeHeader />
      <main className="page">
        <section className="section" aria-label="Home migration preview">
          <div className="sec-head"><h2 className="sec-title">Home migration preview</h2></div>
          <p className="ew-preview-copy">
            Home and Orders now share one navigation shell. The existing Home sections
            will be migrated here in their own stage without changing their data behavior.
          </p>
        </section>
      </main>
    </div>
  );
}

function LegacyOrdersScreen({ active, load, onNavigate }: { active: boolean; load: boolean; onNavigate: (to: Screen) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  const handleLoad = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      if (frame.contentWindow?.location.href !== 'about:blank') setFrameReady(true);

      // Keep the legacy Orders page and its existing behavior, but let the
      // React shell own the one persistent bottom navigation.
      if (!doc.getElementById('ew-react-shell-bridge-style')) {
        const style = doc.createElement('style');
        style.id = 'ew-react-shell-bridge-style';
        style.textContent = `
          #nearbite-bottom-tabbar, #nearbite-help-center { display:none !important; }
          html, body { overscroll-behavior: contain; }
        `;
        doc.head.appendChild(style);
      }

      const frameWindow = frame.contentWindow as (Window & { nearbiteSafeBack?: () => void }) | null;
      if (frameWindow) frameWindow.nearbiteSafeBack = () => onNavigate('home');

      if (!doc.documentElement.dataset.ewReactShellBridge) {
        doc.documentElement.dataset.ewReactShellBridge = '1';
        doc.addEventListener('click', (event) => {
          const target = event.target as Element | null;
          if (!target || typeof target.closest !== 'function') return;
          const link = target.closest<HTMLAnchorElement>('#nearbite-bottom-tabbar a.nb-tab');
          if (!link) return;
          const tab = link.dataset.tab;
          if (tab !== 'home' && tab !== 'orders') return;
          event.preventDefault();
          event.stopImmediatePropagation();
          onNavigate(tab);
        }, true);
      }
    } catch {
      // If the legacy page is ever hosted cross-origin, keep its normal behavior.
    }
  }, [onNavigate]);

  return (
    <div className="ew-orders-frame-wrap" aria-hidden={!active}>
      {!frameReady && load && (
        <div className="ew-orders-loading" role="status">Loading your orders…</div>
      )}
      <iframe
        ref={frameRef}
        className="ew-orders-frame"
        src={load ? '/orders.html?ewReactShell=1' : 'about:blank'}
        title="Your Eatswada orders"
        onLoad={handleLoad}
        tabIndex={active ? 0 : -1}
      />
    </div>
  );
}

function BottomNavigation({ active }: { active: Screen }) {
  const reduceMotion = useReducedMotion();
  const tabs = useMemo(() => [
    { id: 'home' as const, label: 'Home', icon: 'fa-house', to: '/' },
    { id: 'orders' as const, label: 'Orders', icon: 'fa-receipt', to: '/orders' },
  ], []);

  return (
    <nav className="ew-bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={`ew-nav-tab${selected ? ' is-active' : ''}`}
            aria-current={selected ? 'page' : undefined}
          >
            <span className="ew-nav-pill">
              {selected && (
                <motion.span
                  className="ew-nav-active-bg"
                  layoutId="eatswada-active-nav-pill"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.72 }}
                />
              )}
              <i className={`fa-solid ${tab.icon}`} aria-hidden="true" />
              <span className="ew-nav-label">{tab.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = getScreen(location.pathname);
  const [ordersVisited, setOrdersVisited] = useState(active === 'orders');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (active === 'orders') setOrdersVisited(true);
  }, [active]);


  const navigateFromLegacy = useCallback((to: Screen) => {
    navigate(to === 'orders' ? '/orders' : '/');
  }, [navigate]);

  const transition = reduceMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 260, damping: 30, mass: 0.82 };

  const paneStyle = (screen: Screen) => {
    const isActive = active === screen;
    const inactiveX = screen === 'home' ? -34 : 34;
    return {
      x: isActive ? 0 : inactiveX,
      opacity: isActive ? 1 : 0,
      scale: isActive ? 1 : 0.992,
      pointerEvents: isActive ? 'auto' as const : 'none' as const,
      zIndex: isActive ? 2 : 1,
    };
  };

  return (
    <div className="ew-app-shell">
      <motion.section
        className="ew-page-pane ew-home-pane"
        animate={paneStyle('home')}
        transition={transition}
        aria-hidden={active !== 'home'}
      >
        <HomeScreen />
      </motion.section>

      <motion.section
        className="ew-page-pane ew-orders-pane"
        animate={paneStyle('orders')}
        transition={transition}
        aria-hidden={active !== 'orders'}
      >
        <LegacyOrdersScreen active={active === 'orders'} load={ordersVisited} onNavigate={navigateFromLegacy} />
      </motion.section>

      <BottomNavigation active={active} />
    </div>
  );
}
