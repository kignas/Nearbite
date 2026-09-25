/* ================================================================
   EATSWADA CART ENGINE & FLOATING CART BAR  (v3 — single owner)
   Handles Math, LocalStorage, and the Floating Cart Bar.

   ONE owner for every page's cart bar:
     • Home  ......... white floating capsule  (restaurant info + "X items",
                       NO price, "All ↑" capsule when 2+ restaurants)
     • 99 Store  ..... solid pink rectangular bar ("X items · ₹TOTAL" | View Cart)
     • Restaurant  ... same solid pink bar as 99 Store
     • Cart/Checkout . hidden

   The cart DATA layer (nearbite_cart, updateCart, validation, image dict,
   multi-restaurant drawer) is UNCHANGED. Only the PRESENTATION changed.
   ================================================================ */

(function () {
  if (window.__esWhiteCartBar) return;
  window.__esWhiteCartBar = true;

  const CURRENCY_SYMBOL = '₹';
  const FALLBACK_IMG =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';

  function getCartBarMode() {
    const path = String(window.location.pathname || '').toLowerCase();
    if (path === '/' || path.endsWith('/index.html') || path.endsWith('/home.html')) return 'home';
    if (path.includes('cart') || path.includes('checkout') || path.includes('payment')) return 'hidden';
    if (path.includes('under99') || path.includes('99store') || path.includes('99-store') || path.includes('deals')) return 'pink';
    if (path.includes('restaurant')) return 'pink';
    return 'home';
  }
  const CART_BAR_MODE = getCartBarMode();

  function safeGetCart() {
    try {
      const data = localStorage.getItem('nearbite_cart');
      if (!data || data === 'undefined' || data === 'null') return {};
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch (e) {
      console.warn('Corrupted cart detected and wiped.');
      localStorage.removeItem('nearbite_cart');
      return {};
    }
  }

  window.updateCart = function(arg1, arg2, price, rId, inStock, menuItemId, image, isVeg, originalPrice) {
    let itemName = arg1;
    let change = arg2;
    let isUnder99Payload = false;
    let originalPayload = null;

    if (arguments.length === 2 && typeof arg1 === 'string' && arg1.includes('%7B')) {
      try {
        isUnder99Payload = true;
        originalPayload = arg1;
        const payload = JSON.parse(decodeURIComponent(arg1));
        itemName = payload.name;
        change = arg2;
        price = payload.price;
        rId = payload.resId;
        menuItemId = payload.menuItem;
        image = payload.image;
        isVeg = payload.isVeg;
        originalPrice = payload.originalPrice || null;
        inStock = true;
      } catch (e) {
        console.error('Payload decode error', e);
        return;
      }
    }

    if (!isUnder99Payload && typeof isRestaurantOpen !== 'undefined' && !isRestaurantOpen) {
      if (typeof notifyItemUnavailable === 'function') notifyItemUnavailable();
      return;
    }

    if (!rId || rId === 'undefined' || rId === 'null') {
      alert('CRITICAL ERROR: Missing Restaurant ID. Please refresh.');
      return;
    }

    if (change > 0 && (!menuItemId || menuItemId === 'undefined' || menuItemId === 'null')) {
      alert('CRITICAL ERROR: Missing Menu Item ID. Please refresh and try again.');
      return;
    }

    let cartMemory = safeGetCart();

    if (!cartMemory[itemName]) {
      cartMemory[itemName] = {
        quantity: 0,
        price: parseFloat(price),
        originalPrice: (Number(originalPrice) > Number(price) ? Number(originalPrice) : null),
        resId: rId,
        menuItem: menuItemId,
        image: image,
        name: itemName,
        isVeg: isVeg,
        restaurantName: (document.getElementById('res-name')?.textContent || '').trim()
      };
    } else {
      if (!cartMemory[itemName].menuItem && menuItemId) cartMemory[itemName].menuItem = menuItemId;
      if (!cartMemory[itemName].image && image) cartMemory[itemName].image = image;
      if (!cartMemory[itemName].name) cartMemory[itemName].name = itemName;
      if (!cartMemory[itemName].restaurantName) {
        const pageRestaurantName = (document.getElementById('res-name')?.textContent || '').trim();
        if (pageRestaurantName) cartMemory[itemName].restaurantName = pageRestaurantName;
      }
      if (!cartMemory[itemName].originalPrice && Number(originalPrice) > Number(price)) cartMemory[itemName].originalPrice = Number(originalPrice);
    }

    cartMemory[itemName].quantity += change;
    if (cartMemory[itemName].quantity <= 0) delete cartMemory[itemName];

    const key = itemName.replace(/\s+/g, '');
    const container = document.getElementById('btn-container-' + key);

    if (container) {
      const qty = cartMemory[itemName] ? cartMemory[itemName].quantity : 0;
      if (isUnder99Payload) {
        if (qty > 0) {
          container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #FC8019;border-radius:8px;width:72px;height:32px;box-sizing:border-box;padding:0 8px;gap:6px;"><button onclick="updateCart('${originalPayload}', -1)" style="border:none;background:transparent;color:#FC8019;font-size:20px;font-weight:700;cursor:pointer;">−</button><span style="font-size:15px;font-weight:700;color:#111827;min-width:12px;text-align:center;">${qty}</span><button onclick="updateCart('${originalPayload}', 1)" style="border:none;background:transparent;color:#FC8019;font-size:20px;font-weight:700;cursor:pointer;">+</button></div>`;
        } else {
          container.innerHTML = `<button onclick="updateCart('${originalPayload}', 1)" style="width:72px;height:32px;background:#fff;border:1px solid #f9ded0;border-radius:8px;color:#FC8019;font-weight:700;cursor:pointer;">Add</button>`;
        }
      } else if (typeof window.makeBtnHTML === 'function') {
        container.innerHTML = window.makeBtnHTML(itemName, qty, price, rId, inStock, menuItemId, image, isVeg, originalPrice);
      }
    }

    localStorage.setItem('nearbite_cart', JSON.stringify(cartMemory));
    try { document.dispatchEvent(new CustomEvent('eatswada:cart-updated', { detail: { source: 'updateCart', itemName: itemName } })); } catch (e) {}
    if (typeof window.updateGlobalCart === 'function') window.updateGlobalCart();
  };

  const CART_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.16L21 8H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="18" r="1.2" fill="currentColor"/><circle cx="17.5" cy="18" r="1.2" fill="currentColor"/></svg>';
  const UP_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const CSS = `
    @keyframes slideUpWhiteCart { 0% { transform: translate(-50%, 150%); opacity: 0; } 100% { transform: translate(-50%, 0); opacity: 1; } }
    @keyframes slideDownWhiteCart { 0% { transform: translate(-50%, 0); opacity: 1; } 100% { transform: translate(-50%, 130%); opacity: 0; } }
    @keyframes wcBump { 0% { transform: scale(1); } 35% { transform: scale(1.12); } 100% { transform: scale(1); } }
    @keyframes wcPinkEnter { 0% { transform: translate(-50%, 130%) scale(.96); opacity:0; } 70% { transform: translate(-50%, -4px) scale(1.015); opacity:1; } 100% { transform: translate(-50%, 0) scale(1); opacity:1; } }
    @keyframes wcPinkPulse { 0% { transform: scale(1); } 38% { transform: scale(1.024); } 72% { transform: scale(.995); } 100% { transform: scale(1); } }
    @keyframes wcPinkTextBump { 0% { transform: translateY(0); opacity:1; } 35% { transform: translateY(-2px); opacity:.86; } 100% { transform: translateY(0); opacity:1; } }
    @keyframes wcShine { 0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; } 15% { opacity: 0.45; } 55% { opacity: 0.45; } 100% { transform: translateX(220%) skewX(-20deg); opacity: 0; } }

    #white-cart-root { position: fixed !important; left: 50% !important; transform: translateX(-50%) !important; bottom: var(--nb-cart-bottom, calc(16px + env(safe-area-inset-bottom, 0px))) !important; width: min(720px, calc(100vw - 24px)); max-width: calc(100vw - 24px); z-index: 100000; display: none; transition: bottom .32s cubic-bezier(.22,1,.36,1); will-change: bottom, transform; }
    #white-cart-root.wc-enter { animation: slideUpWhiteCart 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    #white-cart-root.wc-pink.wc-enter { animation: wcPinkEnter .36s cubic-bezier(.22,1,.36,1) forwards; }
    #white-cart-root.wc-pink.wc-cart-update #es-pink-inner { animation: wcPinkPulse .32s cubic-bezier(.22,1,.36,1); }
    #white-cart-root.wc-pink.wc-cart-update .wc-pink-left, #white-cart-root.wc-pink.wc-cart-update .wc-pink-cta { animation: wcPinkTextBump .28s cubic-bezier(.22,1,.36,1); }
    #white-cart-root.wc-exiting { animation: slideDownWhiteCart 0.26s ease forwards; }

    #white-cart-container { background: rgba(255,255,255,0.88); -webkit-backdrop-filter: blur(20px) saturate(160%); backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(17,24,39,0.06); border-radius: 32px; padding: 8px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 1px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.08), 0 16px 32px -8px rgba(16,24,40,0.16); font-family: 'Manrope', system-ui, -apple-system, sans-serif; height: 62px; box-sizing: border-box; }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { #white-cart-container { background: rgba(255,255,255,0.98); } }
    .wc-left { all: unset; display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; overflow: hidden; cursor: pointer; box-sizing: border-box; }
    .wc-thumb-wrap { position: relative; display: flex; align-items: center; flex-shrink: 0; }
    .wc-image-stack { display: flex; position: relative; height: 36px; min-width: 36px; align-items: center; transition: width 0.3s ease; }
    .wc-img { width: 36px; height: 36px; border-radius: 18px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; position: absolute; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,.12); }
    .wc-img:nth-child(1) { left: 0px; z-index: 3; }
    .wc-img:nth-child(2) { left: 12px; z-index: 2; transform: scale(0.95); opacity: 0.95; }
    .wc-img:nth-child(3) { left: 24px; z-index: 1; transform: scale(0.9); opacity: 0.85; }
    .wc-qty-badge { position: absolute; top: -4px; right: -4px; min-width: 17px; height: 17px; padding: 0 3px; border-radius: 9px; background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%); color: #fff; font-size: 10px; font-weight: 800; line-height: 18px; text-align: center; border: 2px solid #FFFFFF; box-shadow: 0 2px 4px rgba(0,0,0,.18); z-index: 4; }
    .wc-bump { animation: wcBump 0.32s ease; }
    .wc-info { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; justify-content: center; overflow: hidden; }
    .wc-res-name { font-size: 12px; font-weight: 800; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-menu-link { font-size: 10px; font-weight: 700; color: #FF4D4F; margin-top: 1px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-right { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; flex-shrink: 0; }
    #wc-standard-actions { flex: 0 0 auto; }
    .wc-btn { min-width: 86px; }
    .wc-btn { position: relative; overflow: hidden; background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%); border: none; border-radius: 22px; height: 44px; min-height: 40px; padding: 0 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.1s ease; font-family: inherit; }
    .wc-btn:active { transform: scale(0.96); }
    .wc-btn::after { content: ''; position: absolute; top: 0; left: 0; width: 45%; height: 100%; background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%); transform: translateX(-120%) skewX(-20deg); pointer-events: none; }
    #white-cart-root.wc-enter #wc-standard-actions .wc-btn::after { animation: wcShine 1s ease 0.45s 1 both; }
    .wc-btn-title { font-size: 11px; font-weight: 800; line-height: 1.1; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
    .wc-btn-title svg { width: 13px; height: 13px; }
    .wc-btn-sub { font-size: 9px; font-weight: 600; opacity: 0.95; white-space: nowrap; }
    .wc-close { width: 30px; height: 30px; border-radius: 50%; background: #F1F1F1; border: none; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 15px; cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
    .wc-close:active { background: #e5e7eb; }
    #white-cart-root button:focus-visible, #white-cart-root .wc-left:focus-visible { outline: 2px solid #FF4D4F; outline-offset: 2px; }
    #wc-allup { all: unset; position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(100% + 8px); display: none; align-items: center; gap: 5px; background: #ffffff; color: #111827; border: 1px solid rgba(17,24,39,0.08); border-radius: 16px; height: 32px; padding: 0 14px; font-family: 'Manrope', system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 6px 16px rgba(16,24,40,0.16); -webkit-tap-highlight-color: transparent; box-sizing: border-box; z-index: 2; }
    #wc-allup.show { display: inline-flex; }
    #wc-allup:active { transform: translateX(-50%) scale(0.96); }
    #wc-allup svg { width: 12px; height: 12px; }

    #white-cart-root.wc-pink { width: min(720px, calc(100vw - 40px)); max-width: calc(100vw - 40px); }
    #es-pink-inner { all: unset; box-sizing: border-box; width: 100%; height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 18px; background: #EC168C; color: #ffffff; border-radius: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); font-family: 'Manrope', system-ui, -apple-system, sans-serif; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.1s ease; }
    #es-pink-inner:active { transform: scale(0.985); }
    #white-cart-root.wc-pink{padding-bottom:env(safe-area-inset-bottom,0px)}
    #es-pink-inner{will-change:transform}
    .wc-pink-left { font-size: 15px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .wc-pink-cta { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; font-size: 15px; font-weight: 800; color: #ffffff; }
    .wc-pink-cta svg { width: 18px; height: 18px; }

    #ew-cart-drawer-backdrop{position:fixed;inset:0;z-index:100001;display:none;background:rgba(15,23,42,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    #ew-cart-drawer-backdrop.show{display:block}
    #ew-cart-drawer{position:fixed;left:50%;bottom:0;transform:translate(-50%,110%);width:min(720px,100vw);max-height:min(78vh,760px);background:#f7f8fc;border-radius:30px 30px 0 0;z-index:100002;overflow:hidden;transition:transform .28s ease}
    #ew-cart-drawer.show{transform:translate(-50%,0)}
    .ew-cd-head{padding:18px 22px 12px;display:flex;align-items:center;justify-content:space-between}.ew-cd-title{font-size:24px;font-weight:800;color:#101828}.ew-cd-close{border:0;background:transparent;color:#475467;font-size:22px;cursor:pointer}.ew-cd-list{padding:6px 18px 18px;overflow:auto;max-height:calc(min(78vh,760px) - 150px)}.ew-cd-row{background:#fff;border-radius:34px;min-height:104px;margin:0 0 14px;padding:12px 14px;display:flex;align-items:center;gap:14px;box-shadow:0 5px 18px rgba(16,24,40,.07)}.ew-cd-logo{width:76px;height:76px;border-radius:50%;object-fit:cover;background:#f1f3f5;flex:0 0 auto;border:2px solid #fff}.ew-cd-info{min-width:0;flex:1}.ew-cd-name{font-size:20px;line-height:1.2;font-weight:800;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ew-cd-menu{font-size:12px;color:#667085;margin-top:4px}.ew-cd-view{min-width:145px;height:64px;border:0;border-radius:32px;background:#ef5263;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;cursor:pointer}.ew-cd-view strong{font-size:18px}.ew-cd-view span{font-size:10px;opacity:.9}.ew-cd-footer{padding:8px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;background:#f7f8fc}.ew-cd-checkout{min-width:210px;height:56px;padding:0 28px;border:0;border-radius:32px;background:#1a1f2e;color:#fff;font:inherit;font-weight:800;cursor:pointer}.ew-cd-empty{padding:26px 16px 32px;text-align:center;color:#475467;font-weight:600}.@media(max-width:520px){#ew-cart-drawer{border-radius:26px 26px 0 0}.ew-cd-head{padding:16px 18px 10px}.ew-cd-title{font-size:23px}.ew-cd-list{padding:6px 14px 12px}.ew-cd-row{min-height:94px;padding:10px 12px}.ew-cd-logo{width:64px;height:64px}.ew-cd-name{font-size:18px}.ew-cd-view{min-width:120px;height:56px}.ew-cd-checkout{min-width:180px;height:52px}} @media (hover: hover) { .wc-btn:hover { filter: brightness(1.04); } .wc-close:hover { background: #e9e9e9; } #es-pink-inner:hover { filter: brightness(1.03); } } @media (max-width: 360px) { #white-cart-root { width: calc(100vw - 20px); max-width: calc(100vw - 20px); } #white-cart-root.wc-pink { width: calc(100vw - 32px); max-width: calc(100vw - 32px); } #white-cart-container { padding: 7px; height: 58px; } #es-pink-inner { height: 54px; padding: 0 14px; } .wc-pink-left, .wc-pink-cta { font-size: 14px; } .wc-img { width: 34px; height: 34px; } .wc-image-stack { height: 34px; min-width: 34px; } .wc-btn { padding: 0 10px; height: 42px; } .wc-res-name { font-size: 11px; } .wc-menu-link { font-size: 9px; } .wc-close { width: 28px; height: 28px; } } @media (prefers-reduced-motion: reduce) { #white-cart-root, #white-cart-root * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; } }
  `;

  function injectCSS() {
    if (document.getElementById('wc-styles')) return;
    const s = document.createElement('style');
    s.id = 'wc-styles';
    s.innerHTML = CSS;
    document.head.appendChild(s);
  }

  function makeHomeDOM() {
    const wrap = document.createElement('div');
    wrap.id = 'white-cart-root';
    wrap.innerHTML = `
      <button type="button" id="wc-allup" aria-label="View all restaurant carts">All ${UP_SVG}</button>
      <div id="white-cart-container">
        <button type="button" class="wc-left" aria-label="View cart" onclick="window.__ewOpenCartDrawer ? window.__ewOpenCartDrawer() : (window.location.href='cart.html')">
          <div class="wc-thumb-wrap">
            <div class="wc-image-stack" id="wc-dynamic-img-stack"></div>
            <span class="wc-qty-badge" id="wc-qty-badge" aria-hidden="true">0</span>
          </div>
          <div class="wc-info">
            <div class="wc-res-name" id="wc-dynamic-res">EatSwada Order</div>
            <div class="wc-menu-link">Added to cart <i class="fa-solid fa-check" aria-hidden="true" style="font-size:10px;"></i></div>
          </div>
        </button>
        <div class="wc-right">
          <div id="wc-standard-actions" style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="wc-btn" onclick="window.__ewOpenCartDrawer ? window.__ewOpenCartDrawer() : (window.location.href='cart.html')">
              <span class="wc-btn-title">View Cart ${CART_SVG}</span>
              <span class="wc-btn-sub" id="wc-item-count" aria-live="polite">1 item</span>
            </button>
            <button type="button" class="wc-close" id="wc-close-btn" aria-label="Clear cart"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
          <div id="wc-clear-actions" style="display: none; gap: 8px; align-items: center;">
            <button type="button" class="wc-btn" id="wc-confirm-clear" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
              <span class="wc-btn-title">Clear Cart</span>
              <span class="wc-btn-sub">Remove all items</span>
            </button>
            <button type="button" class="wc-close" id="wc-cancel-clear" aria-label="Cancel, keep cart items"><i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i></button>
          </div>
        </div>
      </div>
    `;
    return wrap;
  }

  function makePinkDOM() {
    const wrap = document.createElement('div');
    wrap.id = 'white-cart-root';
    wrap.classList.add('wc-pink');
    wrap.innerHTML = `
      <button type="button" id="es-pink-inner" aria-label="View cart" onclick="window.__ewOpenCartDrawer ? window.__ewOpenCartDrawer() : (window.location.href='cart.html')">
        <span class="wc-pink-left" id="wc-item-count" aria-live="polite">0 items</span>
        <span class="wc-pink-cta">View Cart ${CART_SVG}</span>
      </button>
    `;
    return wrap;
  }

  function makeDOM() {
    return CART_BAR_MODE === 'pink' ? makePinkDOM() : makeHomeDOM();
  }

  function isBottomNav(el) {
    if (!el) return false;
    const cls = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toLowerCase();
    return /nav|tabbar|tab-bar|footer/.test(cls + ' ' + id);
  }

  function removeLegacyCartBars() {
    const LEGACY = [
      '#floating-cart', '#floating-cart-bar', '#floatingCartBar', '#cart-bar', '#cartBar',
      '#global-cart', '#globalCart', '#global-cart-bar', '#mini-cart', '#miniCart',
      '#cart-float', '#cartFloat', '#sticky-cart', '#stickyCart',
      '.floating-cart-bar', '.floating-cart', '.global-cart-bar', '.mini-cart-bar',
      '.sticky-cart-bar', '[data-cart-bar]'
    ];
    LEGACY.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.id === 'white-cart-root' || el.closest('#white-cart-root')) return;
        if (el.id === 'ew-cart-drawer' || el.closest('#ew-cart-drawer-backdrop')) return;
        if (isBottomNav(el)) return;
        el.remove();
      });
    });
  }

  let isDismissed = false;
  let lastTotalQty = null;
  let lastTotalPrice = null;
  let exitTimer = null;
  const EXIT_MS = 260;

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function formatCurrency(n) {
    const rounded = Math.round(n);
    try {
      return CURRENCY_SYMBOL + rounded.toLocaleString('en-IN');
    } catch (e) {
      return CURRENCY_SYMBOL + rounded;
    }
  }

  function bump(el) {
    if (!el || prefersReducedMotion()) return;
    el.classList.remove('wc-bump');
    void el.offsetWidth;
    el.classList.add('wc-bump');
  }

  function showCartBar(root) {
    if (!root) return;
    if (document.body.classList.contains('ewcs-custom-open')) {
      root.style.display = 'none';
      return;
    }
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
    root.classList.remove('wc-exiting');
    if (root.style.display === 'none' || root.style.display === '') {
      root.style.display = 'block';
      root.classList.remove('wc-enter');
      if (!prefersReducedMotion()) {
        void root.offsetWidth;
        root.classList.add('wc-enter');
      }
    }
  }

  function hideCartBar(root) {
    if (!root) return;
    if (root.style.display === 'none' || root.style.display === '') return;
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
    root.classList.remove('wc-enter');
    if (prefersReducedMotion()) {
      root.style.display = 'none';
      root.classList.remove('wc-exiting');
      return;
    }
    root.classList.add('wc-exiting');
    exitTimer = setTimeout(() => {
      root.style.display = 'none';
      root.classList.remove('wc-exiting');
      exitTimer = null;
    }, EXIT_MS);
  }

  const NAV_SELECTORS = [
    '.bottom-nav', '#bottom-nav', '.bottomnav', '#bottomnav', '[data-bottom-nav]',
    '.tab-bar', '.tabbar', '.nav-bottom', '.bottom-navigation', '.es-bottom-nav',
    '.app-bottom-nav', '.mobile-bottom-nav', 'nav.bottom', 'footer.bottom-nav',
    '#nearbite-bottom-tabbar'
  ];

  function findBottomNav() {
    for (const selector of NAV_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' && cs.visibility !== 'hidden') {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.height < 180 && r.bottom >= window.innerHeight - 12) {
          return el;
        }
      }
    }
    return null;
  }

  function positionCartAboveNav(root) {
    root = root || document.getElementById('white-cart-root');
    if (!root) return;

    if (CART_BAR_MODE === 'home') {
      const nav = findBottomNav();
      root.style.bottom = nav ? 'var(--nb-cart-bottom, calc(16px + env(safe-area-inset-bottom, 0px)))' : '104px';
      return;
    }

    const nav = findBottomNav();
    if (nav) {
      const r = nav.getBoundingClientRect();
      const clearance = Math.max(0, window.innerHeight - r.top);
      root.style.setProperty('--nb-cart-bottom', (Math.round(clearance) + 12) + 'px');
    } else {
      root.style.setProperty('--nb-cart-bottom', 'calc(16px + env(safe-area-inset-bottom, 0px))');
    }
  }

  let posRAF = null;
  function schedulePos() {
    if (posRAF) return;
    posRAF = requestAnimationFrame(() => {
      posRAF = null;
      positionCartAboveNav();
    });
  }

  function watchBottomNavigation() {
    if (CART_BAR_MODE !== 'home') return;

    const nav = document.getElementById('nearbite-bottom-tabbar');
    if (!nav) {
      setTimeout(schedulePos, 0);
      setTimeout(schedulePos, 200);
      return;
    }

    const sync = () => schedulePos();
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('scroll', sync, { passive: true });

    const observer = new MutationObserver(() => schedulePos());
    observer.observe(nav, { attributes: true, childList: true, subtree: true });

    setTimeout(sync, 0);
    setTimeout(sync, 120);
    setTimeout(sync, 400);
  }

  function restaurantGroups(savedCart) {
    const groups = new Map();
    Object.entries(savedCart || {}).forEach(([key, item]) => {
      if (!item || Number(item.quantity) <= 0) return;
      const rid = String(item.resId || item.restaurantId || 'unknown');
      if (!groups.has(rid)) groups.set(rid, { id: rid, name: item.restaurantName || item.resName || 'Restaurant', items: [], units: 0, image: item.image || '' });
      const g = groups.get(rid), q = Math.max(0, Number(item.quantity) || 0);
      g.items.push({ key, item }); g.units += q; if (!g.image && item.image) g.image = item.image;
      if ((!g.name || g.name === 'Restaurant') && (item.restaurantName || item.resName)) g.name = item.restaurantName || item.resName;
    });
    return [...groups.values()];
  }

  function escDrawer(v){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function ensureCartDrawer() {
    if (document.getElementById('ew-cart-drawer-backdrop')) return;
    const b = document.createElement('div');
    b.id = 'ew-cart-drawer-backdrop';
    b.innerHTML = '<section id="ew-cart-drawer" role="dialog" aria-modal="true" aria-label="Your carts"><div class="ew-cd-head"><div class="ew-cd-title" id="ew-cd-title">Your Carts</div><button class="ew-cd-close" aria-label="Close cart drawer">✕</button></div><div class="ew-cd-list" id="ew-cd-list"></div><div class="ew-cd-footer"><button class="ew-cd-checkout" id="ew-cd-checkout">Checkout</button></div></section>';
    document.body.appendChild(b);
    const d = b.querySelector('#ew-cart-drawer');
    const close = () => { b.classList.remove('show'); d.classList.remove('show'); document.body.style.overflow = ''; };
    b.addEventListener('click', e => { if (e.target === b) close(); });
    b.querySelector('.ew-cd-close').addEventListener('click', close);
    b.querySelector('#ew-cd-checkout').addEventListener('click', () => window.location.href = 'cart.html');
    window.__ewCloseCartDrawer = close;
  }

  function renderCartDrawer() {
    ensureCartDrawer();
    const list = document.getElementById('ew-cd-list');
    const groups = restaurantGroups(safeGetCart());
    document.getElementById('ew-cd-title').textContent = `Your Carts (${groups.length})`;
    list.innerHTML = groups.length
      ? groups.map(g => {
          const u = Math.round(g.units);
          const img = g.image || FALLBACK_IMG;
          return `<div class="ew-cd-row"><img class="ew-cd-logo" src="${escDrawer(img)}" alt=""><div class="ew-cd-info"><div class="ew-cd-name">${escDrawer(g.name)}</div><div class="ew-cd-menu">${u} item${u === 1 ? '' : 's'}</div></div><button class="ew-cd-view" data-cd-view="${escDrawer(g.id)}"><strong>View</strong><span>restaurant</span></button></div>`;
        }).join('')
      : '<div class="ew-cd-empty">Your cart is empty.</div>';
    list.querySelectorAll('[data-cd-view]').forEach(btn => btn.addEventListener('click', () => window.location.href = 'cart.html'));
  }

  function openRestaurantCarts() {
    ensureCartDrawer(); renderCartDrawer();
    const b = document.getElementById('ew-cart-drawer-backdrop'), d = document.getElementById('ew-cart-drawer');
    if (!b || !d) return;
    b.classList.add('show'); requestAnimationFrame(() => d.classList.add('show')); document.body.style.overflow = 'hidden';
  }

  function openCartDrawer() {
    if (CART_BAR_MODE !== 'pink') { window.location.href = 'cart.html'; return; }
    openRestaurantCarts();
  }

  let lastCartSnapshot = null;

  window.updateGlobalCart = function () {
    if (isDismissed || CART_BAR_MODE === 'hidden') return;

    const savedCart = safeGetCart();
    const snapshot = JSON.stringify(savedCart);
    const root = document.getElementById('white-cart-root');
    if (!root) return;

    if (snapshot === lastCartSnapshot) return;
    lastCartSnapshot = snapshot;

    const itemNames = Object.keys(savedCart);
    const countEl = document.getElementById('wc-item-count');

    const stdActions = document.getElementById('wc-standard-actions');
    const clearActions = document.getElementById('wc-clear-actions');
    if (stdActions && clearActions) { stdActions.style.display = 'flex'; clearActions.style.display = 'none'; }

    if (document.getElementById('ew-cart-drawer-backdrop')?.classList.contains('show')) renderCartDrawer();

    if (itemNames.length === 0) {
      hideCartBar(root);
      lastTotalQty = null;
      lastTotalPrice = null;
      const allup = document.getElementById('wc-allup');
      if (allup) allup.classList.remove('show');
      return;
    }

    let totalQty = 0, totalPrice = 0, priceKnown = true;
    itemNames.forEach(key => {
      const item = savedCart[key] || {};
      const q = Number(item.quantity);
      const safeQty = Number.isFinite(q) ? Math.max(0, q) : 0;
      totalQty += safeQty;
      const p = Number(item.price);
      if (Number.isFinite(p) && p >= 0) totalPrice += p * safeQty; else priceKnown = false;
    });

    const baseCountText = totalQty === 1 ? '1 item' : `${totalQty} items`;
    const showPrice = (CART_BAR_MODE === 'pink') && priceKnown && totalPrice > 0;
    if (countEl) countEl.innerText = showPrice ? `${baseCountText} · ${formatCurrency(totalPrice)}` : baseCountText;

    const totalChanged = lastTotalQty !== null && (lastTotalQty !== totalQty || lastTotalPrice !== totalPrice);
    if (totalChanged) {
      bump(countEl);
      if (CART_BAR_MODE === 'pink') {
        root.classList.remove('wc-cart-update');
        void root.offsetWidth;
        root.classList.add('wc-cart-update');
        setTimeout(() => root.classList.remove('wc-cart-update'), 260);
      }
    }

    if (CART_BAR_MODE !== 'pink') {
      const badgeEl = document.getElementById('wc-qty-badge');
      if (badgeEl) {
        badgeEl.textContent = totalQty > 99 ? '99+' : String(totalQty);
        if (lastTotalQty !== null && lastTotalQty !== totalQty) bump(badgeEl);
      }

      const resEl = document.getElementById('wc-dynamic-res');
      const lastItemName = itemNames[itemNames.length - 1];
      const lastItem = savedCart[lastItemName] || {};
      if (resEl) resEl.innerText = lastItem.resName || lastItem.restaurantName || lastItemName;

      const imgStackEl = document.getElementById('wc-dynamic-img-stack');
      if (imgStackEl) {
        imgStackEl.innerHTML = '';
        const latestThreeNames = itemNames.slice(-3).reverse();
        let imageDict = {};
        try {
          const dictData = localStorage.getItem('es_image_dict');
          if (dictData && dictData !== 'undefined' && dictData !== 'null') imageDict = JSON.parse(dictData);
        } catch (e) {}
        latestThreeNames.forEach((name) => {
          const itemData = savedCart[name] || {};
          const imgSrc = itemData.image || imageDict[name] || FALLBACK_IMG;
          const img = document.createElement('img');
          img.src = imgSrc; img.alt = ''; img.classList.add('wc-img');
          imgStackEl.appendChild(img);
        });
        imgStackEl.style.width = latestThreeNames.length === 1 ? '36px' : latestThreeNames.length === 2 ? '48px' : '60px';
      }

      const allup = document.getElementById('wc-allup');
      if (allup) {
        const groups = restaurantGroups(savedCart);
        allup.classList.toggle('show', groups.length >= 2);
      }
    }

    lastTotalQty = totalQty;
    lastTotalPrice = totalPrice;
    positionCartAboveNav(root);
    showCartBar(root);
  };

  function init() {
    injectCSS();
    removeLegacyCartBars();

    const root = makeDOM();
    if (CART_BAR_MODE === 'hidden') root.style.display = 'none';
    document.body.appendChild(root);
    watchBottomNavigation();

    window.__ewOpenCartDrawer = openCartDrawer;
    window.__ewOpenCartRestaurantCarts = openRestaurantCarts;
    ensureCartDrawer();

    const allup = document.getElementById('wc-allup');
    if (allup) allup.addEventListener('click', (e) => { e.stopPropagation(); openRestaurantCarts(); });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .counter-btn, [onclick*="updateCart"]');
      if (!btn) return;

      let foodName = '';
      const clickCode = btn.getAttribute('onclick');
      if (clickCode) {
        if (clickCode.includes('%7B')) {
          try {
            const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
            if (match) {
              const payload = JSON.parse(decodeURIComponent(match[1]));
              foodName = payload.name;
            }
          } catch (err) {}
        } else {
          const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
          if (match) foodName = match[1];
        }
      }

      let wrapper = btn;
      let capturedImg = '';
      while (wrapper && wrapper !== document.body) {
        const img = wrapper.querySelector('img');
        if (img && img.src && !img.id.includes('wc-dynamic') && !img.src.includes('.svg')) { capturedImg = img.src; break; }
        wrapper = wrapper.parentElement;
      }

      if (foodName && capturedImg) {
        let dict = {};
        try {
          const dictData = localStorage.getItem('es_image_dict');
          if (dictData && dictData !== 'undefined' && dictData !== 'null') dict = JSON.parse(dictData);
        } catch (e) {}
        dict[foodName] = capturedImg;
        localStorage.setItem('es_image_dict', JSON.stringify(dict));
      }
    }, true);

    const wcLeft = document.querySelector('#white-cart-root .wc-left');
    if (wcLeft) {
      wcLeft.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = 'cart.html'; }
      });
    }

    const closeBtn = document.getElementById('wc-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = document.getElementById('wc-standard-actions'); const c = document.getElementById('wc-clear-actions');
      if (s) s.style.display = 'none'; if (c) c.style.display = 'flex';
    });

    const cancelClear = document.getElementById('wc-cancel-clear');
    if (cancelClear) cancelClear.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = document.getElementById('wc-standard-actions'); const c = document.getElementById('wc-clear-actions');
      if (c) c.style.display = 'none'; if (s) s.style.display = 'flex';
    });

    const confirmClear = document.getElementById('wc-confirm-clear');
    if (confirmClear) confirmClear.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.removeItem('nearbite_cart');
      localStorage.removeItem('nearbite_checkout_key');
      try { document.dispatchEvent(new CustomEvent('eatswada:cart-updated', { detail: { source: 'clearCart', cleared: true } })); } catch (e) {}
      isDismissed = false;
      const r = document.getElementById('white-cart-root');
      if (r) { r.classList.remove('wc-enter', 'wc-exiting'); r.style.display = 'none'; }
      lastTotalQty = null;
      lastTotalPrice = null;
    });

    positionCartAboveNav(root);
    window.addEventListener('resize', schedulePos, { passive: true });
    window.addEventListener('orientationchange', schedulePos, { passive: true });
    window.addEventListener('scroll', schedulePos, { passive: true });

    window.updateGlobalCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pageshow', () => {
    isDismissed = false;
    removeLegacyCartBars();
    if (window.updateGlobalCart) window.updateGlobalCart();
    positionCartAboveNav();
  });
})();
