import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeHeaderTop, SharedSearchBar } from './SharedHeaderChrome';

type OrderItem = {
  name?: string;
  quantity?: number;
  price?: number;
  menuItem?: string | { _id?: string };
  customizations?: Record<string, unknown>;
};

type Order = {
  _id: string;
  orderNumber?: string;
  restaurantName?: string;
  restaurantImage?: string;
  restaurantCuisine?: string;
  cuisine?: string;
  status: string;
  total?: number;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  tipAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  coupon?: { code?: string };
  createdAt?: string;
  estimatedDelivery?: string;
  deliveryAddress?: string | Record<string, unknown>;
  address?: string;
  items?: OrderItem[];
  rider?: { phone?: string };
  riderPhone?: string;
  refund?: unknown;
  refundStatus?: string;
  [key: string]: unknown;
};

type StatusInfo = { label: string; icon: string; stage: number };
type StatusHeadline = { title: string; detail: string; note?: string; overdue?: boolean };
type PaymentInfo = { label: string; short: string; method?: string; tone: 'paid' | 'good' | 'warn' | 'bad' | '' };
type StatusApi = {
  ACTIVE: string[];
  norm: (status: unknown) => string;
  info: (order: Order) => StatusInfo;
  headline: (order: Order) => StatusHeadline;
  riderMoving: (order: Order) => boolean;
  riderPhone: (order: Order) => string;
  fmtDateTime: (value: unknown) => string;
  payment: (order: Order) => PaymentInfo;
  isRefunded: (order: Order) => boolean;
};

declare global {
  interface Window {
    CONFIG?: { API_BASE_URL?: string };
    API_BASE_URL?: string;
    EatswadaOrderStatus?: StatusApi;
  }
}

const FALLBACK_ACTIVE = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery', 'on_the_way'];

function fallbackStatusApi(): StatusApi {
  const norm = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const info = (order: Order): StatusInfo => {
    const s = norm(order.status);
    if (s === 'pending') return { label: 'Order placed', icon: 'fa-receipt', stage: 1 };
    if (['confirmed', 'preparing'].includes(s)) return { label: 'Preparing your order', icon: 'fa-kitchen-set', stage: 2 };
    if (s === 'ready' || s === 'assigned' || s === 'picked_up') return { label: 'Delivery partner assigned', icon: 'fa-person-biking', stage: 3 };
    if (['out_for_delivery', 'on_the_way'].includes(s)) return { label: 'On the way', icon: 'fa-motorcycle', stage: 4 };
    return { label: s ? s.replace(/_/g, ' ') : 'Order update', icon: 'fa-clock', stage: 1 };
  };
  const headline = (order: Order): StatusHeadline => {
    const data = info(order);
    const s = norm(order.status);
    const moving = ['picked_up', 'out_for_delivery', 'on_the_way'].includes(s);
    const detail = moving ? 'Your order is on the way' : data.label;
    return { title: data.label, detail, note: order.estimatedDelivery ? `Estimated delivery ${formatDateTime(order.estimatedDelivery)}` : undefined };
  };
  const fmtDateTime = (value: unknown) => formatDateTime(value);
  const payment = (order: Order): PaymentInfo => {
    const status = norm(order.paymentStatus);
    const method = String(order.paymentMethod || '').trim();
    if (status === 'paid') return { label: 'Paid', short: 'Paid', method, tone: 'paid' };
    if (['failed', 'cancelled'].includes(status)) return { label: 'Payment failed', short: 'Payment failed', method, tone: 'bad' };
    if (status) return { label: 'Payment pending', short: 'Payment pending', method, tone: 'warn' };
    return { label: 'Payment status unavailable', short: '', method, tone: '' };
  };
  return {
    ACTIVE: FALLBACK_ACTIVE,
    norm,
    info,
    headline,
    riderMoving: (order) => ['picked_up', 'out_for_delivery', 'on_the_way'].includes(norm(order.status)),
    riderPhone: (order) => String(order.riderPhone || order.rider?.phone || ''),
    fmtDateTime,
    payment,
    isRefunded: (order) => {
      const s = norm(order.refundStatus);
      return s === 'refunded' || order.refund === true || Boolean((order.refund as { status?: unknown } | undefined)?.status && norm((order.refund as { status?: unknown }).status) === 'refunded');
    },
  };
}

