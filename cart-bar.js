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
  window.updateCart = function(arg1, arg2, price, rId, inStock, menuItemId, image, isVeg) {
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

    // Cross-Restaurant Protection
    let cartMemory = safeGetCart();
    const existingItems = Object.keys(cartMemory);
    
    if (existingItems.length > 0) {
        const firstItemResId = cartMemory[existingItems[0]].resId;
        if (firstItemResId && firstItemResId !== rId && change > 0) {
            alert("You can only order from one restaurant at a time. Please clear your cart to start a new order.");
            return;
        }
    }

    // Update the Payload
    if (!cartMemory[itemName]) {
        cartMemory[itemName] = {
            quantity: 0, price: parseFloat(price), resId: rId,
            menuItem: menuItemId, image: image, name: itemName, isVeg: isVeg
        };
    } else {
        if (!cartMemory[itemName].menuItem && menuItemId) cartMemory[itemName].menuItem = menuItemId;
        if (!cartMemory[itemName].image && image) cartMemory[itemName].image = image;
        if (!cartMemory[itemName].name) cartMemory[itemName].name = itemName;
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
                container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #FC8019;border-radius:8px;width:72px;height:32px;overflow:hidden;box-shadow:0 2px 6px rgba(252,128,25,0.15);"><button onclick="updateCart('${originalPayload}', -1)" style="width:24px;height:100%;border:none;background:transparent;color:#FC8019;font-weight:900;font-size:16px;cursor:pointer;">−</button><span style="font-size:13px;font-weight:800;color:#FC8019;">${qty}</span><button onclick="updateCart('${originalPayload}', 1)" style="width:24px;height:100%;border:none;background:transparent;color:#FC8019;font-weight:900;font-size:14px;cursor:pointer;">+</button></div>`;
            } else {
                container.innerHTML = `<button onclick="updateCart('${originalPayload}', 1)" style="width:72px;height:32px;background:#fff;border:1px solid #f9ded0;border-radius:8px;color:#FC8019;font-weight:800;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.05);cursor:pointer;">ADD</button>`;
            }
        } else if (typeof window.makeBtnHTML === 'function') {
            container.innerHTML = window.makeBtnHTML(itemName, qty, price, rId, inStock, menuItemId, image, isVeg);
        }
    }
    
    // Save and Trigger Floating Cart Bar
    localStorage.setItem('nearbite_cart', JSON.stringify(cartMemory));
    if (typeof window.updateGlobalCart === 'function') window.updateGlobalCart();
  };

  /* ── 2. THE CSS ── */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

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
      width: calc(100% - 24px); max-width: 420px;
      z-index: 9999; display: none;
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
      border-radius: 24px; padding: 8px 12px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 1px 1px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.08), 0 16px 32px -8px rgba(16,24,40,0.16);
      font-family: 'Plus Jakarta Sans', sans-serif; height: 58px;
      box-sizing: border-box;
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      #white-cart-container { background: rgba(255,255,255,0.98); }
    }

    .wc-left {
      all: unset;
      display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
      cursor: pointer; box-sizing: border-box;
    }
    .wc-thumb-wrap { position: relative; display: flex; align-items: center; flex-shrink: 0; }
    .wc-image-stack { display: flex; position: relative; height: 40px; min-width: 40px; align-items: center; transition: width 0.3s ease; }
    .wc-img { width: 40px; height: 40px; border-radius: 20px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; position: absolute; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: all 0.3s ease; }
    .wc-img:nth-child(1) { left: 0px; z-index: 3; }
    .wc-img:nth-child(2) { left: 16px; z-index: 2; transform: scale(0.95); opacity: 0.95; }
    .wc-img:nth-child(3) { left: 32px; z-index: 1; transform: scale(0.9); opacity: 0.85; }
    .wc-qty-badge {
      position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px;
      padding: 0 4px; border-radius: 9px;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      color: #fff; font-size: 10px; font-weight: 800; line-height: 18px; text-align: center;
      border: 2px solid #FFFFFF; box-shadow: 0 2px 4px rgba(0,0,0,0.18); z-index: 4;
    }
    .wc-bump { animation: wcBump 0.32s ease; }

    .wc-info { display: flex; flex-direction: column; min-width: 0; justify-content: center; }
    .wc-res-name { font-size: 14px; font-weight: 800; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-menu-link { font-size: 12px; font-weight: 700; color: #FF4D4F; margin-top: 1px; display: flex; align-items: center; gap: 4px; }

    .wc-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .wc-btn {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      border: none; border-radius: 20px; height: 40px; min-height: 36px; padding: 0 16px;
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
    .wc-btn-title { font-size: 13px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
    .wc-btn-sub { font-size: 11px; font-weight: 600; opacity: 0.95; white-space: nowrap; }
    .wc-close {
      width: 36px; height: 36px; border-radius: 50%; background: #F1F1F1; border: none;
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
      #white-cart-container { padding: 6px 10px; height: 54px; }
      .wc-img { width: 36px; height: 36px; }
      .wc-image-stack { height: 36px; min-width: 36px; }
      .wc-btn { padding: 0 12px; }
      .wc-res-name { font-size: 13px; }
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
      <div id="white-cart-container">
        <button type="button" class="wc-left" aria-label="View cart" onclick="window.location.href='cart.html'">
          <div class="wc-thumb-wrap">
            <div class="wc-image-stack" id="wc-dynamic-img-stack"></div>
            <span class="wc-qty-badge" id="wc-qty-badge" aria-hidden="true">0</span>
          </div>
        </button>
        <div class="wc-right">
          <div id="wc-standard-actions" style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="wc-btn" onclick="window.location.href='cart.html'">
              <span class="wc-btn-title">View Cart →</span>
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

  function syncBottom() {
    const root = document.getElementById('white-cart-root');
    if (!root) return;
    const nav = document.querySelector('.bottom-nav');
    const base = (nav && !nav.classList.contains('bottom-nav-hidden')) ? 84 : 20;
    root.style.bottom = `calc(${base}px + env(safe-area-inset-bottom, 0px))`;
  }

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

      imgStackEl.style.width = latestThreeNames.length === 1 ? '40px' : latestThreeNames.length === 2 ? '56px' : '72px';

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
    syncBottom();

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

    const nav = document.querySelector('.bottom-nav');
    if (nav) new MutationObserver(syncBottom).observe(nav, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('scroll', syncBottom, { passive: true });
    
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
