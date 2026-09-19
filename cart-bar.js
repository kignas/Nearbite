/* ================================================================
   PRODUCTION CART ENGINE & MULTI-IMAGE UI  (v2 — polished floating bar)
   Handles Math, LocalStorage, and the Floating Cart Bar
   ================================================================ */

(function () {
  if (window.__esWhiteCartBar) return;
  window.__esWhiteCartBar = true;

  // Display-only setting: change this one line if the storefront's
  // currency symbol is ever not ₹ (Indian Rupee). Nothing else in this
  // file needs to change.
  const CURRENCY_SYMBOL = '₹';
  const IS_99_PAGE = /(^|\/)under99(?:\.html)?$/i.test(window.location.pathname);

  // 🛡️ CRASH-PROOF STORAGE PARSER
  // This prevents your cart bar from becoming invisible if corrupted data exists
  function safeGetCart() {
    try {
        const data = localStorage.getItem('nearbite_cart');
        if (!data || data === "undefined" || data === "null") return {};
        const parsed = JSON.parse(data);
        // Guard against old/corrupted data that parses successfully but
        // isn't a plain object (e.g. an array, a number, a bare string).
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed;
    } catch (e) {
        console.warn("Corrupted cart detected and wiped.");
        localStorage.removeItem('nearbite_cart');
        return {};
    }
  }

  /* ── 1. THE MATH ENGINE (Unified Master Version) ── */
  window.updateCart = function(arg1, arg2, price, rId, inStock, menuItemId, image, isVeg, originalPrice) {
    let itemName = arg1;
    let change = arg2;
    let isUnder99Payload = false;
    let originalPayload = null;

    // 🎯 DETECT WHICH PAGE WE ARE ON (Under99 vs Restaurant)
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
        } catch(e) {
            console.error("Payload decode error", e);
            return;
        }
    }

    // Safe Availability Check
    if (!isUnder99Payload && typeof isRestaurantOpen !== 'undefined' && !isRestaurantOpen) {
        if (typeof notifyItemUnavailable === 'function') notifyItemUnavailable();
        return;
    }

    // Strict Backend Validation
    if (!rId || rId === 'undefined' || rId === 'null') {
        alert("CRITICAL ERROR: Missing Restaurant ID. Please refresh.");
        return;
    }

    // 🛡️ Same protection for the menu item id — the backend rejects any cart
    // item that isn't a real Menu _id, so catch it here instead of letting a
    // half-built cart entry reach checkout.
    if (change > 0 && (!menuItemId || menuItemId === 'undefined' || menuItemId === 'null')) {
        alert("CRITICAL ERROR: Missing Menu Item ID. Please refresh and try again.");
        return;
    }

    // Phase 3.5A — multi-restaurant carts are supported.
    // The backend resolves each Menu.restaurantId authoritatively at checkout,
    // so the frontend must never block a second restaurant from being added.
    let cartMemory = safeGetCart();
    let restaurantName = '';
    try {
        if (typeof currentRestaurant !== 'undefined' && currentRestaurant && currentRestaurant.name) {
            restaurantName = String(currentRestaurant.name);
        }
    } catch (_) {}
    if (!restaurantName) {
        const headerName = document.getElementById('res-name');
        if (headerName && headerName.textContent && headerName.textContent.trim() && headerName.textContent.trim() !== 'Loading…') {
            restaurantName = headerName.textContent.trim();
        }
    }

    // Update the Payload
    if (!cartMemory[itemName]) {
        cartMemory[itemName] = {
            quantity: 0, price: parseFloat(price), originalPrice: (Number(originalPrice) > Number(price) ? Number(originalPrice) : null), resId: rId,
            menuItem: menuItemId, image: image, name: itemName, isVeg: isVeg, restaurantName: restaurantName
        };
    } else {
        if (!cartMemory[itemName].menuItem && menuItemId) cartMemory[itemName].menuItem = menuItemId;
        if (!cartMemory[itemName].image && image) cartMemory[itemName].image = image;
        if (!cartMemory[itemName].name) cartMemory[itemName].name = itemName;
        if (!cartMemory[itemName].restaurantName && restaurantName) cartMemory[itemName].restaurantName = restaurantName;
        if (!cartMemory[itemName].originalPrice && Number(originalPrice) > Number(price)) cartMemory[itemName].originalPrice = Number(originalPrice);
    }
    
    cartMemory[itemName].quantity += change;
    if (cartMemory[itemName].quantity <= 0) delete cartMemory[itemName];

    // 🎯 VISUALLY UPDATE THE CORRECT BUTTON TYPE
    const key = itemName.replace(/\s+/g, '');
    const container = document.getElementById('btn-container-' + key);
    
    if (container) {
        const qty = cartMemory[itemName] ? cartMemory[itemName].quantity : 0;
        
        if (isUnder99Payload) {
            if (qty > 0) {
                container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #FC8019;border-radius:8px;width:72px;height:32px;overflow:hidden;box-shadow:0 2px 6px rgba(252,128,25,0.15);"><button onclick="updateCart('${originalPayload}', -1)" style="width:24px;height:100%;border:none;background:transparent;color:#FC8019;font-weight:800;font-size:16px;cursor:pointer;">−</button><span style="font-size:13px;font-weight:800;color:#FC8019;">${qty}</span><button onclick="updateCart('${originalPayload}', 1)" style="width:24px;height:100%;border:none;background:transparent;color:#FC8019;font-weight:800;font-size:14px;cursor:pointer;">+</button></div>`;
            } else {
                container.innerHTML = `<button onclick="updateCart('${originalPayload}', 1)" style="width:72px;height:32px;background:#fff;border:1px solid #f9ded0;border-radius:8px;color:#FC8019;font-weight:800;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.05);cursor:pointer;">ADD</button>`;
            }
        } else if (typeof window.makeBtnHTML === 'function') {
            container.innerHTML = window.makeBtnHTML(itemName, qty, price, rId, inStock, menuItemId, image, isVeg, originalPrice);
        }
    }
    
    // Save and Trigger Floating Cart Bar
    localStorage.setItem('nearbite_cart', JSON.stringify(cartMemory));
    if (typeof window.updateGlobalCart === 'function') window.updateGlobalCart();
  };

  /* ── 2. THE CSS ── */
  const CSS = `
    /* Font is inherited from the global Eatswada typography system (Manrope). */

    @keyframes slideUpWhiteCart {
      0% { transform: translate(-50%, 150%); opacity: 0; }
      100% { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideDownWhiteCart {
      0% { transform: translate(-50%, 0); opacity: 1; }
      100% { transform: translate(-50%, 130%); opacity: 0; }
    }
    @keyframes wcBump {
      0% { transform: scale(1); }
      35% { transform: scale(1.22); }
      100% { transform: scale(1); }
    }
    @keyframes wcShine {
      0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
      15% { opacity: 0.45; }
      55% { opacity: 0.45; }
      100% { transform: translateX(220%) skewX(-20deg); opacity: 0; }
    }

    #white-cart-root {
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: var(--nb-cart-bottom, calc(20px + env(safe-area-inset-bottom, 0px)));
      width: min(250px, calc(100vw - 32px)); max-width: calc(100vw - 32px);
      z-index: 100000; display: none;
      transition: bottom .32s cubic-bezier(.22,1,.36,1);
      will-change: bottom, transform;
    }
    #white-cart-root.wc-enter {
      animation: slideUpWhiteCart 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    #white-cart-root.wc-exiting {
      animation: slideDownWhiteCart 0.26s ease forwards;
    }
    #white-cart-container {
      background: rgba(255,255,255,0.88);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(17,24,39,0.06);
      border-radius: 32px; padding: 8px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 1px 1px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.08), 0 16px 32px -8px rgba(16,24,40,0.16);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif; height: 62px;
      box-sizing: border-box;
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      #white-cart-container { background: rgba(255,255,255,0.98); }
    }

    .wc-left {
      all: unset;
      display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0;
      cursor: pointer; box-sizing: border-box;
    }
    .wc-thumb-wrap { position: relative; display: flex; align-items: center; flex-shrink: 0; }
    .wc-image-stack { display: flex; position: relative; height: 36px; min-width: 36px; align-items: center; transition: width 0.3s ease; }
    .wc-img { width: 36px; height: 36px; border-radius: 18px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; position: absolute; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: all 0.3s ease; }
    .wc-img:nth-child(1) { left: 0px; z-index: 3; }
    .wc-img:nth-child(2) { left: 12px; z-index: 2; transform: scale(0.95); opacity: 0.95; }
    .wc-img:nth-child(3) { left: 24px; z-index: 1; transform: scale(0.9); opacity: 0.85; }
    .wc-qty-badge {
      position: absolute; top: -4px; right: -4px; min-width: 17px; height: 17px;
      padding: 0 3px; border-radius: 9px;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      color: #fff; font-size: 10px; font-weight: 800; line-height: 18px; text-align: center;
      border: 2px solid #FFFFFF; box-shadow: 0 2px 4px rgba(0,0,0,0.18); z-index: 4;
    }
    .wc-bump { animation: wcBump 0.32s ease; }

    .wc-info { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; justify-content: center; }
    .wc-res-name { font-size: 12px; font-weight: 800; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-menu-link { font-size: 10px; font-weight: 700; color: #FF4D4F; margin-top: 1px; display: flex; align-items: center; gap: 4px; }

    .wc-right { display: flex; align-items: center; gap: 5px; flex: 0 0 auto; flex-shrink: 0; }
    .wc-btn {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      border: none; border-radius: 22px; height: 44px; min-height: 40px; padding: 0 10px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #ffffff; cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s ease; font-family: inherit;
    }
    .wc-btn:active { transform: scale(0.96); }
    .wc-btn::after {
      content: ''; position: absolute; top: 0; left: 0; width: 45%; height: 100%;
      background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
      transform: translateX(-120%) skewX(-20deg); pointer-events: none;
    }
    #white-cart-root.wc-enter #wc-standard-actions .wc-btn::after {
      animation: wcShine 1s ease 0.45s 1 both;
    }
    .wc-btn-title { font-size: 11px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
    .wc-btn-sub { font-size: 9px; font-weight: 600; opacity: 0.95; white-space: nowrap; }
    .wc-close {
      width: 30px; height: 30px; border-radius: 50%; background: #F1F1F1; border: none;
      display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 15px;
      cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent;
    }
    .wc-close:active { background: #e5e7eb; }

    #white-cart-root button:focus-visible,
    #white-cart-root .wc-left:focus-visible {
      outline: 2px solid #FF4D4F; outline-offset: 2px;
    }

    @media (hover: hover) {
      .wc-btn:hover { filter: brightness(1.04); }
      .wc-close:hover { background: #e9e9e9; }
    }

    @media (max-width: 340px) {
      #white-cart-root { width: calc(100vw - 24px); }
      #white-cart-container { padding: 7px; height: 58px; }
      .wc-img { width: 34px; height: 34px; }
      .wc-image-stack { height: 34px; min-width: 34px; }
      .wc-btn { padding: 0 8px; height: 42px; }
      .wc-res-name { font-size: 11px; }
      .wc-menu-link { font-size: 9px; }
      .wc-close { width: 28px; height: 28px; }
    }

    /* ============================================================
       99 STORE CART BAR — COMPACT BOTTOM ACTION
       99 Store only. Global restaurant/cart bar remains unchanged.
       ============================================================ */
    #white-cart-root.u99-cart-bar {
      left: 12px;
      right: 12px;
      width: auto;
      max-width: none;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      transform: none;
    }
    #white-cart-root.u99-cart-bar.wc-enter {
      animation: u99CartIn .28s cubic-bezier(.22,1,.36,1) forwards;
    }
    #white-cart-root.u99-cart-bar.wc-exiting {
      animation: u99CartOut .20s ease forwards;
    }
    @keyframes u99CartIn {
      from { transform: translateY(22px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes u99CartOut {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(22px); opacity: 0; }
    }
    #white-cart-root.u99-cart-bar #white-cart-container {
      height: 60px;
      padding: 0 14px 0 16px;
      border: 0;
      border-radius: 17px;
      background: #EC168C;
      box-shadow: none;
      color: #fff;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    #white-cart-root.u99-cart-bar .wc-left,
    #white-cart-root.u99-cart-bar .wc-thumb-wrap,
    #white-cart-root.u99-cart-bar .wc-info,
    #white-cart-root.u99-cart-bar .wc-close,
    #white-cart-root.u99-cart-bar #wc-clear-actions {
      display: none !important;
    }
    #white-cart-root.u99-cart-bar .wc-right {
      width: 100%;
      display: flex;
      align-items: center;
    }
    #white-cart-root.u99-cart-bar #wc-standard-actions {
      width: 100%;
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    #white-cart-root.u99-cart-bar .wc-cart-total {
      order: 1;
      position: static;
      transform: none;
      color: #fff;
      font-size: 16px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
      margin: 0;
      letter-spacing: -.1px;
    }
    #white-cart-root.u99-cart-bar .wc-btn {
      order: 2;
      height: auto;
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: #fff;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      gap: 9px;
      font-family: inherit;
    }
    #white-cart-root.u99-cart-bar .wc-btn::after { display: none; }
    #white-cart-root.u99-cart-bar .wc-btn-title {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      color: #fff;
      font-size: 16px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
    }
    #white-cart-root.u99-cart-bar .wc-btn-title span[aria-hidden="true"] {
      display: none;
    }
    #white-cart-root.u99-cart-bar .u99-cart-icon {
      width: 21px;
      height: 21px;
      flex: 0 0 21px;
    }
    #white-cart-root.u99-cart-bar .wc-btn-sub {
      display: none;
    }
    #white-cart-root.u99-cart-bar #white-cart-container button:focus-visible {
      outline: 2px solid rgba(255,255,255,.95);
      outline-offset: 3px;
    }
    @media (max-width: 380px) {
      #white-cart-root.u99-cart-bar {
        left: 10px;
        right: 10px;
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
      }
      #white-cart-root.u99-cart-bar #white-cart-container {
        height: 58px;
        padding-left: 15px;
        padding-right: 13px;
        border-radius: 16px;
      }
      #white-cart-root.u99-cart-bar .wc-cart-total,
      #white-cart-root.u99-cart-bar .wc-btn-title { font-size: 15px; }
      #white-cart-root.u99-cart-bar .u99-cart-icon { width: 20px; height: 20px; flex-basis: 20px; }
    }

    /* ============================================================
       MULTI-RESTAURANT CART HUB
       Opens only when the cart contains items from 2+ restaurants.
       Neutral shadow only — no colored glow.
       ============================================================ */
    #es-cart-hub-backdrop {
      position: fixed; inset: 0; z-index: 100010;
      background: rgba(16,24,40,.28);
      display: none; align-items: flex-end; justify-content: center;
      padding: 0 10px calc(10px + env(safe-area-inset-bottom,0px));
      box-sizing: border-box;
    }
    #es-cart-hub-backdrop.show { display: flex; }
    #es-cart-hub {
      width: min(100%, 560px); max-height: min(78vh, 680px);
      overflow: auto; background: #F7F8FC; color: #101828;
      border-radius: 28px 28px 20px 20px;
      border: 1px solid #E7EAF0;
      box-shadow: 0 18px 42px rgba(16,24,40,.18);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      padding: 18px 14px 14px; box-sizing: border-box;
    }
    .es-hub-head {
      display:flex; align-items:center; justify-content:space-between;
      gap:12px; padding:2px 4px 14px;
    }
    .es-hub-title { font-size:22px; font-weight:800; letter-spacing:-.4px; }
    .es-hub-close {
      width:38px; height:38px; border:0; border-radius:50%;
      background:#EEF1F5; color:#667085; display:grid; place-items:center;
      font-size:22px; cursor:pointer;
    }
    .es-hub-card {
      display:flex; align-items:center; gap:12px; background:#fff;
      border:1px solid #E8EAF0; border-radius:22px; padding:12px;
      margin-bottom:10px; box-shadow:0 4px 12px rgba(16,24,40,.05);
    }
    .es-hub-thumb {
      width:58px; height:58px; border-radius:18px; object-fit:cover;
      background:#EEF1F5; flex:0 0 58px;
    }
    .es-hub-main { min-width:0; flex:1; }
    .es-hub-name { font-size:15px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .es-hub-meta { margin-top:4px; color:#747B87; font-size:12px; font-weight:650; line-height:1.35; }
    .es-hub-total { margin-top:3px; font-size:13px; font-weight:800; color:#101828; }
    .es-hub-view {
      flex:0 0 auto; border:0; border-radius:14px; padding:10px 12px;
      background:#FDEAF5; color:#D9096E; font:800 12px/1 'Manrope',system-ui,sans-serif;
      cursor:pointer; white-space:nowrap;
    }
    .es-hub-checkout {
      width:100%; height:52px; border:0; border-radius:16px;
      background:#EC168C; color:#fff; font:800 15px/1 'Manrope',system-ui,sans-serif;
      cursor:pointer; margin-top:4px;
    }
    .es-hub-note { text-align:center; color:#8A93A0; font-size:11px; font-weight:650; padding:2px 8px 10px; }
    @media(max-width:380px){
      #es-cart-hub-backdrop { padding-left:8px; padding-right:8px; }
      #es-cart-hub { border-radius:24px 24px 16px 16px; padding:15px 10px 10px; }
      .es-hub-title { font-size:20px; }
      .es-hub-card { padding:10px; gap:10px; }
      .es-hub-thumb { width:52px; height:52px; flex-basis:52px; border-radius:16px; }
      .es-hub-view { padding:9px 10px; }
    }

    @media (prefers-reduced-motion: reduce) {
      #white-cart-root, #white-cart-root * {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;

  function injectCSS() {
    if (document.getElementById('wc-styles')) return;
    const s = document.createElement('style');
    s.id = 'wc-styles';
    s.innerHTML = CSS;
    document.head.appendChild(s);
  }

  /* ── 3. THE DOM ── */
  function makeDOM() {
    const wrap = document.createElement('div');
    wrap.id = 'white-cart-root';
    if (IS_99_PAGE) wrap.classList.add('u99-cart-bar');
    wrap.innerHTML = `
      <div id="white-cart-container">
        <button type="button" class="wc-left" aria-label="View cart" onclick="window.__esHandleCartClick()">
          <div class="wc-thumb-wrap">
            <div class="wc-image-stack" id="wc-dynamic-img-stack"></div>
            <span class="wc-qty-badge" id="wc-qty-badge" aria-hidden="true">0</span>
          </div>
          <div class="wc-info">
            <div class="wc-res-name" id="wc-dynamic-res">EatSwada Order</div>
            <div class="wc-menu-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Added to cart</div>
          </div>
        </button>
        <div class="wc-right">
          <div id="wc-standard-actions" style="display: flex; gap: 8px; align-items: center;">
            <span id="wc-item-count" class="wc-cart-total" aria-live="polite">1 item · ₹0</span>
            <button type="button" class="wc-btn" onclick="window.__esHandleCartClick()">
              <span class="wc-btn-title">View Cart <svg class="u99-cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"></circle><circle cx="19" cy="20" r="1.5"></circle><path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L21 8H7"></path></svg></span>
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

    const hub = document.createElement('div');
    hub.id = 'es-cart-hub-backdrop';
    hub.innerHTML = `
      <section id="es-cart-hub" role="dialog" aria-modal="true" aria-labelledby="es-cart-hub-title">
        <div class="es-hub-head">
          <div id="es-cart-hub-title" class="es-hub-title">Your Carts</div>
          <button type="button" class="es-hub-close" id="es-hub-close" aria-label="Close carts">×</button>
        </div>
        <div id="es-hub-list"></div>
        <div class="es-hub-note">Items from different restaurants stay in the same cart.</div>
        <button type="button" class="es-hub-checkout" id="es-hub-checkout">Checkout all →</button>
      </section>
    `;
    document.body.appendChild(hub);
    return wrap;
  }

  /* ── 4. UI BEHAVIOR LOGIC ── */
  let isDismissed = false;
  let lastTotalQty = null;
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
    void el.offsetWidth; // force reflow so the animation can replay
    el.classList.add('wc-bump');
  }

  function showCartBar(root) {
    if (!root) return;
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
    root.classList.remove('wc-exiting');
    if (root.style.display === 'none' || root.style.display === '') {
      root.style.display = 'block';
      root.classList.remove('wc-enter');
      if (!prefersReducedMotion()) {
        void root.offsetWidth; // force reflow so the enter animation replays
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

  function cartGroups(cart) {
    const groups = new Map();
    Object.entries(cart || {}).forEach(([key, item]) => {
      const q = Number(item?.quantity || 0);
      if (!Number.isFinite(q) || q <= 0) return;
      const rid = String(item?.resId || item?.restaurantId || 'unknown');
      if (!groups.has(rid)) groups.set(rid, { id: rid, name: item?.restaurantName || item?.resName || 'Restaurant', qty: 0, subtotal: 0, items: [], image: item?.image || '' });
      const g = groups.get(rid);
      g.qty += q;
      g.subtotal += Number(item?.price || 0) * q;
      if (g.items.length < 3) g.items.push(item?.name || key);
      if (!g.image && item?.image) g.image = item.image;
    });
    return [...groups.values()];
  }

  function openCartHub() {
    const cart = safeGetCart();
    const groups = cartGroups(cart);
    const backdrop = document.getElementById('es-cart-hub-backdrop');
    const list = document.getElementById('es-cart-hub-list');
    const title = document.getElementById('es-cart-hub-title');
    if (!backdrop || !list) return;
    if (groups.length < 2) { window.location.href = 'cart.html'; return; }

    title.textContent = `Your Carts (${groups.length})`;
    list.innerHTML = groups.map((g, i) => {
      const items = g.items.join(', ') + (g.qty > g.items.length ? '…' : '');
      const img = g.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80';
      return `<div class="es-hub-card">
        <img class="es-hub-thumb" src="${img.replace(/"/g,'&quot;')}" alt="">
        <div class="es-hub-main">
          <div class="es-hub-name">${String(g.name).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}</div>
          <div class="es-hub-meta">${g.qty} ${g.qty === 1 ? 'item' : 'items'} · ${items.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}</div>
          <div class="es-hub-total">₹${Math.round(g.subtotal).toLocaleString('en-IN')}</div>
        </div>
        <button type="button" class="es-hub-view" data-hub-view="${i}">View Cart</button>
      </div>`;
    }).join('');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeCartHub() {
    const backdrop = document.getElementById('es-cart-hub-backdrop');
    if (backdrop) backdrop.classList.remove('show');
    document.body.style.overflow = '';
  }

  window.__esHandleCartClick = openCartHub;
  window.__esOpenCartHub = openCartHub;

  window.updateGlobalCart = function () {
    if (isDismissed) return;

    const savedCart = safeGetCart();
    const itemNames = Object.keys(savedCart);
    const root = document.getElementById('white-cart-root');
    const countEl = document.getElementById('wc-item-count');
    const imgStackEl = document.getElementById('wc-dynamic-img-stack');
    const resEl = document.getElementById('wc-dynamic-res');
    const badgeEl = document.getElementById('wc-qty-badge');

    if (!root || !countEl || !imgStackEl) return;

    const stdActions = document.getElementById('wc-standard-actions');
    const clearActions = document.getElementById('wc-clear-actions');
    if (stdActions && clearActions) {
        stdActions.style.display = 'flex';
        clearActions.style.display = 'none';
    }

    if (itemNames.length > 0) {
      // Totals — cast defensively in case old/malformed cart entries are
      // missing quantity or price fields.
      let totalQty = 0;
      let totalPrice = 0;
      let priceKnown = true;
      itemNames.forEach(key => {
        const item = savedCart[key] || {};
        const q = Number(item.quantity);
        const safeQty = Number.isFinite(q) ? Math.max(0, q) : 0;
        totalQty += safeQty;

        const p = Number(item.price);
        if (Number.isFinite(p) && p >= 0) {
          totalPrice += p * safeQty;
        } else {
          priceKnown = false;
        }
      });

      const baseCountText = totalQty === 1 ? '1 item' : `${totalQty} items`;
      countEl.innerText = (priceKnown && totalPrice > 0)
        ? `${baseCountText} · ${formatCurrency(totalPrice)}`
        : baseCountText;

      if (badgeEl) badgeEl.textContent = totalQty > 99 ? '99+' : String(totalQty);

      if (lastTotalQty !== null && lastTotalQty !== totalQty) {
        bump(countEl);
        bump(badgeEl);
      }
      lastTotalQty = totalQty;

      // Restaurant / item label. The cart data only ever stores a resId
      // (not a friendly restaurant name), so this preserves the original
      // behavior of showing the most recently added item — while checking
      // for an optional resName/restaurantName field first, in case a
      // future update to the cart payload starts including one.
      const lastItemName = itemNames[itemNames.length - 1];
      const lastItem = savedCart[lastItemName] || {};
      if (resEl) resEl.innerText = lastItem.resName || lastItem.restaurantName || lastItemName;

      // Safe image parsing
      imgStackEl.innerHTML = ''; 
      const latestThreeNames = itemNames.slice(-3).reverse(); 
      let imageDict = {};
      try {
          const dictData = localStorage.getItem('es_image_dict');
          if (dictData && dictData !== "undefined" && dictData !== "null") {
              imageDict = JSON.parse(dictData);
          }
      } catch(e) {}

      latestThreeNames.forEach((name) => {
         const imgSrc = imageDict[name] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
         const img = document.createElement('img');
         img.src = imgSrc;
         img.alt = '';
         img.classList.add('wc-img');
         imgStackEl.appendChild(img);
      });

      imgStackEl.style.width = latestThreeNames.length === 1 ? '36px' : latestThreeNames.length === 2 ? '48px' : '60px';

      showCartBar(root);
    } else {
      hideCartBar(root);
      lastTotalQty = null;
    }
  };

  /* ── 5. INITIALIZATION ── */
  function init() {
    injectCSS();
    document.body.appendChild(makeDOM());

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .counter-btn, [onclick*="updateCart"]');
      if (!btn) return;
      
      let foodName = "";
      const clickCode = btn.getAttribute('onclick');
      if (clickCode) {
        // Handle encoded payloads for images
        if (clickCode.includes('%7B')) {
            try {
                const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
                if (match) {
                    const payload = JSON.parse(decodeURIComponent(match[1]));
                    foodName = payload.name;
                }
            } catch(err) {}
        } else {
            const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
            if (match) foodName = match[1];
        }
      }

      let wrapper = btn;
      let capturedImg = "";
      while (wrapper && wrapper !== document.body) {
        const img = wrapper.querySelector('img');
        if (img && img.src && !img.id.includes('wc-dynamic') && !img.src.includes('.svg')) {
           capturedImg = img.src; break; 
        }
        wrapper = wrapper.parentElement;
      }

      if (foodName && capturedImg) {
        let dict = {};
        try {
            const dictData = localStorage.getItem('es_image_dict');
            if (dictData && dictData !== "undefined" && dictData !== "null") {
                dict = JSON.parse(dictData);
            }
        } catch(e) {}
        dict[foodName] = capturedImg;
        localStorage.setItem('es_image_dict', JSON.stringify(dict));
      }
    }, true); 

    const wcLeft = document.querySelector('#white-cart-root .wc-left');
    if (wcLeft) {
      wcLeft.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = 'cart.html';
        }
      });
    }

    document.getElementById('wc-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('wc-standard-actions').style.display = 'none';
      document.getElementById('wc-clear-actions').style.display = 'flex';
    });

    document.getElementById('wc-cancel-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('wc-clear-actions').style.display = 'none';
      document.getElementById('wc-standard-actions').style.display = 'flex';
    });

    document.getElementById('wc-confirm-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.removeItem('nearbite_cart'); 
      document.getElementById('white-cart-root').style.display = 'none'; 
      window.location.reload(); 
    });

    const hubBackdrop = document.getElementById('es-cart-hub-backdrop');
    const hubClose = document.getElementById('es-hub-close');
    const hubCheckout = document.getElementById('es-hub-checkout');
    hubClose?.addEventListener('click', closeCartHub);
    hubCheckout?.addEventListener('click', () => { window.location.href = 'cart.html'; });
    hubBackdrop?.addEventListener('click', (e) => {
      if (e.target === hubBackdrop) closeCartHub();
      const view = e.target.closest('[data-hub-view]');
      if (view) { closeCartHub(); window.location.href = 'cart.html'; }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCartHub();
    });

    window.updateGlobalCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pageshow', () => {
    isDismissed = false; 
    if (window.updateGlobalCart) window.updateGlobalCart();
  });

})();