function getStatusApi(): StatusApi {
  return window.EatswadaOrderStatus || fallbackStatusApi();
}

function getApiBase(): string {
  return String(window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://api.eatswada.com/api').replace(/\/$/, '');
}

function getToken(): string | null {
  let token = localStorage.getItem('nearbite_token') || localStorage.getItem('token');
  if (token === 'undefined' || token === 'null') token = null;
  return token;
}

function formatDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function safeUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function orderLabel(order: Order): string {
  return order.orderNumber || String(order._id || '').slice(-6).toUpperCase();
}

function addressText(order: Order): string {
  const value = order.deliveryAddress;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const a = value as Record<string, unknown>;
    return String(a.formatted || a.fullAddress || a.addressLine || a.line1 || '');
  }
  return String(order.address || '');
}

function isActiveOrder(order: Order, api: StatusApi): boolean {
  return api.ACTIVE.includes(api.norm(order.status));
}

function isRefunded(order: Order, api: StatusApi): boolean {
  return api.isRefunded(order);
}

function money(value: unknown): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function OrdersSharedHeader({ value, onChange, onClear }: { value: string; onChange: (v: string) => void; onClear: () => void }) {
  return (
    <header className="hero-header ew-orders-shared-header" data-theme="anime">
      <HomeHeaderTop />
      <div className="search-row es-header-item">
        <SharedSearchBar
          value={value}
          onChange={onChange}
          onClear={onClear}
          placeholder="Search restaurant, item, or Order ID"
          ariaLabel="Search orders"
        />
      </div>
    </header>
  );
}

function LiveOrderCard({ order, api, onHelp }: { order: Order; api: StatusApi; onHelp: () => void }) {
  const info = api.info(order);
  const headline = api.headline(order);
  const address = addressText(order);
  const riderPhone = api.riderPhone(order);
  const moving = api.riderMoving(order);
  const stage = Math.min(4, Math.max(1, info.stage));
  const items = order.items?.length ? `${order.items[0].quantity || 1} × ${order.items[0].name || 'Item'}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}` : '';
  const image = safeUrl(order.restaurantImage);
  const detailsUrl = `track-order.html?id=${encodeURIComponent(order._id)}`;

  return (
    <article className="order-card track-card is-new">
      <div className="oc-head">
        {image ? <img src={image} className="oc-logo" loading="lazy" alt="" /> : <div className="oc-logo" aria-hidden="true">{String(order.restaurantName || 'E').charAt(0).toUpperCase()}</div>}
        <div className="oc-title">
          <h3 className="oc-name">{order.restaurantName || 'Eatswada partner'}</h3>
          <div className="oc-sub">Order #{orderLabel(order)}{order.total != null ? ` · ${money(order.total)}` : ''}</div>
        </div>
      </div>
      <a className={`live-state${headline.overdue ? ' is-late' : ''}`} href={detailsUrl}>
        <span className="live-state-ico"><i className={`fa-solid ${info.icon}`} aria-hidden="true" /></span>
        <span className="live-state-text">
          <span className="live-state-title">{headline.title}</span>
          <span className="live-state-detail">{headline.detail}</span>
          {headline.note ? <span className="live-state-note">{headline.note}</span> : null}
        </span>
      </a>
      <div className="mini-progress" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <div className={`mini-seg${n <= stage ? ' on' : ''}`} key={n}><i /></div>)}
      </div>
      <div className="mini-labels" aria-hidden="true">
        {['Placed', 'Preparing', 'Partner', 'On the way'].map((label, index) => <span className={index < stage ? 'on' : ''} key={label}>{label}</span>)}
      </div>
      {(items || address) ? (
        <div className="live-meta">
          {items ? <div className="meta-row"><i className="fa-solid fa-bag-shopping" aria-hidden="true" /><span>{items}</span></div> : null}
          {address ? <div className="meta-row"><i className="fa-solid fa-location-dot" aria-hidden="true" /><span>{address}</span></div> : null}
        </div>
      ) : null}
      <div className="live-actions">
        <a className="track-btn tap" href={detailsUrl}>{moving ? 'Track live' : 'View live tracking'} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></a>
        {riderPhone ? <a href={`tel:${riderPhone}`} className="icon-btn call tap" aria-label="Call delivery partner"><i className="fa-solid fa-phone" /></a> : null}
        <button className="icon-btn tap" type="button" aria-label="Help with this order" onClick={onHelp}><i className="fa-solid fa-headset" /></button>
      </div>
    </article>
  );
}

