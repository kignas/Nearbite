import { useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { motion, useReducedMotion } from 'motion/react';
import HomeHeader from './HomeHeader';
import OrdersScreen from './OrdersScreen';

type Screen = 'home' | 'orders';

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
            Home and Orders now share one React navigation shell. Home content stays isolated while the Orders page is migrated component-by-component.
          </p>
        </section>
      </main>
    </div>
  );
}

function BottomNavigation({ active }: { active: Screen }) {
  const reduceMotion = useReducedMotion();
  const [tap, setTap] = useState<{ id: Screen; nonce: number } | null>(null);
  const tapSequence = useRef(0);
  const tabs = useMemo(() => [
    { id: 'home' as const, label: 'Home', icon: 'fa-house', to: '/' },
    { id: 'orders' as const, label: 'Orders', icon: 'fa-receipt', to: '/orders' },
  ], []);

  const handleTabPress = (id: Screen) => {
    tapSequence.current += 1;
    setTap({ id, nonce: tapSequence.current });
  };

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
            onClick={() => handleTabPress(tab.id)}
          >
            <span className="ew-nav-pill">
              {selected ? <motion.span
                className="ew-nav-active-bg"
                layoutId="eatswada-active-nav-pill"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.72 }}
              /> : null}
              <span className="ew-nav-icon-wrap" aria-hidden="true">
                {tap?.id === tab.id && !reduceMotion ? <>
                  <motion.span key={`ring-outer-${tap.nonce}`} className="ew-nav-tap-ring ew-nav-tap-ring--outer" initial={{ scale: 0.55, opacity: 0.48 }} animate={{ scale: 2.35, opacity: 0 }} transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }} />
                  <motion.span key={`ring-inner-${tap.nonce}`} className="ew-nav-tap-ring ew-nav-tap-ring--inner" initial={{ scale: 0.72, opacity: 0.38 }} animate={{ scale: 1.65, opacity: 0 }} transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.035 }} onAnimationComplete={() => setTap((current) => current?.nonce === tap.nonce ? null : current)} />
                </> : null}
                <motion.i
                  key={tap?.id === tab.id ? `icon-${tap.nonce}` : `icon-${tab.id}`}
                  className={`fa-solid ${tab.icon}`}
                  animate={tap?.id === tab.id && !reduceMotion ? { scale: [1, 0.84, 1.16, 1], y: [0, 1.5, -2.5, 0], rotate: [0, -4, 3, 0] } : { scale: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.46, times: [0, 0.28, 0.62, 1], ease: [0.2, 0.8, 0.2, 1] }}
                />
              </span>
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
  const active = getScreen(location.pathname);
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 300, damping: 32, mass: 0.84 };

  return (
    <div className="ew-app-shell">
      <div className="ew-route-content">
        <AnimatePresence mode="wait" initial={false}>
          {active === 'orders' ? (
            <motion.section key="orders" className="ew-route-pane" initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={transition}>
              <div className="ew-react-orders"><OrdersScreen /></div>
            </motion.section>
          ) : (
            <motion.section key="home" className="ew-route-pane" initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={transition}>
              <HomeScreen />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <BottomNavigation active={active} />
    </div>
  );
}
