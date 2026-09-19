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

  // Cart-bar presentation is page-specific:
  // Home keeps the original white floating cart; Restaurant + 99 Store share
  // the same Eatswada pink cart bar. Cart/checkout pages do not show it.
  function getCartBarMode() {
    const path = String(window.location.pathname || '').toLowerCase();
    if (path === '/' || path.endsWith('/index.html') || path.endsWith('/home.html')) return 'home';
    if (path.includes('under99')) return 'pink';
    if (path.includes('restaurant')) return 'pink';
    if (path.includes('cart')) return 'hidden';
    return 'home';
  }
  const CART_BAR_MODE = getCartBarMode();

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

    // Multi-restaurant cart: keep items from different restaurants together.
    // The pink cart drawer groups them by restaurant for the user.
    let cartMemory = safeGetCart();

    // Update the Payload
    if (!cartMemory[itemName]) {
        cartMemory[itemName] = {
            quantity: 0, price: parseFloat(price), originalPrice: (Number(originalPrice) > Number(price) ? Number(originalPrice) : null), resId: rId,
            menuItem: menuItemId, image: image, name: itemName, isVeg: isVeg,
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
    /* ================================================================
       CART BAR PRESENTATION
       Home: white floating bar + small "All ↑" capsule above it.
       Restaurant / 99 Store: solid Eatswada-pink full-width cart bar.
       ================================================================ */

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
      35% { transform: scale(1.16); }
      100% { transform: scale(1); }
    }

    #white-cart-root {
      position: fixed;
      left: 50%;
      bottom: var(--nb-cart-bottom, calc(18px + env(safe-area-inset-bottom, 0px)));
      width: min(720px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      z-index: 100000;
      display: none;
      transition: bottom .24s cubic-bezier(.22,1,.36,1);
      will-change: bottom, transform;
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
    }

    #white-cart-root.wc-enter {
      animation: slideUpWhiteCart .32s cubic-bezier(.22,1,.36,1) forwards;
    }
    #white-cart-root.wc-exiting {
      animation: slideDownWhiteCart .24s ease forwards;
    }

    /* ---------- HOME ---------- */
    #white-cart-root.wc-home {
      transform: translateX(-50%);
    }

    #white-cart-root.wc-home #white-cart-container {
      position: relative;
      height: 70px;
      padding: 8px 10px 8px 12px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,.97);
      border: 1px solid rgba(17,24,39,.06);
      border-radius: 36px;
      box-shadow: 0 5px 18px rgba(16,24,40,.12);
    }

    .wc-home-left {
      all: unset;
      min-width: 0;
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      box-sizing: border-box;
    }

    .wc-thumb-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 0 0 auto;
    }

    .wc-image-stack {
      display: flex;
      position: relative;
      height: 44px;
      min-width: 44px;
      align-items: center;
    }

    .wc-img {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
      background: #f3f4f6;
      position: absolute;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,.13);
    }
    .wc-img:nth-child(1) { left: 0; z-index: 3; }
    .wc-img:nth-child(2) { left: 12px; z-index: 2; transform: scale(.94); }
    .wc-img:nth-child(3) { left: 24px; z-index: 1; transform: scale(.88); }

    .wc-qty-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 18px;
      height: 18px;
      padding: 0 3px;
      box-sizing: border-box;
      border-radius: 10px;
      background: #f34f62;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      line-height: 18px;
      text-align: center;
      border: 2px solid #fff;
      z-index: 4;
    }

    .wc-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
      justify-content: center;
    }
    .wc-res-name {
      font-size: 15px;
      line-height: 1.1;
      font-weight: 800;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wc-menu-link {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1;
      font-weight: 700;
      color: #ef5263;
      white-space: nowrap;
    }

    .wc-home-count {
      flex: 0 0 auto;
      color: #1f2937;
      font-size: 15px;
      font-weight: 750;
      white-space: nowrap;
      padding: 0 2px;
    }

    /* The small capsule floats ABOVE the cart, never inside it. */
    .wc-all-capsule {
      position: absolute;
      left: 50%;
      top: -22px;
      transform: translateX(-50%);
      height: 38px;
      min-width: 76px;
      padding: 0 16px;
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      background: #fff;
      color: #6b7280;
      box-shadow: 0 4px 14px rgba(16,24,40,.10);
      font: 800 13px/38px 'Manrope',system-ui,sans-serif;
      cursor: pointer;
      z-index: 5;
      -webkit-tap-highlight-color: transparent;
    }
    .wc-all-capsule:active { transform: translateX(-50%) scale(.97); }

    .wc-right {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
    }

    .wc-btn {
      height: 52px;
      min-width: 142px;
      padding: 0 20px;
      border: 0;
      border-radius: 27px;
      background: #ec168c;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      font: 800 16px/1 'Manrope',system-ui,sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    .wc-btn:active { transform: scale(.97); }
    .wc-cart-icon {
      width: 24px;
      height: 24px;
      display: block;
      flex: 0 0 auto;
    }
    .wc-btn-sub { display:none; }

    /* ---------- RESTAURANT + 99 STORE ---------- */
    #white-cart-root.wc-pink {
      width: min(720px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      transform: translateX(-50%);
      bottom: var(--nb-cart-bottom, calc(14px + env(safe-area-inset-bottom, 0px)));
    }

    #white-cart-root.wc-pink #white-cart-container {
      height: 64px;
      padding: 0 18px 0 24px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 0;
      border-radius: 24px;
      background: #ec168c;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    #white-cart-root.wc-pink .wc-pink-summary {
      color: #fff;
      font-size: 18px;
      font-weight: 800;
      line-height: 1;
      white-space: nowrap;
    }

    #white-cart-root.wc-pink .wc-right {
      margin-left: auto;
    }

    #white-cart-root.wc-pink .wc-btn {
      min-width: 0;
      height: auto;
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: #fff;
      box-shadow: none;
      font-size: 18px;
      gap: 9px;
    }

    #white-cart-root.wc-pink .wc-cart-icon {
      width: 25px;
      height: 25px;
    }

    #white-cart-root.wc-pink .wc-home-left,
    #white-cart-root.wc-pink .wc-all-capsule,
    #white-cart-root.wc-pink .wc-home-count,
    #white-cart-root.wc-pink .wc-qty-badge {
      display: none !important;
    }

    /* Pink mode uses no glow and no inner capsule. */
    @media (max-width: 520px) {
      #white-cart-root,
      #white-cart-root.wc-pink {
        width: calc(100vw - 24px);
        max-width: calc(100vw - 24px);
      }

      #white-cart-root.wc-home #white-cart-container {
        height: 68px;
        border-radius: 34px;
        padding-left: 10px;
      }

      .wc-res-name { font-size: 14px; }
      .wc-menu-link { font-size: 11px; }
      .wc-home-count { font-size: 14px; }

      .wc-btn {
        min-width: 126px;
        height: 50px;
        padding: 0 16px;
        font-size: 15px;
      }

      #white-cart-root.wc-pink #white-cart-container {
        height: 64px;
        padding: 0 18px 0 22px;
        border-radius: 23px;
      }
      #white-cart-root.wc-pink .wc-pink-summary,
      #white-cart-root.wc-pink .wc-btn {
        font-size: 17px;
      }
    }

    @media (max-width: 380px) {
      #white-cart-root.wc-home #white-cart-container {
        gap: 5px;
        padding-right: 7px;
      }
      .wc-home-left { gap: 6px; }
      .wc-image-stack { height: 38px; min-width: 38px; }
      .wc-img { width: 38px; height: 38px; }
      .wc-img:nth-child(2) { left: 10px; }
      .wc-img:nth-child(3) { left: 20px; }
      .wc-home-count { font-size: 12px; }
      .wc-btn { min-width: 112px; padding: 0 12px; font-size: 14px; }
    }

    @media (prefers-reduced-motion: reduce) {
      #white-cart-root, #white-cart-root * {
        animation-duration: .001ms !important;
        transition-duration: .001ms !important;
      }
    }

    /* Multi-restaurant cart drawer — Restaurant + 99 Store */
    #ew-cart-drawer-backdrop{position:fixed;inset:0;z-index:100001;display:none;background:rgba(15,23,42,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    #ew-cart-drawer-backdrop.show{display:block}
    #ew-cart-drawer{position:fixed;left:50%;bottom:0;transform:translate(-50%,110%);width:min(720px,100vw);max-height:min(78vh,760px);background:#f7f8fc;border-radius:30px 30px 0 0;z-index:100002;box-shadow:0 -10px 40px rgba(15,23,42,.2);overflow:hidden;transition:transform .28s cubic-bezier(.22,1,.36,1);font-family:'Manrope',system-ui,-apple-system,sans-serif}
    #ew-cart-drawer.show{transform:translate(-50%,0)}
    .ew-cd-head{padding:18px 22px 12px;display:flex;align-items:center;justify-content:space-between}.ew-cd-title{font-size:24px;font-weight:800;color:#101828}.ew-cd-close{border:0;background:transparent;color:#667085;font-size:30px;width:40px;height:40px;border-radius:50%}
    .ew-cd-list{padding:6px 18px 18px;overflow:auto;max-height:calc(min(78vh,760px) - 150px)}
    .ew-cd-row{background:#fff;border-radius:34px;min-height:104px;margin:0 0 14px;padding:12px 14px;display:flex;align-items:center;gap:14px;box-shadow:0 5px 18px rgba(16,24,40,.07)}
    .ew-cd-logo{width:76px;height:76px;border-radius:50%;object-fit:cover;background:#f1f3f5;flex:0 0 auto;border:2px solid #fff}.ew-cd-info{min-width:0;flex:1}.ew-cd-name{font-size:20px;line-height:1.15;font-weight:800;color:#101828;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ew-cd-menu{margin-top:5px;font-size:17px;line-height:1.1;color:#111827;font-weight:650}.ew-cd-arrow{color:#ec5b6c;margin-left:4px;font-weight:900}
    .ew-cd-view{min-width:145px;height:64px;border:0;border-radius:32px;background:#ef5263;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05;font-weight:800;box-shadow:0 5px 12px rgba(239,82,99,.18)}.ew-cd-view strong{font-size:20px}.ew-cd-view span{margin-top:5px;font-size:14px;font-weight:650;opacity:.92}
    .ew-cd-footer{padding:8px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;background:#f7f8fc}.ew-cd-checkout{min-width:210px;height:56px;padding:0 28px;border-radius:30px;border:1px solid #e5e7eb;background:#fff;color:#d65364;font:inherit;font-size:18px;font-weight:800;box-shadow:0 2px 7px rgba(16,24,40,.08)}.ew-cd-empty{padding:36px 20px 48px;text-align:center;color:#667085;font-weight:700}
    @media(max-width:520px){#ew-cart-drawer{border-radius:26px 26px 0 0}.ew-cd-head{padding:16px 18px 10px}.ew-cd-title{font-size:23px}.ew-cd-list{padding:6px 14px 12px}.ew-cd-row{min-height:94px;padding:10px;gap:10px;border-radius:30px}.ew-cd-logo{width:66px;height:66px}.ew-cd-name{font-size:17px}.ew-cd-menu{font-size:14px}.ew-cd-view{min-width:112px;height:58px;border-radius:29px}.ew-cd-view strong{font-size:17px}.ew-cd-view span{font-size:12px}}
    @media (hover: hover) {
      .wc-btn:hover { filter: brightness(1.04); }
      .wc-close:hover { background: #e9e9e9; }
    }

    @media (max-width: 340px) {
      #white-cart-root, #white-cart-root.wc-pink { width: calc(100vw - 20px); max-width: calc(100vw - 20px); }
      #white-cart-container { padding: 7px; height: 58px; }
      .wc-img { width: 34px; height: 34px; }
      .wc-image-stack { height: 34px; min-width: 34px; }
      .wc-btn { padding: 0 8px; height: 42px; }
      .wc-res-name { font-size: 11px; }
      .wc-menu-link { font-size: 9px; }
      .wc-close { width: 28px; height: 28px; }
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
    wrap.innerHTML = `
      <button type="button" class="wc-all-capsule" id="wc-all-capsule" aria-label="View all restaurant carts">All ↑</button>

      <div id="white-cart-container">
        <button type="button" class="wc-home-left" id="wc-home-left" aria-label="View cart details">
          <div class="wc-thumb-wrap">
            <div class="wc-image-stack" id="wc-dynamic-img-stack"></div>
            <span class="wc-qty-badge" id="wc-qty-badge" aria-hidden="true">0</span>
          </div>
          <div class="wc-info">
            <div class="wc-res-name" id="wc-dynamic-res">EatSwada Order</div>
            <div class="wc-menu-link">Added to cart ✓</div>
          </div>
        </button>

        <div class="wc-home-count" id="wc-home-count" aria-live="polite">0 items · ₹0</div>
        <div class="wc-pink-summary" id="wc-pink-summary" aria-live="polite">0 items · ₹0</div>

        <div class="wc-right">
          <button type="button" class="wc-btn" id="wc-view-cart" aria-label="View Cart">
            <span>View Cart</span>
            <svg class="wc-cart-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3.5 5.5h2l1.7 9.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20.5 9H7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="10" cy="19" r="1.4" fill="currentColor"/>
              <circle cx="18" cy="19" r="1.4" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `;
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


  function restaurantGroups(savedCart){
    const groups=new Map();
    Object.entries(savedCart||{}).forEach(([key,item])=>{
      if(!item||Number(item.quantity)<=0)return;
      const rid=String(item.resId||item.restaurantId||'unknown');
      if(!groups.has(rid))groups.set(rid,{id:rid,name:item.restaurantName||item.resName||'Restaurant',items:[],units:0,image:item.image||''});
      const g=groups.get(rid),q=Math.max(0,Number(item.quantity)||0); g.items.push({key,item}); g.units+=q; if(!g.image&&item.image)g.image=item.image;
      if((!g.name||g.name==='Restaurant')&&(item.restaurantName||item.resName))g.name=item.restaurantName||item.resName;
    }); return [...groups.values()];
  }
  function escDrawer(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function ensureCartDrawer(){
    if(document.getElementById('ew-cart-drawer-backdrop'))return;
    const b=document.createElement('div'); b.id='ew-cart-drawer-backdrop';
    b.innerHTML='<section id="ew-cart-drawer" role="dialog" aria-modal="true" aria-label="Your carts"><div class="ew-cd-head"><div class="ew-cd-title" id="ew-cd-title">Your Carts</div><button class="ew-cd-close" type="button" aria-label="Close">×</button></div><div class="ew-cd-list" id="ew-cd-list"></div><div class="ew-cd-footer"><button class="ew-cd-checkout" type="button" id="ew-cd-checkout">Checkout all <span>›</span></button></div></section>';
    document.body.appendChild(b); const d=b.querySelector('#ew-cart-drawer');
    const close=()=>{b.classList.remove('show');d.classList.remove('show');document.body.style.overflow='';};
    b.addEventListener('click',e=>{if(e.target===b)close()}); b.querySelector('.ew-cd-close').addEventListener('click',close); b.querySelector('#ew-cd-checkout').addEventListener('click',()=>window.location.href='cart.html'); window.__ewCloseCartDrawer=close;
  }
  function renderCartDrawer(){
    ensureCartDrawer(); const b=document.getElementById('ew-cart-drawer-backdrop'),d=document.getElementById('ew-cart-drawer'),list=document.getElementById('ew-cd-list'); const groups=restaurantGroups(safeGetCart());
    document.getElementById('ew-cd-title').textContent=`Your Carts (${groups.length})`;
    list.innerHTML=groups.length?groups.map(g=>{const u=Math.round(g.units),img=g.image||'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=180&q=80';return `<div class="ew-cd-row"><img class="ew-cd-logo" src="${escDrawer(img)}" alt=""><div class="ew-cd-info"><div class="ew-cd-name">${escDrawer(g.name)}</div><div class="ew-cd-menu">View Menu <span class="ew-cd-arrow">›</span></div></div><button class="ew-cd-view" type="button" data-cd-view="${escDrawer(g.id)}"><strong>View Cart</strong><span>${u} ${u===1?'item':'items'}</span></button></div>`}).join(''):'<div class="ew-cd-empty">Your cart is empty.</div>';
    list.querySelectorAll('[data-cd-view]').forEach(btn=>btn.addEventListener('click',()=>window.location.href='cart.html'));
  }
  function openCartDrawer(){ensureCartDrawer();renderCartDrawer();const b=document.getElementById('ew-cart-drawer-backdrop'),d=document.getElementById('ew-cart-drawer');b.classList.add('show');requestAnimationFrame(()=>d.classList.add('show'));document.body.style.overflow='hidden';}

  window.updateGlobalCart = function () {
    if (isDismissed || CART_BAR_MODE === 'hidden') return;

    const savedCart = safeGetCart();
    if (CART_BAR_MODE === 'pink' && document.getElementById('ew-cart-drawer-backdrop')?.classList.contains('show')) {
      renderCartDrawer();
    }

    const itemNames = Object.keys(savedCart);
    const root = document.getElementById('white-cart-root');
    const imgStackEl = document.getElementById('wc-dynamic-img-stack');
    const resEl = document.getElementById('wc-dynamic-res');
    const badgeEl = document.getElementById('wc-qty-badge');
    const homeCountEl = document.getElementById('wc-home-count');
    const pinkSummaryEl = document.getElementById('wc-pink-summary');

    if (!root || !imgStackEl) return;

    if (itemNames.length > 0) {
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
      const countText = (priceKnown && totalPrice > 0)
        ? `${baseCountText} · ${formatCurrency(totalPrice)}`
        : baseCountText;

      if (homeCountEl) homeCountEl.textContent = countText;
      if (pinkSummaryEl) pinkSummaryEl.textContent = countText;
      if (badgeEl) badgeEl.textContent = totalQty > 99 ? '99+' : String(totalQty);

      if (lastTotalQty !== null && lastTotalQty !== totalQty) {
        bump(homeCountEl);
        bump(pinkSummaryEl);
        bump(badgeEl);
      }
      lastTotalQty = totalQty;

      const lastItemName = itemNames[itemNames.length - 1];
      const lastItem = savedCart[lastItemName] || {};
      if (resEl) resEl.innerText = lastItem.resName || lastItem.restaurantName || lastItemName;

      imgStackEl.innerHTML = '';
      const latestThreeNames = itemNames.slice(-3).reverse();
      let imageDict = {};
      try {
        const dictData = localStorage.getItem('es_image_dict');
        if (dictData && dictData !== 'undefined' && dictData !== 'null') imageDict = JSON.parse(dictData);
      } catch(e) {}

      latestThreeNames.forEach((name) => {
        const itemData = savedCart[name] || {};
        const imgSrc = itemData.image || imageDict[name] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = '';
        img.classList.add('wc-img');
        imgStackEl.appendChild(img);
      });

      imgStackEl.style.width = latestThreeNames.length === 1 ? '44px' : latestThreeNames.length === 2 ? '56px' : '68px';

      showCartBar(root);
    } else {
      hideCartBar(root);
      lastTotalQty = null;
    }
  };


  /* ── 5. INITIALIZATION ── */
  function findHomeBottomNav() {
    const selectors = [
      '#bottomNav', '#bottom-nav', '#bottomNavigation', '#bottom-navigation',
      '.bottom-nav', '.bottom-navigation', '.bottom-nav-bar', '.bottom-bar',
      '[class*="bottom-nav"]', '[id*="bottom-nav"]',
      '[class*="bottom-navigation"]', '[id*="bottom-navigation"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el || el.id === 'white-cart-root' || el.closest('#white-cart-root')) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') return el;
    }

    /* Fallback: identify a wide fixed element sitting at the bottom.
       This avoids depending on one specific homepage nav class. */
    const candidates = Array.from(document.body.querySelectorAll('*'));
    let best = null;
    let bestScore = -Infinity;

    for (const el of candidates) {
      if (el.id === 'white-cart-root' || el.closest('#white-cart-root')) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;

      const r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * .65) continue;
      if (r.height < 48 || r.height > 130) continue;
      if (r.bottom < window.innerHeight - 16) continue;

      const z = Number.parseInt(cs.zIndex, 10);
      const score = (Number.isFinite(z) ? z : 0) + (r.width / window.innerWidth) * 100;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  }

  function syncHomeCartPosition() {
    if (CART_BAR_MODE !== 'home') return;

    const nav = findHomeBottomNav();
    if (nav) {
      const r = nav.getBoundingClientRect();
      const gap = 12;
      const bottomPx = Math.max(18, Math.round(window.innerHeight - r.top + gap));
      document.documentElement.style.setProperty('--nb-cart-bottom', `${bottomPx}px`);
    } else {
      document.documentElement.style.setProperty('--nb-cart-bottom', '18px');
    }
  }

  function wireCartActions() {
    const allBtn = document.getElementById('wc-all-capsule');
    const viewBtn = document.getElementById('wc-view-cart');
    const homeLeft = document.getElementById('wc-home-left');

    if (allBtn) {
      allBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCartDrawer();
      });
    }

    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'cart.html';
      });
    }

    if (homeLeft) {
      homeLeft.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'cart.html';
      });
    }
  }

  function init() {
    injectCSS();

    const root = makeDOM();

    if (CART_BAR_MODE === 'hidden') {
      root.style.display = 'none';
    } else if (CART_BAR_MODE === 'pink') {
      root.classList.add('wc-pink');
    } else {
      root.classList.add('wc-home');
    }

    document.body.appendChild(root);

    window.__ewOpenCartDrawer = openCartDrawer;
    if (CART_BAR_MODE === 'pink') ensureCartDrawer();

    wireCartActions();

    /* Preserve the existing image-capture behavior used by the cart engine. */
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .counter-btn, [onclick*="updateCart"]');
      if (!btn) return;

      let foodName = "";
      const clickCode = btn.getAttribute('onclick');

      if (clickCode) {
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
          capturedImg = img.src;
          break;
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

    if (CART_BAR_MODE === 'home') {
      syncHomeCartPosition();
      window.addEventListener('resize', syncHomeCartPosition, {passive:true});
      window.addEventListener('orientationchange', syncHomeCartPosition, {passive:true});

      if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => syncHomeCartPosition());
        const nav = findHomeBottomNav();
        if (nav) observer.observe(nav);
      }
    }

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