function PastOrderCard({ order, api, swiped, setSwiped, onInvoice, onReorder, onRemove }: {
  order: Order;
  api: StatusApi;
  swiped: boolean;
  setSwiped: (value: boolean) => void;
  onInvoice: () => void;
  onReorder: () => void;
  onRemove: () => void;
}) {
  const [startX, setStartX] = useState<number | null>(null);
  const isCancelled = api.norm(order.status) === 'cancelled' && !isRefunded(order, api);
  const isDelivered = api.norm(order.status) === 'delivered';
  const refunded = isRefunded(order, api);
  const statusClass = isDelivered ? 'delivered' : refunded ? 'refunded' : isCancelled ? 'cancelled' : '';
  const statusLabel = refunded ? 'Refunded' : isCancelled ? 'Order cancelled' : api.info(order).label;
  const payment = api.payment(order);
  const cuisine = order.cuisine || order.restaurantCuisine || '';
  const image = safeUrl(order.restaurantImage);
  const detailsUrl = `track-order.html?id=${encodeURIComponent(order._id)}`;
  const shownItems = (order.items || []).slice(0, 3);
  const remaining = Math.max(0, (order.items || []).length - shownItems.length);

  return (
    <div className={`swipe-container${swiped ? ' is-swiped' : ''}`}>
      <div className="swipe-actions">
        <button type="button" className="swipe-btn btn-invoice tap" onClick={onInvoice}><i className="fa-solid fa-receipt" /><span>Invoice</span></button>
        <button type="button" className="swipe-btn btn-support tap" onClick={() => { window.location.href = `support.html?order=${encodeURIComponent(order._id)}`; }}><i className="fa-solid fa-headset" /><span>Help</span></button>
        {isCancelled ? <button type="button" className="swipe-btn btn-delete tap" onClick={onRemove}><i className="fa-solid fa-trash" /><span>Remove</span></button> : null}
      </div>
      <article
        className={`order-card past-card${isCancelled ? ' has-delete' : ''}${swiped ? ' swiped' : ''}`}
        onTouchStart={(event: ReactTouchEvent<HTMLElement>) => setStartX(event.touches[0]?.clientX ?? null)}
        onTouchMove={(event: ReactTouchEvent<HTMLElement>) => {
          if (startX == null) return;
          const diff = startX - (event.touches[0]?.clientX ?? startX);
          if (diff > 40) setSwiped(true);
          if (diff < -40) setSwiped(false);
        }}
        onTouchEnd={() => setStartX(null)}
      >
        <div className="oc-head">
          {image ? <img src={image} className="oc-logo" loading="lazy" alt="" /> : <div className="oc-logo" aria-hidden="true">{String(order.restaurantName || 'E').charAt(0).toUpperCase()}</div>}
          <div className="oc-title">
            <h4 className="oc-name">{order.restaurantName || 'Eatswada partner'}</h4>
            <div className="oc-sub">{cuisine ? `${cuisine} · ` : ''}Order #{orderLabel(order)}</div>
          </div>
        </div>
        {shownItems.length ? (
          <ul className="past-items">
            {shownItems.map((item, index) => <li key={`${order._id}-${index}`}><span className="q">{item.quantity || 1} ×</span><span className="n">{item.name || 'Item'}</span></li>)}
            {remaining ? <li className="more">+ {remaining} more item{remaining > 1 ? 's' : ''}</li> : null}
          </ul>
        ) : null}
        <a className="past-summary" href={detailsUrl} aria-label="View order details">
          <span>
            {order.createdAt ? <span className="past-when">Order placed on {api.fmtDateTime(order.createdAt)}</span> : null}
            <span className={`past-status ${statusClass}`}>{statusLabel}{payment.short && !refunded ? <small> · {payment.short}</small> : null}</span>
          </span>
          <span className="past-total">{money(order.total)} <i className="fa-solid fa-chevron-right" aria-hidden="true" /></span>
        </a>
        <div className="past-footer">
          <div className="ghost-row">
            <button type="button" className="ghost-btn tap" onClick={onInvoice}><i className="fa-solid fa-file-lines" />Invoice</button>
            {isDelivered ? <button type="button" className="ghost-btn rate tap" onClick={() => { window.location.href = `${detailsUrl}#rate`; }}><i className="fa-solid fa-star" />Rate</button> : null}
            <button type="button" className="ghost-btn tap" onClick={() => { window.location.href = `support.html?order=${encodeURIComponent(order._id)}`; }}><i className="fa-solid fa-circle-question" />Help</button>
          </div>
          <button type="button" className="btn-reorder tap" onClick={onReorder}><i className="fa-solid fa-rotate-right" aria-hidden="true" />Reorder</button>
        </div>
      </article>
    </div>
  );
}

