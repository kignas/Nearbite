/* =====================================================================
   99 STORE — CORE
   API base, single normalizer, canonical cart integration, add controls.
   Cart is owned by cart-bar.js — this file only calls window.updateCart()
   and reads canonical state. Contract preserved exactly.
   ===================================================================== */
(() => {
  const API = 'https://eatswada.onrender.com/api/restaurants/under99';
  const HERO_API = 'https://eatswada.onrender.com/api/home-banners?placement=under99';
  const CART_KEY = 'nearbite_cart';

  const state = window.Eatswada99State = {
    restaurants: [],
    discountOnly: false,
    foodType: 'all',        // all | veg | nonveg
    priceRanges: [],
    deliveryLimit: null,    // minutes cap or null
    priceBand: '99',        // 99 | 100 | 150
    sortMode: 'default',
    freeDeliveryOnly: false,
    greatOffersOnly: false
  };

  const esc = v => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const num = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  const qs = id => document.getElementById(id);
  const deliveryMax = v => {
    const m = String(v || '').match(/\d+/g);
    return m && m.length ? Math.max(...m.map(Number)) : Infinity;
  };

  /* ---------- Normalization: ONE canonical menu-item model ---------- */
  function normalizeRestaurant(raw) {
    const r = raw?.restaurant && typeof raw.restaurant === 'object' ? raw.restaurant : raw;
    const sourceMenu = Array.isArray(raw?.menu) ? raw.menu : (Array.isArray(r?.menu) ? r.menu : []);
    const menu = sourceMenu.map(item => ({
      id: String(item?.id || item?._id || ''),
      name: item?.name || 'Item',
      description: item?.description || '',
      price: num(item?.price),
      originalPrice: item?.originalPrice == null ? null : num(item.originalPrice),
      discountPercent: item?.discountPercent == null ? null : num(item.discountPercent),
      image: item?.image || '',
      isVeg: Boolean(item?.isVeg),
      category: item?.category || 'Recommended',
      isUnder99: Boolean(item?.isUnder99 ?? (num(item?.price) <= 99)),
      isBestseller: Boolean(item?.isBestseller),
      isRecommended: Boolean(item?.isRecommended),
      inStock: item?.inStock !== false,
      customizations: Array.isArray(item?.customizations) ? item.customizations : []
    })).filter(x => x.id && x.price > 0);
    return {
      id: String(r?.id || r?._id || ''),
      name: r?.name || 'Restaurant',
      rating: num(r?.rating),
      ratingCount: r?.ratingCount ?? '',
      deliveryTime: String(r?.deliveryTime || ''),
      estimatedDeliveryMin: num(r?.estimatedDeliveryMin),
      estimatedDeliveryMax: num(r?.estimatedDeliveryMax),
      cuisine: Array.isArray(r?.cuisine) ? r.cuisine.join(', ') : String(r?.cuisine || ''),
      freeDeliveryAbove: r?.freeDeliveryAbove == null ? null : num(r.freeDeliveryAbove),
      menu
    };
  }

  async function fetchJson(url, timeout = 15000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: c.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function loadHero() {
    try {
      const result = await fetchJson(HERO_API, 12000);
      const b = Array.isArray(result?.data) ? result.data[0] : null;
      const image = String(b?.mobileImage || b?.image || '').trim();
      if (image) { const el = qs('u99-hero-art'); if (el) { el.onload = () => el.classList.add('loaded'); el.onerror = () => el.classList.remove('loaded'); el.src = image; el.hidden = false; } }
    } catch (e) { console.warn('[99 Store] hero artwork unavailable', e); }
  }

  async function load() {
    const skeleton = qs('u99-skeleton'), grid = qs('u99-product-grid');
    skeleton?.classList.remove('u99-hidden');
    try {
      const result = await fetchJson(API, 30000);
      const raw = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
      state.restaurants = raw.map(normalizeRestaurant).filter(r => r.id && r.menu.length);
      if (!state.restaurants.length) throw new Error('No qualifying restaurant data returned');
      document.dispatchEvent(new Event('eatswada99:data-ready'));
    } catch (e) {
      console.error('[99 Store] load failed', e);
      if (grid) grid.innerHTML =
        '<div class="u99-empty"><div class="u99-empty-art">' + iconArt('error') + '</div>' +
        '<strong>Couldn\u2019t load deals</strong><span>Check your connection and try again.</span>' +
        '<button class="u99-retry" type="button" onclick="location.reload()">Try again</button></div>';
      document.dispatchEvent(new CustomEvent('eatswada99:data-error', { detail: e }));
    } finally {
      skeleton?.classList.add('u99-hidden');
    }
  }

  /* ---------- Canonical cart reads (owned by cart-bar.js) ---------- */
  function readCart() {
    try {
      const p = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch { return {}; }
  }
  function cartQty(menuItemId, restaurantId) {
    const mid = String(menuItemId || ''), rid = String(restaurantId || '');
    if (!mid) return 0;
    let q = 0; const cart = readCart();
    for (const k in cart) {
      const e = cart[k];
      if (e && String(e.menuItem || '') === mid && String(e.resId || '') === rid) q += num(e.quantity);
    }
    return q;
  }

  /* Base payload — identical contract to before. Optional `selection`
     (from the customization sheet) extends name/price and carries chosen
     options through to the cart without changing the canonical keys. */
  function cartPayload(item, r, selection) {
    const base = num(item.price);
    const addon = selection ? num(selection.addonTotal) : 0;
    const price = base + addon;
    const original = item.originalPrice != null && num(item.originalPrice) > base
      ? num(item.originalPrice) + addon : null;
    const payload = {
      name: item.name,
      price,
      originalPrice: original,
      resId: String(r.id),
      menuItem: String(item.id),
      image: item.image || '',
      isVeg: Boolean(item.isVeg)
    };
    if (selection && Array.isArray(selection.options) && selection.options.length) {
      payload.options = selection.options;     // [{group,name,price,optionId?}]
    }
    return encodeURIComponent(JSON.stringify(payload));
  }

  function ensureCart() {
    if (typeof window.updateCart !== 'function') {
      console.error('[99 Store] updateCart unavailable');
      window.showToast?.('Cart is still loading');
      return false;
    }
    return true;
  }

  function cartChange(item, r, delta) {
    if (!ensureCart()) return;
    if (!item.id) { console.error('[99 Store] real menu item id missing', item); window.showToast?.('This item is unavailable'); return; }
    window.updateCart(cartPayload(item, r), delta > 0 ? 1 : -1);
  }

  /* Add a specific configured variant (from the customization sheet). */
  function addWithOptions(item, r, selection, qty) {
    if (!ensureCart()) return;
    const n = Math.max(1, num(qty, 1));
    const payload = cartPayload(item, r, selection);
    for (let i = 0; i < n; i++) window.updateCart(payload, 1);
  }

  function findItem(menuItemId, restaurantId) {
    const r = state.restaurants.find(x => x.id === String(restaurantId));
    const item = r?.menu.find(x => x.id === String(menuItemId));
    return item && r ? { item, r } : null;
  }

  const hasOptions = item => Array.isArray(item.customizations) && item.customizations.length > 0;

  /* ---------- Add control (shared by popular + grid) ---------- */
  function addControlInner(item, r) {
    const qty = cartQty(item.id, r.id);
    if (qty > 0) {
      return '<div class="u99-stepper" role="group" aria-label="Quantity in cart">' +
        '<button type="button" class="u99-step-btn" data-cart-dec aria-label="Remove one ' + esc(item.name) + '">' +
        U99Icons.icon('minus', { size: 18 }) + '</button>' +
        '<span class="u99-step-qty" aria-live="polite">' + qty + '</span>' +
        '<button type="button" class="u99-step-btn" data-cart-inc aria-label="Add one ' + esc(item.name) + '">' +
        U99Icons.icon('plus', { size: 18 }) + '</button></div>';
    }
    const label = hasOptions(item) ? 'Customise ' + esc(item.name) : 'Add ' + esc(item.name);
    return '<button type="button" class="u99-add-btn' + (hasOptions(item) ? ' has-options' : '') +
      '" data-cart-add aria-label="' + label + '">' + U99Icons.icon('plus', { size: 23 }) + '</button>';
  }
  function renderAddControl(item, r) {
    return '<div class="u99-add-control" data-mi="' + esc(item.id) + '" data-ri="' + esc(r.id) + '">' +
      addControlInner(item, r) + '</div>';
  }

  /* Click routing for add/inc/dec. A "+" on a customizable item that is not
     yet in the cart opens the customization sheet instead of adding blind. */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-cart-add],[data-cart-inc],[data-cart-dec]');
    if (!btn) return;
    const control = btn.closest('.u99-add-control');
    if (!control) return;
    e.preventDefault(); e.stopPropagation();
    const hit = findItem(control.dataset.mi, control.dataset.ri);
    if (!hit) return;
    const isAdd = btn.hasAttribute('data-cart-add');
    if (isAdd && hasOptions(hit.item)) {
      document.dispatchEvent(new CustomEvent('eatswada99:open-customize',
        { detail: { menuItemId: hit.item.id, restaurantId: hit.r.id } }));
      return;
    }
    cartChange(hit.item, hit.r, btn.hasAttribute('data-cart-dec') ? -1 : 1);
  });

  /* Tapping a product card body/image opens the item detail sheet. */
  document.addEventListener('click', e => {
    if (e.target.closest('.u99-add-control')) return;
    const card = e.target.closest('[data-open-item]');
    if (!card) return;
    const hit = findItem(card.dataset.menuId, card.dataset.restaurantId);
    if (!hit) return;
    document.dispatchEvent(new CustomEvent('eatswada99:open-customize',
      { detail: { menuItemId: hit.item.id, restaurantId: hit.r.id } }));
  });

  function syncAddControls() {
    document.querySelectorAll('.u99-add-control').forEach(c => {
      const hit = findItem(c.dataset.mi, c.dataset.ri);
      if (hit) c.innerHTML = addControlInner(hit.item, hit.r);
    });
  }
  document.addEventListener('eatswada:cart-updated', syncAddControls);

  /* small inline art used by empty/error states (kept in icon system spirit) */
  function iconArt(kind) {
    if (kind === 'error') {
      return '<svg viewBox="0 0 48 48" fill="none" width="48" height="48" aria-hidden="true">' +
        '<circle cx="24" cy="24" r="20" fill="#fff1f7"/>' +
        '<path d="M24 15v11" stroke="#d80b6f" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="24" cy="32" r="1.8" fill="#d80b6f"/></svg>';
    }
    return '';
  }

  window.Eatswada99 = {
    esc, num, deliveryMax, qs, load, loadHero, state,
    renderAddControl, syncAddControls,
    findItem, cartQty, cartChange, addWithOptions, cartPayload, readCart,
    hasOptions, iconArt
  };
})();
