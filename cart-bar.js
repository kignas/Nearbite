/* ================================================================
   PRODUCTION CART ENGINE & MULTI-IMAGE UI 
   Handles Math, LocalStorage, and the Floating Cart Bar
   ================================================================ */

(function () {
  if (window.__esWhiteCartBar) return;
  window.__esWhiteCartBar = true;

  /* ── 1. THE MATH ENGINE (Missing from your old file) ── */
  window.updateCart = function(name, qtyChange, price, restaurantId) {
    // 1. Pull the current cart from the phone's memory
    let cart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};
    
    // Check for Cross-Restaurant Ordering (Swiggy Rule)
    const existingItems = Object.keys(cart);
    if (existingItems.length > 0) {
      const firstItemResId = cart[existingItems[0]].resId;
      if (firstItemResId && firstItemResId !== restaurantId && qtyChange > 0) {
        alert("You can only order from one restaurant at a time. Please clear your cart to start a new order.");
        return;
      }
    }

    // 2. Add or update the item
    if (!cart[name]) {
      cart[name] = { quantity: 0, price: parseFloat(price), resId: restaurantId };
    }
    
    cart[name].quantity += parseInt(qtyChange);

    // 3. If quantity is 0, remove the food from the cart
    if (cart[name].quantity <= 0) {
      delete cart[name];
    }

    // 4. Save back to phone and trigger UI update
    localStorage.setItem('nearbite_cart', JSON.stringify(cart));
    
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
    if (window.updateGlobalCart) window.updateGlobalCart();
  };


  /* ── 2. THE CSS (Multi-image overlapping & Clear Cart UI) ── */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

    @keyframes slideUpWhiteCart {
      0% { transform: translate(-50%, 150%); opacity: 0; }
      100% { transform: translate(-50%, 0); opacity: 1; }
    }

    #white-cart-root {
      position: fixed; left: 50%; transform: translateX(-50%);
      width: calc(100% - 24px); max-width: 420px;
      z-index: 9999; transition: bottom 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      display: none;
    }

    #white-cart-container {
      background: #FFFFFF; border-radius: 24px; padding: 12px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0px 8px 24px rgba(0,0,0,0.12);
      font-family: 'Plus Jakarta Sans', sans-serif; height: 76px; 
    }

    .wc-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
    .wc-image-stack { display: flex; position: relative; height: 40px; min-width: 40px; align-items: center; transition: width 0.3s ease; }
    .wc-img { width: 40px; height: 40px; border-radius: 20px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; position: absolute; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: all 0.3s ease; }
    
    .wc-img:nth-child(1) { left: 0px; z-index: 3; }
    .wc-img:nth-child(2) { left: 16px; z-index: 2; transform: scale(0.95); opacity: 0.95; }
    .wc-img:nth-child(3) { left: 32px; z-index: 1; transform: scale(0.9); opacity: 0.85; }

    .wc-info { display: flex; flex-direction: column; min-width: 0; justify-content: center; }
    .wc-res-name { font-size: 14px; font-weight: 800; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-menu-link { font-size: 12px; font-weight: 700; color: #FF4D4F; margin-top: 1px; display: flex; align-items: center; gap: 4px; }

    .wc-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .wc-btn { background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%); border: none; border-radius: 20px; height: 48px; padding: 0 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.1s ease; }
    .wc-btn:active { transform: scale(0.96); }
    .wc-btn-title { font-size: 13px; font-weight: 800; line-height: 1.1; }
    .wc-btn-sub { font-size: 11px; font-weight: 600; opacity: 0.95; }

    .wc-close { width: 32px; height: 32px; border-radius: 50%; background: #F1F1F1; border: none; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 15px; cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
    .wc-close:active { background: #e5e7eb; }
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
        <div class="wc-left" onclick="window.location.href='cart.html'">
          <div class="wc-image-stack" id="wc-dynamic-img-stack"></div>
          <div class="wc-info">
            <div class="wc-res-name" id="wc-dynamic-res">EatSwada Order</div>
            <div class="wc-menu-link">Added to cart <i class="fa-solid fa-check" style="font-size:10px;"></i></div>
          </div>
        </div>
        <div class="wc-right">
          <div id="wc-standard-actions" style="display: flex; gap: 8px; align-items: center;">
            <button class="wc-btn" onclick="window.location.href='cart.html'">
              <span class="wc-btn-title">View Cart</span>
              <span class="wc-btn-sub" id="wc-item-count">1 item</span>
            </button>
            <button class="wc-close" id="wc-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div id="wc-clear-actions" style="display: none; gap: 8px; align-items: center;">
            <button class="wc-btn" id="wc-confirm-clear" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
              <span class="wc-btn-title">Clear Cart</span>
            </button>
            <button class="wc-close" id="wc-cancel-clear"><i class="fa-solid fa-arrow-right-long"></i></button>
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
    if (nav) {
      const rect = nav.getBoundingClientRect();
      const isHidden = nav.classList.contains('bottom-nav-hidden') || rect.top >= window.innerHeight;
      root.style.bottom = isHidden ? '20px' : '84px';
    } else {
      root.style.bottom = '20px';
    }
  }

  window.updateGlobalCart = function () {
    if (isDismissed) return;

    const savedCart = JSON.parse(localStorage.getItem('nearbite_cart')) || {};
    const itemNames = Object.keys(savedCart);
    const root = document.getElementById('white-cart-root');
    const countEl = document.getElementById('wc-item-count');
    const imgStackEl = document.getElementById('wc-dynamic-img-stack');
    const resEl = document.getElementById('wc-dynamic-res');

    if (!root || !countEl || !imgStackEl) return;

    // Reset clear actions
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

      const lastItemName = itemNames[itemNames.length - 1];
      if (resEl) resEl.innerText = lastItemName;

      // Render Images
      imgStackEl.innerHTML = ''; 
      const latestThreeNames = itemNames.slice(-3).reverse(); 
      const imageDict = JSON.parse(localStorage.getItem('es_image_dict')) || {};

      latestThreeNames.forEach((name) => {
         const imgSrc = imageDict[name] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
         const img = document.createElement('img');
         img.src = imgSrc;
         img.classList.add('wc-img');
         img.alt = name;
         imgStackEl.appendChild(img);
      });

      imgStackEl.style.width = latestThreeNames.length === 1 ? '40px' : latestThreeNames.length === 2 ? '56px' : '72px';

      if (root.style.display === 'none' || root.style.display === '') {
        root.style.display = 'block';
        root.style.animation = 'slideUpWhiteCart 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      }
    } else {
      root.style.display = 'none';
    }
  };

  /* ── 5. INITIALIZATION ── */
  function init() {
    injectCSS();
    document.body.appendChild(makeDOM());
    syncBottom();

    // 📸 Image Snatcher
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .counter-btn, [onclick*="updateCart"]');
      if (!btn) return;
      
      let foodName = "";
      const clickCode = btn.getAttribute('onclick');
      if (clickCode) {
        const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
        if (match) foodName = match[1];
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
        let dict = JSON.parse(localStorage.getItem('es_image_dict')) || {};
        dict[foodName] = capturedImg;
        localStorage.setItem('es_image_dict', JSON.stringify(dict));
      }
    }, true); 

    // CLEAR CART FLOW
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