function EmptyOrders({ loginRequired, filtered, onExplore }: { loginRequired: boolean; filtered: boolean; onExplore: () => void }) {
  const title = loginRequired ? 'Please log in' : filtered ? 'No matching orders' : 'No orders found';
  const description = loginRequired ? 'Log in to view your premium orders.' : filtered ? 'Try changing your filters or search term.' : "Looks like you haven't placed any orders yet.";
  return (
    <div className="empty-card ew-orders-empty-card">
      <div className="empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="60" cy="103" rx="34" ry="7" fill="#367E34" opacity="0.08" />
          <path d="M32 46 L36 30 C37 26 40 24 44 24 L76 24 C80 24 83 26 84 30 L88 46 Z" fill="#DDEBDC" />
          <rect x="28" y="46" width="64" height="46" rx="12" fill="#367E34" />
          <rect x="28" y="46" width="64" height="14" rx="7" fill="#2C6A2B" />
          <circle cx="60" cy="72" r="12" fill="#EEF5EE" />
          <path d="M55 72 L58.5 76 L66 68" stroke="#367E34" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h4>{title}</h4>
      <p>{description}</p>
      <button type="button" className="explore-btn tap" onClick={onExplore}>{loginRequired ? 'LOGIN NOW' : 'Explore Restaurants'}</button>
    </div>
  );
}

function SkeletonOrders() {
  return (
    <div className="sk-wrapper">
      <div className="sk-card"><div className="sk-body"><div className="sk sk-avatar" /><div className="sk sk-text-1" /><div className="sk sk-text-2" /><div className="sk sk-box" /></div></div>
      <div className="sk-card"><div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><div className="sk" style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0 }} /><div style={{ flex: 1 }}><div className="sk sk-text-1" /><div className="sk sk-text-2" style={{ marginBottom: 0 }} /></div></div><div className="sk sk-line" /><div className="sk sk-line" style={{ width: '70%' }} /></div>
    </div>
  );
}

