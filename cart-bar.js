/* ================================================================
   PRODUCTION CART ENGINE & MULTI-IMAGE UI 
   Handles Math, LocalStorage, and the Floating Cart Bar
   ================================================================ */

(function () {
  if (window.__esWhiteCartBar) return;
  window.__esWhiteCartBar = true;

  // 🛡️ CRASH-PROOF STORAGE PARSER
  // This prevents your cart bar from becoming invisible if corrupted data exists
  function safeGetCart() {
    try {
        const data = localStorage.getItem('nearbite_cart');
        return (data && data !== "undefined" && data !== "null") ? JSON.parse(data) : {};
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

    @keyframes nbCartSlideUp {
      0% { transform: translate(-50%, 120%); opacity: 0; }
      100% { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes nbCartGlow {
      0%, 100% { opacity: .35; transform: translateX(-120%); }
      50% { opacity: .7; transform: translateX(120%); }
    }
    @keyframes nbCartPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.035); }
    }

    #white-cart-root {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 20px);
      max-width: 430px;
      z-index: 9999;
      display: none;
      pointer-events: none;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      filter: drop-shadow(0 14px 30px rgba(15,23,42,.18));
    }

    #white-cart-container {
      position: relative;
      overflow: hidden;
      min-height: 72px;
      padding: 9px 10px 9px 10px;
      display: flex;
      align-items: center;
      gap: 9px;
      border: 1px solid rgba(255,255,255,.9);
      border-radius: 22px;
      background:
        linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,252,.96)),
        #fff;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.95),
        0 0 0 1px rgba(15,23,42,.035),
        0 12px 28px rgba(15,23,42,.13);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      pointer-events: auto;
    }

    #white-cart-container::before {
      content: "";
      position: absolute;
      top: 0;
      left: -45%;
      width: 38%;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255,91,31,.85), transparent);
      animation: nbCartGlow 4s ease-in-out infinite;
      pointer-events: none;
    }

    .wc-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .wc-image-stack {
      display: flex;
      position: relative;
      height: 44px;
      min-width: 44px;
      align-items: center;
      transition: width .25s ease;
      flex-shrink: 0;
    }

    .wc-img {
      width: 44px;
      height: 44px;
      border-radius: 15px;
      object-fit: cover;
      background: #f1f5f9;
      flex-shrink: 0;
      position: absolute;
      border: 2px solid #fff;
      box-shadow: 0 3px 10px rgba(15,23,42,.14);
      transition: transform .25s ease, opacity .25s ease;
    }

    .wc-img:nth-child(1) { left: 0; z-index: 3; }
    .wc-img:nth-child(2) { left: 14px; z-index: 2; transform: scale(.94); opacity: .96; }
    .wc-img:nth-child(3) { left: 28px; z-index: 1; transform: scale(.88); opacity: .9; }

    .wc-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      gap: 3px;
    }

    .wc-res-name {
      max-width: 142px;
      font-size: 13px;
      line-height: 1.15;
      font-weight: 800;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .wc-menu-link {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #64748b;
      font-size: 10.5px;
      line-height: 1.1;
      font-weight: 700;
      white-space: nowrap;
    }

    .wc-menu-link .wc-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      color: #fff;
      background: linear-gradient(135deg,#22c55e,#16a34a);
      box-shadow: 0 3px 8px rgba(34,197,94,.25);
      font-size: 9px;
    }

    .wc-right {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
    }

    .wc-btn {
      position: relative;
      overflow: hidden;
      min-width: 104px;
      height: 50px;
      padding: 0 14px;
      border: 0;
      border-radius: 17px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: linear-gradient(135deg, #ff8a00 0%, #ff5a1f 48%, #ff3d1f 100%);
      box-shadow:
        0 7px 16px rgba(255,90,31,.24),
        inset 0 1px 0 rgba(255,255,255,.25);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform .14s ease, box-shadow .14s ease;
    }

    .wc-btn::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 25%, rgba(255,255,255,.22) 48%, transparent 70%);
      transform: translateX(-120%);
      animation: nbCartGlow 5s ease-in-out infinite;
      pointer-events: none;
    }

    .wc-btn:active {
      transform: scale(.96);
      box-shadow: 0 4px 10px rgba(255,90,31,.2);
    }

    .wc-btn-title {
      position: relative;
      z-index: 1;
      font-size: 12.5px;
      font-weight: 800;
      line-height: 1.1;
    }

    .wc-btn-sub {
      position: relative;
      z-index: 1;
      margin-top: 3px;
      font-size: 10px;
      font-weight: 700;
      opacity: .92;
    }

    .wc-close {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 13px;
      cursor: pointer;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
      transition: background .15s ease, transform .15s ease;
    }

    .wc-close:active {
      transform: scale(.92);
      background: #eef2f7;
    }

    .wc-cart-badge {
      position: absolute;
      top: -4px;
      right: 42px;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: #111827;
      border: 2px solid #fff;
      font-size: 9px;
      font-weight: 800;
      box-shadow: 0 3px 8px rgba(15,23,42,.18);
      pointer-events: none;
      animation: nbCartPulse 2.5s ease-in-out infinite;
    }

    @media (max-width: 360px) {
      #white-cart-root { width: calc(100% - 14px); }
      #white-cart-container { padding: 8px; gap: 6px; }
      .wc-image-stack { min-width: 40px; height: 40px; }
      .wc-img { width: 40px; height: 40px; border-radius: 13px; }
      .wc-img:nth-child(2) { left: 12px; }
      .wc-img:nth-child(3) { left: 24px; }
      .wc-res-name { max-width: 105px; font-size: 12px; }
      .wc-btn { min-width: 92px; height: 48px; padding: 0 10px; }
      .wc-close { width: 31px; height: 31px; }
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
      <div id="white-cart-container" aria-label="Cart summary">
        <div class="wc-cart-badge" id="wc-cart-badge">1</div>

        <div class="wc-left" onclick="window.location.href='cart.html'" role="button" tabindex="0">
          <div class="wc-image-stack" id="wc-dynamic-img-stack"></div>

          <div class="wc-info">
            <div class="wc-res-name" id="wc-dynamic-res">Nearbite Order</div>
            <div class="wc-menu-link">
              <span class="wc-check">✓</span>
              <span>1 restaurant • <span id="wc-item-count">1 item</span></span>
            </div>
          </div>
        </div>

        <div class="wc-right">
          <div id="wc-standard-actions" style="display:flex;gap:7px;align-items:center;">
            <button class="wc-btn" onclick="window.location.href='cart.html'" aria-label="View cart">
              <span class="wc-btn-title">View Cart&nbsp; →</span>
              <span class="wc-btn-sub" id="wc-total-label">Review your order</span>
            </button>
            <button class="wc-close" id="wc-close-btn" aria-label="Cart options">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="wc-clear-actions" style="display:none;gap:7px;align-items:center;">
            <button class="wc-btn" id="wc-confirm-clear"
              style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);">
              <span class="wc-btn-title">Clear Cart</span>
              <span class="wc-btn-sub">Remove everything</span>
            </button>
            <button class="wc-close" id="wc-cancel-clear" aria-label="Keep cart">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    return wrap;
  }

  /* ── 4. UI BEHAVIOR LOGIC ── */
  let isDismissed = false;

  function syncBottom() {
    const root = document.getElementById('white-cart-root');
    if (!root) return;
    const nav = document.querySelector('.bottom-nav');
    if (nav && !nav.classList.contains('bottom-nav-hidden')) {
      root.style.bottom = '84px';
    } else {
      root.style.bottom = '20px';
    }
  }

  window.updateGlobalCart = function () {
    if (isDismissed) return;

    const savedCart = safeGetCart();
    const itemNames = Object.keys(savedCart);
    const root = document.getElementById('white-cart-root');
    const countEl = document.getElementById('wc-item-count');
    const badgeEl = document.getElementById('wc-cart-badge');
    const imgStackEl = document.getElementById('wc-dynamic-img-stack');
    const resEl = document.getElementById('wc-dynamic-res');
    const totalLabelEl = document.getElementById('wc-total-label');

    if (!root || !countEl || !imgStackEl) return;

    const stdActions = document.getElementById('wc-standard-actions');
    const clearActions = document.getElementById('wc-clear-actions');
    if (stdActions && clearActions) {
        stdActions.style.display = 'flex';
        clearActions.style.display = 'none';
    }

    if (itemNames.length > 0) {
      let totalQty = 0;
      itemNames.forEach(key => { totalQty += savedCart[key].quantity; });
      countEl.innerText = totalQty === 1 ? '1 item' : `${totalQty} items`;
      if (badgeEl) badgeEl.innerText = totalQty > 99 ? '99+' : String(totalQty);

      const firstCartItem = savedCart[itemNames[0]] || {};
      const restaurantName =
        firstCartItem.restaurantName ||
        firstCartItem.restaurant ||
        firstCartItem.resName ||
        'Nearbite Restaurant';

      if (resEl) resEl.innerText = restaurantName;
      if (totalLabelEl) totalLabelEl.innerText = 'Ready to checkout';

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
         img.classList.add('wc-img');
         imgStackEl.appendChild(img);
      });

      imgStackEl.style.width = latestThreeNames.length === 1 ? '40px' : latestThreeNames.length === 2 ? '56px' : '72px';

      if (root.style.display === 'none' || root.style.display === '') {
        root.style.display = 'block';
        root.style.animation = 'slideUpWhiteCart 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      }
    } else {
      root.style.display = 'none';
      if (badgeEl) badgeEl.innerText = '0';
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
