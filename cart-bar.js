/* ================================================================
   EATSWADA CART ENGINE & FLOATING CART BAR  (v3.1 — single owner)
   Handles Math, LocalStorage, and the Floating Cart Bar.

   ONE owner for every page's cart bar:
     • Home  ......... white floating capsule  (restaurant info + "X items",
                       NO price, "All ↑" capsule when 2+ restaurants)
     • 99 Store  ..... solid pink rectangular bar ("X items · ₹TOTAL" | View Cart)
     • Restaurant  ... same solid pink bar as 99 Store
     • Cart/Checkout . hidden

   The cart DATA layer (nearbite_cart, updateCart, validation, image dict,
   multi-restaurant drawer) is UNCHANGED. Only the PRESENTATION changed.

   v3.1 is a PERFORMANCE-ONLY pass. No schema, public-API, visual or
   behavioural changes. See the PERF: comments for each hot path.
   ================================================================ */

(function () {
  if (window.__esWhiteCartBar) return;
  window.__esWhiteCartBar = true;

  // Display-only setting: change this one line if the storefront's
  // currency symbol is ever not ₹ (Indian Rupee).
  const CURRENCY_SYMBOL = '₹';

  const FALLBACK_IMG =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';

  const CART_KEY = 'nearbite_cart';
  const IMG_DICT_KEY = 'es_image_dict';
  const CHECKOUT_KEY = 'nearbite_checkout_key';

  // Cart-bar presentation is page-specific.
  function getCartBarMode() {
    const path = String(window.location.pathname || '').toLowerCase();
    if (path === '/' || path.endsWith('/index.html') || path.endsWith('/home.html')) return 'home';
    if (path.includes('cart') || path.includes('checkout') || path.includes('payment')) return 'hidden';
    if (path.includes('under99') || path.includes('99store') || path.includes('99-store') || path.includes('deals')) return 'pink';
    if (path.includes('restaurant')) return 'pink';
    return 'home';
  }
  const CART_BAR_MODE = getCartBarMode();

  // 🛡️ CRASH-PROOF STORAGE PARSER
  function safeGetCart() {
    try {
        const data = localStorage.getItem(CART_KEY);
        if (!data || data === "undefined" || data === "null") return {};
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed;
    } catch (e) {
        console.warn("Corrupted cart detected and wiped.");
        try { localStorage.removeItem(CART_KEY); } catch (e2) {}
        return {};
    }
  }

  /* ── PERF: in-memory caches ─────────────────────────────────────
     localStorage stays the source of persistence, but JSON.parse is
     the expensive half and it is now skipped whenever the stored
     string is byte-identical to the one we already parsed. A raw
     getItem() is kept as the freshness check so that writes made by
     OTHER scripts (which do not go through updateCart) are still
     picked up — correctness first, then speed.
     ───────────────────────────────────────────────────────────── */
  let cartRaw = null;   // raw string matching cartObj
  let cartObj = null;   // parsed cart — READ-ONLY for renderers, never mutated
  let dictRaw = null;
  let dictObj = null;

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // Shared, never-mutated cart snapshot for the render path.
  function getCartCached() {
    const raw = readRaw(CART_KEY);
    if (cartObj !== null && raw === cartRaw) return cartObj;
    cartObj = safeGetCart();
    cartRaw = readRaw(CART_KEY); // re-read: safeGetCart may have wiped corrupt data
    return cartObj;
  }

  // Cheap write-through so the next render needs no parse at all.
  function setCartCache(rawString, obj) {
    cartRaw = rawString;
    cartObj = obj;
  }
  function invalidateCartCache() {
    cartRaw = null;
    cartObj = null;
  }

  function getImageDict() {
    const raw = readRaw(IMG_DICT_KEY);
    if (dictObj !== null && raw === dictRaw) return dictObj;
    dictRaw = raw;
    let parsed = {};
    try {
      if (raw && raw !== "undefined" && raw !== "null") {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object' && !Array.isArray(p)) parsed = p;
      }
    } catch (e) {}
    dictObj = parsed;
    return dictObj;
  }
  function invalidateImageDict() {
    dictRaw = null;
    dictObj = null;
  }

  /* ── 1. THE MATH ENGINE (Unified Master Version — UNCHANGED) ── */
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

    if (change > 0 && (!menuItemId || menuItemId === 'undefined' || menuItemId === 'null')) {
        alert("CRITICAL ERROR: Missing Menu Item ID. Please refresh and try again.");
        return;
    }

    // PERF: writers get their OWN object graph (safeGetCart re-parses), so
    // mutating it can never corrupt the shared read-only render snapshot.
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

    // Save and Trigger Floating Cart Bar.
    // PERF: the DATA write stays synchronous (unchanged); only the visual
    // update is coalesced into the next animation frame.
    const serialized = JSON.stringify(cartMemory);
    try { localStorage.setItem(CART_KEY, serialized); } catch (e) {}
    setCartCache(serialized, cartMemory);

    // Notify any page that derives UI from the cart (e.g. homepage product
    // cards) via the existing shared event — no separate cart state.
    try { document.dispatchEvent(new CustomEvent('eatswada:cart-updated', { detail: { source: 'updateCart', itemName: itemName } })); } catch (e) {}
    if (typeof window.updateGlobalCart === 'function') window.updateGlobalCart();
  };

  /* ── Inline icons (no external font dependency) ── */
  const CART_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.16L21 8H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="20" r="1.4" fill="currentColor"/><circle cx="17.5" cy="20" r="1.4" fill="currentColor"/></svg>';
  const UP_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
    /* PERF: each restartable animation is declared TWICE under two names.
       Alternating between the two classes restarts the animation because the
       animation-name changes, which removes the need for a forced reflow
       (void el.offsetWidth) on every cart update. Keep the pairs identical. */
    @keyframes wcBump {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
    @keyframes wcBumpAlt {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
    @keyframes wcPinkEnter {
      0% { transform: translate(-50%, 130%) scale(.96); opacity:0; }
      70% { transform: translate(-50%, -4px) scale(1.015); opacity:1; }
      100% { transform: translate(-50%, 0) scale(1); opacity:1; }
    }
    @keyframes wcPinkPulse {
      0% { transform: scale(1); }
      38% { transform: scale(1.024); }
      72% { transform: scale(.995); }
      100% { transform: scale(1); }
    }
    @keyframes wcPinkPulseAlt {
      0% { transform: scale(1); }
      38% { transform: scale(1.024); }
      72% { transform: scale(.995); }
      100% { transform: scale(1); }
    }
    @keyframes wcPinkTextBump {
      0% { transform: translateY(0); opacity:1; }
      35% { transform: translateY(-2px); opacity:.86; }
      100% { transform: translateY(0); opacity:1; }
    }
    @keyframes wcPinkTextBumpAlt {
      0% { transform: translateY(0); opacity:1; }
      35% { transform: translateY(-2px); opacity:.86; }
      100% { transform: translateY(0); opacity:1; }
    }
    @keyframes wcShine {
      0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
      15% { opacity: 0.45; }
      55% { opacity: 0.45; }
      100% { transform: translateX(220%) skewX(-20deg); opacity: 0; }
    }

    #white-cart-root {
      position: fixed !important; left: 50% !important; transform: translateX(-50%) !important;
      /* IMPORTANT: inherit the bottom-nav component's shared variable.
         Do not create an inline --nb-cart-bottom on this element. */
      bottom: var(--nb-cart-bottom, calc(16px + env(safe-area-inset-bottom, 0px))) !important;
      width: min(720px, calc(100vw - 24px)); max-width: calc(100vw - 24px);
      z-index: 100000; display: none;
      transition: bottom .32s cubic-bezier(.22,1,.36,1);
    }
    /* PERF: promote the bar ONLY while it is actually animating, instead of
       keeping a permanent compositor layer alive on every page. */
    #white-cart-root.wc-enter,
    #white-cart-root.wc-exiting {
      will-change: transform, opacity;
    }
    #white-cart-root.wc-enter {
      animation: slideUpWhiteCart 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    #white-cart-root.wc-pink.wc-enter {
      animation: wcPinkEnter .36s cubic-bezier(.22,1,.36,1) forwards;
    }
    #white-cart-root.wc-pink.wc-cart-update #es-pink-inner {
      animation: wcPinkPulse .32s cubic-bezier(.22,1,.36,1);
      will-change: transform;
    }
    #white-cart-root.wc-pink.wc-cart-update-alt #es-pink-inner {
      animation: wcPinkPulseAlt .32s cubic-bezier(.22,1,.36,1);
      will-change: transform;
    }
    #white-cart-root.wc-pink.wc-cart-update .wc-pink-left,
    #white-cart-root.wc-pink.wc-cart-update .wc-pink-cta {
      animation: wcPinkTextBump .28s cubic-bezier(.22,1,.36,1);
    }
    #white-cart-root.wc-pink.wc-cart-update-alt .wc-pink-left,
    #white-cart-root.wc-pink.wc-cart-update-alt .wc-pink-cta {
      animation: wcPinkTextBumpAlt .28s cubic-bezier(.22,1,.36,1);
    }
    #white-cart-root.wc-exiting {
      animation: slideDownWhiteCart 0.26s ease forwards;
    }

    /* ─────────────  HOME (white) cart bar  ───────────── */
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
      display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; overflow: hidden;
      cursor: pointer; box-sizing: border-box;
    }
    .wc-thumb-wrap { position: relative; display: flex; align-items: center; flex-shrink: 0; }
    .wc-image-stack { display: flex; position: relative; height: 36px; min-width: 36px; align-items: center; transition: width 0.3s ease; }
    /* PERF: explicit transition list instead of "all" — same visible motion,
       without style-diffing every property on the thumbnails. */
    .wc-img { width: 36px; height: 36px; border-radius: 18px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; position: absolute; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: transform 0.3s ease, opacity 0.3s ease, left 0.3s ease; }
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
    .wc-bump-alt { animation: wcBumpAlt 0.32s ease; }

    .wc-info { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; justify-content: center; overflow: hidden; }
    .wc-res-name { font-size: 12px; font-weight: 800; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-menu-link { font-size: 10px; font-weight: 700; color: #FF4D4F; margin-top: 1px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .wc-right { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; flex-shrink: 0; }
    #wc-standard-actions { flex: 0 0 auto; }
    .wc-btn { min-width: 86px; }

    .wc-btn {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      border: none; border-radius: 22px; height: 44px; min-height: 40px; padding: 0 12px;
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
    .wc-btn-title { font-size: 11px; font-weight: 800; line-height: 1.1; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
    .wc-btn-title svg { width: 13px; height: 13px; }
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

    /* ── "All ↑" capsule — HOME ONLY, centered ABOVE the cart bar ── */
    #wc-allup {
      all: unset;
      position: absolute; left: 50%; transform: translateX(-50%);
      bottom: calc(100% + 8px);
      display: none; align-items: center; gap: 5px;
      background: #ffffff; color: #111827;
      border: 1px solid rgba(17,24,39,0.08);
      border-radius: 16px; height: 32px; padding: 0 14px;
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      font-size: 12px; font-weight: 800; cursor: pointer;
      box-shadow: 0 6px 16px rgba(16,24,40,0.16);
      -webkit-tap-highlight-color: transparent; box-sizing: border-box; z-index: 2;
    }
    #wc-allup.show { display: inline-flex; }
    #wc-allup:active { transform: translateX(-50%) scale(0.96); }
    #wc-allup svg { width: 12px; height: 12px; }

    /* ─────────────  99 STORE + RESTAURANT (solid pink) cart bar  ───────────── */
    #white-cart-root.wc-pink {
      width: min(720px, calc(100vw - 40px));   /* ~20px side margins */
      max-width: calc(100vw - 40px);
    }
    #es-pink-inner {
      all: unset;
      box-sizing: border-box; width: 100%;
      height: 56px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 0 18px;
      background: #EC168C;                       /* solid pink, no gradient/glow */
      color: #ffffff;
      border-radius: 16px;                       /* rounded rectangle, NOT a capsule */
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);   /* subtle only */
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s ease;
    }
    #es-pink-inner:active { transform: scale(0.985); }
    #white-cart-root.wc-pink{padding-bottom:env(safe-area-inset-bottom,0px)}
    .wc-pink-left {
      font-size: 15px; font-weight: 800; color: #ffffff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
    }
    .wc-pink-cta {
      display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto;
      font-size: 15px; font-weight: 800; color: #ffffff;
    }
    .wc-pink-cta svg { width: 18px; height: 18px; }

    /* Multi-restaurant cart drawer — used by pink bar and home "All ↑" */
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
      #es-pink-inner:hover { filter: brightness(1.03); }
    }

    /* Narrow phones (≈360px and below) */
    @media (max-width: 360px) {
      #white-cart-root { width: calc(100vw - 20px); max-width: calc(100vw - 20px); }
      #white-cart-root.wc-pink { width: calc(100vw - 32px); max-width: calc(100vw - 32px); }
      #white-cart-container { padding: 7px; height: 58px; }
      #es-pink-inner { height: 54px; padding: 0 14px; }
      .wc-pink-left, .wc-pink-cta { font-size: 14px; }
      .wc-img { width: 34px; height: 34px; }
      .wc-image-stack { height: 34px; min-width: 34px; }
      .wc-btn { padding: 0 10px; height: 42px; }
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
    s.textContent = CSS; // PERF: textContent skips the HTML parser for a pure CSS payload
    document.head.appendChild(s);
  }

  /* ── 3. THE DOM ── */
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
      <button type="button" id="es-pink-inner" aria-label="View cart"
        onclick="window.__ewOpenCartDrawer ? window.__ewOpenCartDrawer() : (window.location.href='cart.html')">
        <span class="wc-pink-left" id="wc-item-count" aria-live="polite">0 items</span>
        <span class="wc-pink-cta">View Cart ${CART_SVG}</span>
      </button>
    `;
    return wrap;
  }

  function makeDOM() {
    return CART_BAR_MODE === 'pink' ? makePinkDOM() : makeHomeDOM();
  }

  /* ── PERF: cached element references ──────────────────────────────
     These nodes are created once and never replaced, so re-querying
     them on every render was pure waste. Every getter re-queries only
     if the cached node was detached by another script.
     ─────────────────────────────────────────────────────────────── */
  let rootEl = null, countEl = null, badgeEl = null, resEl = null,
      imgStackEl = null, allupEl = null, stdActionsEl = null, clearActionsEl = null;

  function cacheRefs(root) {
    rootEl = root || null;
    if (!rootEl) {
      countEl = badgeEl = resEl = imgStackEl = allupEl = stdActionsEl = clearActionsEl = null;
      return;
    }
    countEl = document.getElementById('wc-item-count');
    badgeEl = document.getElementById('wc-qty-badge');
    resEl = document.getElementById('wc-dynamic-res');
    imgStackEl = document.getElementById('wc-dynamic-img-stack');
    allupEl = document.getElementById('wc-allup');
    stdActionsEl = document.getElementById('wc-standard-actions');
    clearActionsEl = document.getElementById('wc-clear-actions');
  }

  function getRoot() {
    if (rootEl && rootEl.isConnected) return rootEl;
    cacheRefs(document.getElementById('white-cart-root'));
    return rootEl;
  }

  // Write to the DOM only when the displayed value actually changed.
  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  /* ── Remove any obsolete/legacy cart bars so exactly ONE remains ── */
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
        console.info('[Eatswada cart] removed obsolete cart bar:', sel);
      });
    });
  }

  /* ── 4. UI BEHAVIOR LOGIC ── */
  let isDismissed = false;
  let lastTotalQty = null;
  let lastTotalPrice = null;
  let exitTimer = null;
  let pinkUpdateTimer = null;
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

  /* PERF: restart the keyframe by swapping to an identical animation under a
     different name, instead of `void el.offsetWidth`. Same visible bump, zero
     forced layout — so rapid +/- tapping never synchronously reflows. */
  function bump(el) {
    if (!el || prefersReducedMotion()) return;
    if (el.classList.contains('wc-bump')) {
      el.classList.remove('wc-bump');
      el.classList.add('wc-bump-alt');
    } else {
      el.classList.remove('wc-bump-alt');
      el.classList.add('wc-bump');
    }
  }

  function showCartBar(root) {
    if (!root) return;
    if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
    root.classList.remove('wc-exiting');
    if (root.style.display === 'none' || root.style.display === '') {
      root.style.display = 'block';
      root.classList.remove('wc-enter');
      if (!prefersReducedMotion()) {
        void root.offsetWidth; // required: restarts the enter animation
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

  /* ── Positioning: keep the cart bar clear ABOVE any bottom navigation ──
     PERF: the bottom nav is looked up ONCE and cached. The old fallback
     scan over every element under <body> — which measured computed style,
     bounding box and rendered text for each one — was unreachable dead code
     (nothing ever called findBottomNav) and has been deleted.
     ──────────────────────────────────────────────────────────────────── */
  const BOTTOM_NAV_ID = 'nearbite-bottom-tabbar';
  let bottomNav = null;

  function getBottomNav() {
    if (bottomNav && bottomNav.isConnected) return bottomNav;
    bottomNav = document.getElementById(BOTTOM_NAV_ID);
    return bottomNav;
  }
  function resetNavCache() {
    bottomNav = null;
    lastBottomValue = null;
    lastNavClearance = null;
  }

  let lastBottomValue = null;   // last string written to style.bottom (home mode)
  let lastNavClearance = null;  // last value written to --nb-cart-bottom (pink mode)

  function positionCartAboveNav(root) {
    root = root || getRoot();
    if (!root) return;

    /*
     * The universal bottom navigation owns --nb-cart-bottom.
     * cart-bar.js must NOT override that variable on #white-cart-root,
     * otherwise the cart cannot follow the nav when the nav hides/reveals.
     *
     * Home:
     *   visible nav  -> bottom nav itself publishes the exact offset
     *   hidden nav   -> bottom nav publishes the small bottom offset
     *
     * Pink 99/menu:
     *   keep the independent bottom placement used by those pages.
     */
    const nav = getBottomNav();
    if (!nav) startNavCreationWatch();

    if (CART_BAR_MODE === 'home') {
      // No layout reads at all in home mode: the CSS variable does the work.
      const value = nav
        ? 'var(--nb-cart-bottom, calc(16px + env(safe-area-inset-bottom, 0px)))'
        : '104px'; // Before the nav is created, keep a safe temporary position.
      if (value === lastBottomValue) return; // PERF: skip redundant style writes
      lastBottomValue = value;
      // Let bottom-tab-bar.js remain the single source of truth.
      root.style.removeProperty('--nb-cart-bottom');
      root.style.bottom = value;
      return;
    }

    // 99 Store / Restaurant Menu: keep their lower placement.
    if (nav) {
      // Single layout read, and only ever inside the rAF callback.
      const r = nav.getBoundingClientRect();
      const clearance = Math.round(Math.max(0, window.innerHeight - r.top)) + 12;
      if (clearance === lastNavClearance) return; // PERF: skip redundant style writes
      lastNavClearance = clearance;
      root.style.setProperty('--nb-cart-bottom', clearance + 'px');
    } else {
      if (lastNavClearance === 'default') return;
      lastNavClearance = 'default';
      root.style.setProperty('--nb-cart-bottom', 'calc(16px + env(safe-area-inset-bottom, 0px))');
    }
  }

  /* PERF: ONE shared rAF scheduler for scroll + resize + orientation +
     observers. At most one position calculation per animation frame, and
     never a nested frame. */
  let posRAF = null;
  function schedulePos() {
    if (posRAF) return;
    posRAF = requestAnimationFrame(() => {
      posRAF = null;
      positionCartAboveNav();
    });
  }

  /* The bottom navigation is created by a separate script and changes its
     hidden/revealed state by updating --nb-cart-bottom on <html>.

     PERF: the old observer watched the whole body tree and so woke up for
     every restaurant card, skeleton swap, image load and menu re-render on
     the page. It is replaced by:
       • a direct-children-only observer on <body>, disconnected the moment
         the nav appears (and hard-stopped after NAV_WATCH_MS either way),
       • a few bounded re-checks for navs created inside a wrapper,
       • the existing narrow <html> style-attribute observer.        */
  const NAV_WATCH_MS = 10000;
  let navCreationObserver = null;
  let navWatchTimers = [];
  let rootStyleObserver = null;

  function stopNavCreationWatch() {
    if (navCreationObserver) { navCreationObserver.disconnect(); navCreationObserver = null; }
    navWatchTimers.forEach(clearTimeout);
    navWatchTimers = [];
  }

  function startNavCreationWatch() {
    if (CART_BAR_MODE === 'hidden') return;
    if (navCreationObserver || !document.body) return;
    if (getBottomNav()) return;

    const check = () => {
      if (!getBottomNav()) return false;
      stopNavCreationWatch();
      schedulePos();
      return true;
    };

    navCreationObserver = new MutationObserver(check);
    navCreationObserver.observe(document.body, { childList: true }); // NOT subtree

    // Safety net for a nav created inside a wrapper element.
    [0, 100, 400, 1200, 2500].forEach(ms => navWatchTimers.push(setTimeout(check, ms)));
    navWatchTimers.push(setTimeout(stopNavCreationWatch, NAV_WATCH_MS)); // no observer leak
  }

  function watchBottomNavigation() {
    if (CART_BAR_MODE === 'hidden') return;
    startNavCreationWatch();

    if (CART_BAR_MODE !== 'home') return;
    if (rootStyleObserver) return;
    // Narrow by design: one element, one attribute.
    rootStyleObserver = new MutationObserver(() => schedulePos());
    rootStyleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  }

  /* PERF: listeners registered exactly once, all passive, all funnelled
     through the single rAF scheduler.
     `scroll` is bound for the pink bar only — that is the only mode that
     measures the nav's rect. Home mode follows the nav purely through the
     shared --nb-cart-bottom CSS variable, so a per-frame scroll callback
     on the busiest page bought nothing. */
  let viewportListenersBound = false;
  function bindViewportListeners() {
    if (viewportListenersBound || CART_BAR_MODE === 'hidden') return;
    viewportListenersBound = true;
    window.addEventListener('resize', schedulePos, { passive: true });
    window.addEventListener('orientationchange', schedulePos, { passive: true });
    if (CART_BAR_MODE === 'pink') {
      window.addEventListener('scroll', schedulePos, { passive: true }); // hide-on-scroll nav
    }
  }

  /* ── Multi-restaurant cart drawer (data logic UNCHANGED) ── */
  function restaurantGroups(savedCart){
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

  let drawerBackdropEl = null, drawerEl = null, drawerListEl = null, drawerTitleEl = null;
  let lastDrawerSignature = null;

  function ensureCartDrawer(){
    if (drawerBackdropEl && drawerBackdropEl.isConnected) return;
    const existing = document.getElementById('ew-cart-drawer-backdrop');
    if (existing) {
      drawerBackdropEl = existing;
      drawerEl = existing.querySelector('#ew-cart-drawer');
      drawerListEl = existing.querySelector('#ew-cd-list');
      drawerTitleEl = existing.querySelector('#ew-cd-title');
      return;
    }
    const b = document.createElement('div'); b.id = 'ew-cart-drawer-backdrop';
    b.innerHTML = '<section id="ew-cart-drawer" role="dialog" aria-modal="true" aria-label="Your carts"><div class="ew-cd-head"><div class="ew-cd-title" id="ew-cd-title">Your Carts</div><button class="ew-cd-close" type="button" aria-label="Close">×</button></div><div class="ew-cd-list" id="ew-cd-list"></div><div class="ew-cd-footer"><button class="ew-cd-checkout" type="button" id="ew-cd-checkout">Checkout all <span>›</span></button></div></section>';
    document.body.appendChild(b); const d = b.querySelector('#ew-cart-drawer');

    drawerBackdropEl = b;
    drawerEl = d;
    drawerListEl = b.querySelector('#ew-cd-list');
    drawerTitleEl = b.querySelector('#ew-cd-title');
    lastDrawerSignature = null;

    const close = () => { b.classList.remove('show'); d.classList.remove('show'); document.body.style.overflow = ''; };
    b.addEventListener('click', e => { if (e.target === b) close(); });
    b.querySelector('.ew-cd-close').addEventListener('click', close);
    b.querySelector('#ew-cd-checkout').addEventListener('click', () => window.location.href = 'cart.html');

    // PERF: ONE delegated listener for every row, for the life of the page,
    // instead of re-attaching a listener per button on every rerender.
    drawerListEl.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-cd-view]') : null;
      if (btn) window.location.href = 'cart.html';
    });

    window.__ewCloseCartDrawer = close;
  }

  function isDrawerOpen(){
    return !!(drawerBackdropEl && drawerBackdropEl.isConnected && drawerBackdropEl.classList.contains('show'));
  }

  // PERF: rebuild the drawer only when the restaurant groups actually changed.
  function renderCartDrawer(groups){
    ensureCartDrawer();
    if (!drawerListEl) return;
    const list = groups || restaurantGroups(getCartCached());

    const signature = list.map(g => g.id + '\u001f' + g.units + '\u001f' + g.name + '\u001f' + g.image).join('\u001e');
    if (signature === lastDrawerSignature) return;
    lastDrawerSignature = signature;

    setText(drawerTitleEl, `Your Carts (${list.length})`);
    drawerListEl.innerHTML = list.length
      ? list.map(g => {
          const u = Math.round(g.units);
          const img = g.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=180&q=80';
          return `<div class="ew-cd-row"><img class="ew-cd-logo" src="${escDrawer(img)}" alt=""><div class="ew-cd-info"><div class="ew-cd-name">${escDrawer(g.name)}</div><div class="ew-cd-menu">View Menu <span class="ew-cd-arrow">›</span></div></div><button class="ew-cd-view" type="button" data-cd-view="${escDrawer(g.id)}"><strong>View Cart</strong><span>${u} ${u === 1 ? 'item' : 'items'}</span></button></div>`;
        }).join('')
      : '<div class="ew-cd-empty">Your cart is empty.</div>';
  }

  function openRestaurantCarts(){
    ensureCartDrawer(); renderCartDrawer();
    const b = drawerBackdropEl, d = drawerEl;
    if (!b || !d) return;
    b.classList.add('show'); requestAnimationFrame(() => d.classList.add('show'));
    document.body.style.overflow = 'hidden';
  }
  function openCartDrawer(){
    // Home "View Cart" keeps its original behavior (go to the cart page);
    // the pink bar opens the multi-restaurant drawer.
    if (CART_BAR_MODE !== 'pink') { window.location.href = 'cart.html'; return; }
    openRestaurantCarts();
  }

  /* ── The single cart-bar renderer ───────────────────────────────── */
  let lastImgUrls = null;
  let lastStackWidth = null;
  let hasRendered = false;
  let lastRenderKey = null;
  let forceNextRender = false;

  function resetRenderCaches() {
    lastImgUrls = null;
    lastStackWidth = null;
    lastRenderKey = null;
    hasRendered = false;
    lastDrawerSignature = null;
  }

  function renderCartBar() {
    if (isDismissed || CART_BAR_MODE === 'hidden') return;

    const root = getRoot();
    if (!root) return;

    const savedCart = getCartCached();
    const usesImages = CART_BAR_MODE !== 'pink';
    if (usesImages) getImageDict();

    /* PERF: the dirty check. `cartRaw` is the exact stored string, so an
       identical string means an identical rendered result — no totals loop,
       no grouping, no DOM writes. The image dictionary is folded in because
       it feeds the home thumbnails. This correctly does NOT skip: clearing,
       image changes, restaurant-name repair, corrupt-entry repair, or
       another tab's write, because every one of those changes the string. */
    const renderKey = (cartRaw === null ? '\u0001' : cartRaw) +
                      '\u0000' +
                      (usesImages ? (dictRaw === null ? '' : dictRaw) : '');
    if (!forceNextRender && hasRendered && renderKey === lastRenderKey) return;
    forceNextRender = false;
    lastRenderKey = renderKey;
    hasRendered = true;

    const itemNames = Object.keys(savedCart);
    let groups = null;
    const getGroups = () => (groups || (groups = restaurantGroups(savedCart)));

    // Reset the clear-confirm UI (home only).
    if (stdActionsEl && clearActionsEl) {
      if (stdActionsEl.style.display !== 'flex') stdActionsEl.style.display = 'flex';
      if (clearActionsEl.style.display !== 'none') clearActionsEl.style.display = 'none';
    }

    // Keep the drawer live if it happens to be open.
    if (isDrawerOpen()) renderCartDrawer(getGroups());

    if (itemNames.length === 0) {
      hideCartBar(root);
      lastTotalQty = null;
      lastTotalPrice = null;
      lastImgUrls = null;
      if (allupEl) allupEl.classList.remove('show');
      return;
    }

    // Totals — cast defensively in case old/malformed cart entries exist.
    let totalQty = 0, totalPrice = 0, priceKnown = true;
    itemNames.forEach(key => {
      const item = savedCart[key] || {};
      const q = Number(item.quantity);
      const safeQty = Number.isFinite(q) ? Math.max(0, q) : 0;
      totalQty += safeQty;
      const p = Number(item.price);
      if (Number.isFinite(p) && p >= 0) { totalPrice += p * safeQty; } else { priceKnown = false; }
    });

    const baseCountText = totalQty === 1 ? '1 item' : `${totalQty} items`;
    // Price shows ONLY on the pink (99 Store / Restaurant) bar. Home = count only.
    const showPrice = (CART_BAR_MODE === 'pink') && priceKnown && totalPrice > 0;
    setText(countEl, showPrice ? `${baseCountText} · ${formatCurrency(totalPrice)}` : baseCountText);

    const totalChanged = lastTotalQty !== null && (lastTotalQty !== totalQty || lastTotalPrice !== totalPrice);
    if (totalChanged) {
      bump(countEl);
      if (CART_BAR_MODE === 'pink' && !prefersReducedMotion()) {
        // PERF: alternate the class to restart the pulse — no forced layout.
        const useAlt = root.classList.contains('wc-cart-update');
        root.classList.remove('wc-cart-update', 'wc-cart-update-alt');
        root.classList.add(useAlt ? 'wc-cart-update-alt' : 'wc-cart-update');
        if (pinkUpdateTimer) clearTimeout(pinkUpdateTimer); // PERF: clear old timer first
        pinkUpdateTimer = setTimeout(() => {
          root.classList.remove('wc-cart-update', 'wc-cart-update-alt');
          pinkUpdateTimer = null;
        }, 260);
      }
    }

    // Home-only visuals: image stack, badge, restaurant label, "All ↑".
    if (usesImages) {
      if (badgeEl) {
        const badgeText = totalQty > 99 ? '99+' : String(totalQty);
        setText(badgeEl, badgeText);
        if (lastTotalQty !== null && lastTotalQty !== totalQty) bump(badgeEl);
      }

      const lastItemName = itemNames[itemNames.length - 1];
      const lastItem = savedCart[lastItemName] || {};
      setText(resEl, lastItem.resName || lastItem.restaurantName || lastItemName);

      if (imgStackEl) {
        const latestThreeNames = itemNames.slice(-3).reverse();
        const imageDict = getImageDict();
        const urls = latestThreeNames.map(name => {
          const itemData = savedCart[name] || {};
          return itemData.image || imageDict[name] || FALLBACK_IMG;
        });

        /* PERF: only touch the thumbnails when the three URLs changed, and
           reuse the existing <img> nodes instead of clearing and rebuilding
           (which forced a re-decode and a visible flicker every render). */
        if (!sameUrls(urls, lastImgUrls)) {
          lastImgUrls = urls;
          for (let i = 0; i < urls.length; i++) {
            let img = imgStackEl.children[i];
            if (!img) {
              img = document.createElement('img');
              img.alt = '';
              img.classList.add('wc-img');
              imgStackEl.appendChild(img);
            }
            if (img.getAttribute('src') !== urls[i]) img.setAttribute('src', urls[i]);
          }
          while (imgStackEl.children.length > urls.length) {
            imgStackEl.removeChild(imgStackEl.children[imgStackEl.children.length - 1]);
          }
        }

        const width = urls.length === 1 ? '36px' : urls.length === 2 ? '48px' : '60px';
        if (width !== lastStackWidth) { lastStackWidth = width; imgStackEl.style.width = width; }
      }

      // "All ↑" appears only when the cart holds items from 2+ restaurants.
      if (allupEl) {
        const show = getGroups().length >= 2;
        if (show !== allupEl.classList.contains('show')) allupEl.classList.toggle('show', show);
      }
    }

    lastTotalQty = totalQty;
    lastTotalPrice = totalPrice;
    positionCartAboveNav(root);
    showCartBar(root);
  }

  function sameUrls(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* PERF: several cart changes in one event-loop turn produce ONE render.
     The cart DATA is always written immediately in updateCart(); only the
     paint is batched. Public signature is unchanged: updateGlobalCart(). */
  let renderQueued = false;
  function queueCartRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderCartBar();
    });
  }

  window.updateGlobalCart = function () {
    queueCartRender();
  };

  /* ── 5. INITIALIZATION ── */
  let initialized = false;

  function init() {
    if (initialized) return;      // belt-and-braces: never register twice
    initialized = true;

    injectCSS();
    removeLegacyCartBars();

    const root = makeDOM();
    if (CART_BAR_MODE === 'hidden') root.style.display = 'none';
    document.body.appendChild(root);
    cacheRefs(root);
    watchBottomNavigation();

    window.__ewOpenCartDrawer = openCartDrawer;
    window.__ewOpenRestaurantCarts = openRestaurantCarts;
    ensureCartDrawer(); // drawer exists in every mode so the home "All ↑" can open it

    // "All ↑" → open the restaurant-level cart details.
    if (allupEl) allupEl.addEventListener('click', (e) => { e.stopPropagation(); openRestaurantCarts(); });

    // Capture the food image that was tapped, for the cart-bar thumbnail stack.
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .counter-btn, [onclick*="updateCart"]');
      if (!btn) return;

      let foodName = "";
      const clickCode = btn.getAttribute('onclick');
      if (clickCode) {
        if (clickCode.includes('%7B')) {
          try {
            const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
            if (match) { const payload = JSON.parse(decodeURIComponent(match[1])); foodName = payload.name; }
          } catch (err) {}
        } else {
          const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
          if (match) foodName = match[1];
        }
      }

      // PERF: bail out before walking the tree when this click can never
      // produce a dictionary entry — this runs on EVERY click on the page.
      if (!foodName) return;

      let wrapper = btn;
      let capturedImg = "";
      let depth = 0;
      while (wrapper && wrapper !== document.body && depth < 8) { // PERF: bounded walk
        const img = wrapper.querySelector('img');
        if (img && img.src && !img.id.includes('wc-dynamic') && !img.src.includes('.svg')) { capturedImg = img.src; break; }
        wrapper = wrapper.parentElement;
        depth++;
      }

      if (capturedImg) {
        // PERF: in-memory dictionary, written through only on a real change.
        const dict = getImageDict();
        if (dict[foodName] === capturedImg) return;
        dict[foodName] = capturedImg;
        const serialized = JSON.stringify(dict);
        try { localStorage.setItem(IMG_DICT_KEY, serialized); } catch (err) {}
        dictRaw = serialized;
        dictObj = dict;
      }
    }, true);

    const wcLeft = root.querySelector('.wc-left');
    if (wcLeft) {
      wcLeft.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = 'cart.html'; }
      });
    }

    // Clear-cart flow (home only — guarded so pink mode never throws).
    const closeBtn = document.getElementById('wc-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (stdActionsEl) stdActionsEl.style.display = 'none';
      if (clearActionsEl) clearActionsEl.style.display = 'flex';
    });

    const cancelClear = document.getElementById('wc-cancel-clear');
    if (cancelClear) cancelClear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (clearActionsEl) clearActionsEl.style.display = 'none';
      if (stdActionsEl) stdActionsEl.style.display = 'flex';
    });

    const confirmClear = document.getElementById('wc-confirm-clear');
    if (confirmClear) confirmClear.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(CHECKOUT_KEY);
      } catch (err) {}
      // Same shared event so homepage cards immediately return to "+".
      try { document.dispatchEvent(new CustomEvent('eatswada:cart-updated', { detail: { source: 'clearCart', cleared: true } })); } catch (e2) {}
      isDismissed = false;
      const r = getRoot();
      if (r) { r.classList.remove('wc-enter', 'wc-exiting'); r.style.display = 'none'; }
      lastTotalQty = null;
      lastTotalPrice = null;
      // PERF/correctness: drop every cached total and snapshot, then run ONE
      // forced render so the drawer and the "All ↑" capsule are refreshed too.
      invalidateCartCache();
      resetRenderCaches();
      forceNextRender = true;
      queueCartRender();
    });

    bindViewportListeners();
    positionCartAboveNav(root);

    renderCartBar(); // first paint is synchronous — no empty-frame flash
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Late safety net for a bottom nav created inside a wrapper after load.
  window.addEventListener('load', () => {
    if (getBottomNav()) { stopNavCreationWatch(); schedulePos(); }
  }, { once: true });

  /* ── Cross-tab sync ──────────────────────────────────────────────
     Only our own two keys are acted on (e.key === null means the other
     tab called localStorage.clear()). Refresh the cache, invalidate the
     snapshot, queue exactly one visual update.
     Note: this deliberately does NOT re-broadcast 'eatswada:cart-updated',
     so no other page script's behaviour changes. Add the dispatch here if
     you ever want homepage cards to resync across tabs too.
     ─────────────────────────────────────────────────────────────── */
  window.addEventListener('storage', (e) => {
    if (!e) return;
    if (e.key !== null && e.key !== CART_KEY && e.key !== IMG_DICT_KEY) return;
    invalidateCartCache();
    invalidateImageDict();
    forceNextRender = true;
    queueCartRender();
  });

  window.addEventListener('pageshow', () => {
    isDismissed = false;
    removeLegacyCartBars();
    // bfcache restore: every cache may be stale, so re-read from scratch.
    invalidateCartCache();
    invalidateImageDict();
    resetNavCache();
    forceNextRender = true;
    if (window.updateGlobalCart) window.updateGlobalCart();
    schedulePos();
  });

})();