export default function OrdersScreen() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loginRequired, setLoginRequired] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState('');
  const [pastLimit, setPastLimit] = useState(6);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const api = useMemo(() => getStatusApi(), []);
  const token = getToken();
  const apiBase = getApiBase();

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setLoginRequired(true);
      setOrders([]);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401 || response.status === 404) {
        setLoading(false);
        setLoginRequired(true);
        setOrders([]);
        return;
      }
      const result = await response.json() as { success?: boolean; data?: Order[] };
      setLoading(false);
      setLoginRequired(false);
      setOrders(response.ok && result.success && Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error(error);
      setLoading(false);
      setLoginRequired(true);
      setOrders([]);
    }
  }, [apiBase, token]);

  useEffect(() => {
    void fetchOrders();
    const timer = window.setInterval(() => void fetchOrders(), 10000);
    return () => window.clearInterval(timer);
  }, [fetchOrders]);

  useEffect(() => {
    setPastLimit(6);
    setSwipedId(null);
  }, [search]);

  const hiddenIds = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('nb_hidden_orders') || '[]');
      return new Set<string>(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      return new Set<string>();
    }
  }, [orders]);

  const visibleOrders = useMemo(() => orders.filter((order) => !hiddenIds.has(order._id)), [hiddenIds, orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleOrders;
    return visibleOrders.filter((order) => {
      const matches = [order.restaurantName, order._id, order.orderNumber].some((value) => String(value || '').toLowerCase().includes(q)) || (order.items || []).some((item) => String(item.name || '').toLowerCase().includes(q));
      return matches;
    });
  }, [search, visibleOrders]);

  const liveOrders = useMemo(() => filteredOrders.filter((order) => isActiveOrder(order, api)), [api, filteredOrders]);
  const pastOrders = useMemo(() => filteredOrders.filter((order) => !isActiveOrder(order, api)), [api, filteredOrders]);
  const visiblePast = pastOrders.slice(0, pastLimit);

  useEffect(() => {
    if (!sentinelRef.current || visiblePast.length >= pastOrders.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setPastLimit((current) => current + 6);
    }, { rootMargin: '200px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [pastOrders.length, visiblePast.length]);

  const removeCancelled = useCallback((id: string) => {
    try {
      const set = new Set<string>(JSON.parse(localStorage.getItem('nb_hidden_orders') || '[]'));
      set.add(id);
      localStorage.setItem('nb_hidden_orders', JSON.stringify([...set]));
      setOrders((current) => [...current]);
    } catch {
      showToast('Could not remove this order from view.');
    }
  }, [showToast]);

  const reorder = useCallback(async (orderId: string) => {
    if (!token) {
      setLoginRequired(true);
      return;
    }
    const order = orders.find((candidate) => candidate._id === orderId);
    if (!order?.items?.length) {
      showToast('Could not find this order.');
      return;
    }
    showToast('Adding items to your cart…');
    let ok = 0;
    let fail = 0;
    for (const item of order.items) {
      const menuId = typeof item.menuItem === 'object' ? item.menuItem?._id : item.menuItem;
      if (!menuId) {
        fail += 1;
        continue;
      }
      try {
        const response = await fetch(`${apiBase}/cart/add`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ menuItemId: menuId, quantity: item.quantity || 1, customizations: item.customizations || {} }),
        });
        if (response.ok) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    if (!ok) {
      showToast('Sorry, none of these items are available right now.');
      return;
    }
    showToast(fail ? `${ok} item${ok > 1 ? 's' : ''} added · ${fail} unavailable` : 'Added to cart!');
    window.setTimeout(() => { window.location.href = 'cart.html'; }, 850);
  }, [apiBase, orders, showToast, token]);

  useEffect(() => {
    const reorderId = new URLSearchParams(window.location.search).get('reorder');
    if (!reorderId || loading || !orders.length) return;
    window.history.replaceState(window.history.state, '', '/orders');
    void reorder(reorderId);
  }, [loading, orders, reorder]);

  const handleLogin = () => {
    window.location.href = 'login.html';
  };

  const filteredEmpty = Boolean(search.trim());

  return (
    <div
      className="ew-screen-content ew-orders-screen-content"
      onTouchStart={(event: ReactTouchEvent<HTMLDivElement>) => {
        const el = event.currentTarget as HTMLDivElement;
        if (event.touches[0] && el.scrollTop === 0) {
          el.dataset.ptrStartY = String(event.touches[0].clientY);
        }
      }}
      onTouchMove={(event: ReactTouchEvent<HTMLDivElement>) => {
        const el = event.currentTarget as HTMLDivElement;
        const start = Number(el.dataset.ptrStartY || 0);
        if (!start || el.scrollTop !== 0 || !event.touches[0]) return;
        const next = Math.max(0, Math.min(60, event.touches[0].clientY - start));
        if (next > 0) setPullDistance(next);
      }}
      onTouchEnd={() => {
        if (pullDistance > 50) void fetchOrders();
        setPullDistance(0);
      }}
    >
      <div id="ptr-indicator" className={pullDistance > 50 ? 'ptr-spinning' : undefined} style={{ height: pullDistance ? `${pullDistance}px` : undefined }} aria-hidden="true"><div className="ptr-ring" /></div>
      <OrdersSharedHeader value={search} onChange={setSearch} onClear={() => setSearch('')} />

      <main className="orders-content">
        {loading ? <SkeletonOrders /> : loginRequired ? <EmptyOrders loginRequired filtered={false} onExplore={handleLogin} /> : filteredOrders.length === 0 ? <EmptyOrders loginRequired={false} filtered={filteredEmpty} onExplore={() => navigate('/')} /> : (
          <>
            {liveOrders.length ? (
              <section aria-labelledby="active-orders-heading">
                <div className="section-title"><div className="st-left" id="active-orders-heading">Active orders <span className="pulse-dot-sm" /></div><div className="st-count">{liveOrders.length} active</div></div>
                {liveOrders.map((order) => <LiveOrderCard key={order._id} order={order} api={api} onHelp={() => { window.location.href = `support.html?order=${encodeURIComponent(order._id)}`; }} />)}
              </section>
            ) : null}

            {pastOrders.length ? (
              <section aria-labelledby="past-orders-heading" style={{ marginTop: liveOrders.length ? 20 : 4 }}>
                <div className="section-title"><div className="st-left" id="past-orders-heading">Past orders</div><div className="st-count">{pastOrders.length} total</div></div>
                {visiblePast.map((order) => (
                  <PastOrderCard
                    key={order._id}
                    order={order}
                    api={api}
                    swiped={swipedId === order._id}
                    setSwiped={(value) => setSwipedId(value ? order._id : null)}
                    onInvoice={() => setInvoiceOrder(order)}
                    onReorder={() => void reorder(order._id)}
                    onRemove={() => removeCancelled(order._id)}
                  />
                ))}
                {pastOrders.length > pastLimit ? <div className="load-more-wrap"><button type="button" className="load-more-btn tap" onClick={() => setPastLimit((current) => current + 6)}><i className="fa-solid fa-chevron-down" />Load more orders</button></div> : null}
                <div ref={sentinelRef} id="scroll-sentinel" />
              </section>
            ) : null}
          </>
        )}
      </main>

      {invoiceOrder ? <InvoiceModal order={invoiceOrder} api={api} onClose={() => setInvoiceOrder(null)} /> : null}
      {toast ? <div className="od-toast show">{toast}</div> : null}
    </div>
  );
}

function InvoiceModal({ order, api, onClose }: { order: Order; api: StatusApi; onClose: () => void }) {
  const dt = order.createdAt ? new Date(order.createdAt) : new Date();
  const payment = api.payment(order);
  const rows = (order.items || []).map((item, index) => <tr key={`${order._id}-invoice-${index}`}><td>{item.quantity || 1} × {item.name || 'Item'}</td><td className="r">{money((item.price || 0) * (item.quantity || 1))}</td></tr>);
  const address = addressText(order);
  const discount = Number(order.discount || 0);
  const tip = Number(order.tipAmount || 0);
  const paid = api.norm(order.paymentStatus) === 'paid';

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div className="invoice-overlay open" role="dialog" aria-modal="true" aria-label="Order invoice" onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="invoice-sheet">
        <button type="button" className="inv-close no-print" onClick={onClose} aria-label="Close">×</button>
        <div className="inv-head"><div className="inv-brand">Eatswada</div><div className={`inv-status ${payment.tone}`}>{payment.short || payment.label}</div></div>
        <div className="inv-sub">{order.restaurantName || 'Restaurant'}</div>
        <div className="inv-meta"><span>Invoice #{orderLabel(order)}</span><span>{dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>
        {address ? <div className="inv-addr">Deliver to: {address}</div> : null}
        <table className="inv-table"><tbody>{rows}</tbody></table>
        <div className="inv-line"><span>Item total</span><span>{money(order.subtotal)}</span></div>
        {discount > 0 ? <div className="inv-line disc"><span>Discount{order.coupon?.code ? ` (${order.coupon.code})` : ''}</span><span>− {money(discount)}</span></div> : null}
        <div className="inv-line"><span>Delivery fee</span><span>{money(order.deliveryFee)}</span></div>
        {tip > 0 ? <div className="inv-line"><span>Tip</span><span>{money(tip)}</span></div> : null}
        <div className="inv-total"><span>Total {paid ? 'paid' : 'payable'}</span><span>{money(order.total)}</span></div>
        <div className="inv-foot">{payment.method ? `Payment: ${payment.method} · ` : ''}Thank you for ordering with Eatswada.</div>
        <div className="inv-actions no-print">
          <button type="button" className="inv-btn ghost" onClick={onClose}>Close</button>
          <button type="button" className="inv-btn solid" onClick={() => window.print()}><i className="fa-solid fa-download" /> Save / Print</button>
        </div>
      </div>
    </div>
  );
}
