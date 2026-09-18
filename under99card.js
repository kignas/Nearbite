/* Eatswada 99 Store — Restaurant Card Component
 * Keeps the 99 Store restaurant card isolated from under99.html.
 * Expects the new /api/restaurants/under99 response shape.
 */
(() => {
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const CART_KEY = 'nearbite_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch (_) { return {}; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function cartKey(item, restaurant) {
    // Preserve compatibility with the existing Eatswada cart while avoiding
    // collisions when two restaurants use the same dish name.
    return String(item.id || item._id || `${restaurant.id || 'restaurant'}|${item.name}`);
  }

  function getQuantity(item, restaurant) {
    const cart = getCart();
    const key = cartKey(item, restaurant);
    if (cart[key]) return Number(cart[key].quantity || 0);

    // Backward compatibility with the old name-keyed cart.
    if (cart[item.name] && !cart[item.name].resId) return Number(cart[item.name].quantity || 0);
    return 0;
  }

  function changeCart(item, restaurant, delta) {
    if (!item?.inStock && delta > 0) return;

    const cart = getCart();
    const key = cartKey(item, restaurant);
    const existing = cart[key] || {
      quantity: 0,
      price: num(item.price),
      originalPrice: item.originalPrice ?? null,
      resId: String(restaurant.id || ''),
      menuItem: String(item.id || item._id || ''),
      image: item.image || '',
      name: item.name || 'Item',
      isVeg: Boolean(item.isVeg),
    };

    existing.quantity = Number(existing.quantity || 0) + delta;
    if (existing.quantity <= 0) delete cart[key];
    else cart[key] = existing;

    saveCart(cart);
    document.dispatchEvent(new CustomEvent('eatswada:cart-updated', { detail: { item, restaurant } }));
    if (typeof window.updateGlobalCart === 'function') window.updateGlobalCart();

    const host = document.querySelector(`[data-under99-restaurant="${CSS.escape(String(restaurant.id))}"]`);
    if (host) refreshCard(host, restaurant);
  }

  function addControl(item, restaurant) {
    const quantity = getQuantity(item, restaurant);
    const disabled = item.inStock === false;

    if (quantity > 0) {
      return `<div class="u99-stepper" role="group" aria-label="Quantity for ${esc(item.name)}">
        <button type="button" data-action="minus" aria-label="Remove one">−</button>
        <span>${quantity}</span>
        <button type="button" data-action="plus" aria-label="Add one">+</button>
      </div>`;
    }

    if (disabled) {
      return `<button type="button" class="u99-add u99-add-disabled" disabled aria-label="${esc(item.name)} unavailable">Unavailable</button>`;
    }

    return `<button type="button" class="u99-add" data-action="add" aria-label="Add ${esc(item.name)}">+</button>`;
  }

  function imageMarkup(item) {
    if (!item.image) {
      return `<div class="u99-image-fallback" aria-hidden="true"><span>Food</span></div>`;
    }
    return `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('u99-hidden')">
      <div class="u99-image-fallback u99-hidden" aria-hidden="true"><span>Food</span></div>`;
  }

  function itemMarkup(item, restaurant) {
    const original = item.originalPrice != null && num(item.originalPrice) > num(item.price)
      ? num(item.originalPrice) : null;
    const discount = item.discountPercent != null && num(item.discountPercent) > 0
      ? Math.round(num(item.discountPercent)) : null;
    const dietary = item.isVeg
      ? '<span class="u99-dietary" aria-label="Vegetarian"></span>'
      : '<span class="u99-dietary u99-nonveg" aria-label="Non-vegetarian"></span>';
    const popular = item.isBestseller || item.isRecommended
      ? '<span class="u99-popular">Popular</span>' : '';

    return `<article class="u99-item" data-item-id="${esc(item.id || item._id || '')}">
      <div class="u99-item-image">
        ${popular}
        ${imageMarkup(item)}
        <div class="u99-item-action" data-item-action="1">${addControl(item, restaurant)}</div>
      </div>
      <div class="u99-item-name">${dietary}<span>${esc(item.name || 'Item')}</span></div>
      <div class="u99-price-row">
        <span class="u99-price">₹${num(item.price)}</span>
        ${original != null ? `<span class="u99-old-price">₹${original}</span>` : ''}
        ${discount != null ? `<span class="u99-off">${discount}% OFF</span>` : ''}
      </div>
    </article>`;
  }

  function restaurantOffer(restaurant, menu) {
    const offer = String(restaurant.offer || '').trim();
    const match = offer.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match) return `${Math.round(Number(match[1]))}% LOWER PRICES`;
    if (offer) return esc(offer);

    const discounted = menu.filter(i => i.originalPrice != null && num(i.originalPrice) > num(i.price));
    if (discounted.length) {
      const max = Math.max(...discounted.map(i => num(i.discountPercent, 0)));
      if (max > 0) return `${max}% LOWER PRICES`;
    }
    return 'LOWER PRICES';
  }

  function ratingMarkup(restaurant) {
    const rating = num(restaurant.rating, 0);
    const count = restaurant.ratingCount != null && restaurant.ratingCount !== ''
      ? ` <span class="u99-rating-count">(${esc(restaurant.ratingCount)})</span>` : '';
    return `<span class="u99-rating"><span class="u99-star">★</span><span>${rating ? rating.toFixed(1) : '—'}</span>${count}</span>`;
  }

  function freeDeliveryMarkup(restaurant) {
    if (restaurant.freeDeliveryAbove == null) return '';
    return `<div class="u99-free-row">
      <span class="u99-free-icon" aria-hidden="true">%</span>
      <span>Free delivery above ₹${num(restaurant.freeDeliveryAbove)}</span>
      <button class="u99-info" type="button" data-action="info" aria-label="Free delivery information">i</button>
    </div>`;
  }

  function refreshCard(host, restaurant) {
    const menu = Array.isArray(restaurant.menu) ? [...restaurant.menu] : [];
    menu.sort((a, b) => num(a.price) - num(b.price));
    host.innerHTML = cardMarkup(restaurant, menu);
    bindCard(host, restaurant);
  }

  function cardMarkup(restaurant, menu) {
    const id = String(restaurant.id || restaurant._id || '');
    const cuisine = String(restaurant.cuisine || '').trim();
    const delivery = String(restaurant.deliveryTime || '').trim();
    const visibleMenu = menu.length ? menu : [];

    return `<article class="u99-restaurant-card">
      <button class="u99-restaurant-head" type="button" data-action="restaurant" aria-label="Open ${esc(restaurant.name || 'restaurant')}">
        <div class="u99-card-copy">
          <div class="u99-discount-line">${restaurantOffer(restaurant, visibleMenu)}</div>
          <h2 class="u99-restaurant-name">${esc(restaurant.name || 'Restaurant')}</h2>
          <div class="u99-meta">
            ${ratingMarkup(restaurant)}
            ${delivery ? '<span class="u99-sep">•</span><span class="u99-delivery"><span class="u99-clock">◷</span>' + esc(delivery) + '</span>' : ''}
            ${cuisine ? '<span class="u99-sep">•</span><span class="u99-cuisine">' + esc(cuisine) + '</span>' : ''}
          </div>
          ${freeDeliveryMarkup(restaurant)}
        </div>
        <span class="u99-stamp" aria-hidden="true"><span>EVERYDAY</span><b>LOWEST PRICE</b><span>EVERYDAY</span></span>
      </button>

      <div class="u99-carousel-wrap">
        <div class="u99-carousel" tabindex="0" aria-label="${esc(restaurant.name || 'Restaurant')} menu">
          ${visibleMenu.map(item => itemMarkup(item, restaurant)).join('')}
        </div>
        ${visibleMenu.length > 3 ? '<div class="u99-scroll-hint" aria-hidden="true">→</div>' : ''}
      </div>

      <button class="u99-full-menu" type="button" data-action="full-menu">
        <span>View full menu</span><span aria-hidden="true">→</span>
      </button>
    </article>`;
  }

  function bindCard(host, restaurant) {
    const id = String(restaurant.id || restaurant._id || '');

    host.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (event) => {
        const action = button.dataset.action;
        if (action === 'add' || action === 'plus' || action === 'minus') {
          event.stopPropagation();
          const itemEl = button.closest('.u99-item');
          const itemId = itemEl?.dataset.itemId;
          const item = restaurant.menu?.find(x => String(x.id || x._id || '') === String(itemId));
          if (!item) return;
          changeCart(item, restaurant, action === 'minus' ? -1 : 1);
        }
        if (action === 'restaurant' || action === 'full-menu') {
          event.stopPropagation();
          if (id) window.location.href = `restaurant.html?id=${encodeURIComponent(id)}`;
        }
        if (action === 'info') {
          event.stopPropagation();
          const value = restaurant.freeDeliveryAbove;
          if (typeof window.showToast === 'function') window.showToast(`Free delivery above ₹${num(value)}`);
        }
      });
    });

    // Make horizontal swiping feel native while preventing vertical page jumps.
    const carousel = host.querySelector('.u99-carousel');
    if (carousel) carousel.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        carousel.scrollLeft += event.deltaY;
      }
    }, { passive: true });
  }

  function createRestaurantCard(restaurant) {
    const host = document.createElement('div');
    host.className = 'u99-card-host';
    host.dataset.under99Restaurant = String(restaurant.id || restaurant._id || '');
    const menu = Array.isArray(restaurant.menu) ? [...restaurant.menu].sort((a, b) => num(a.price) - num(b.price)) : [];
    host.innerHTML = cardMarkup(restaurant, menu);
    bindCard(host, restaurant);
    return host;
  }

  function injectStyles() {
    if (document.getElementById('under99-card-styles')) return;
    const style = document.createElement('style');
    style.id = 'under99-card-styles';
    style.textContent = `
      .u99-card-host{display:block}
      .u99-restaurant-card{background:#fff;border:1px solid #e7e8eb;border-radius:21px;box-shadow:0 3px 16px rgba(16,24,40,.055);padding:14px;overflow:hidden}
      .u99-restaurant-head{position:relative;width:100%;padding:0 70px 0 0;border:0;background:transparent;text-align:left;color:#101828;display:block}
      .u99-card-copy{min-width:0}
      .u99-discount-line{color:#e11d8d;font-size:15px;line-height:1.15;font-weight:900;letter-spacing:-.2px;margin-bottom:5px}
      .u99-restaurant-name{margin:0 0 7px;font-size:22px;line-height:1.12;font-weight:900;letter-spacing:-.65px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .u99-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;color:#424850;font-size:12px;font-weight:600;line-height:1.35}
      .u99-rating{display:inline-flex;align-items:center;gap:5px;color:#30353b;white-space:nowrap}
      .u99-star{color:#f4aa22;font-size:18px;line-height:1}
      .u99-rating-count{color:#747b84;font-weight:500}
      .u99-sep{color:#a8adb4}
      .u99-delivery{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
      .u99-clock{font-size:19px;color:#59616b;line-height:1}
      .u99-cuisine{max-width:44%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .u99-free-row{margin-top:8px;display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#262c33}
      .u99-free-icon{width:22px;height:22px;display:grid;place-items:center;color:#fff;background:#16865a;border-radius:7px;flex:0 0 22px;font-size:12px;font-weight:900}
      .u99-info{width:17px;height:17px;border:0;border-radius:50%;background:transparent;color:#9298a0;display:grid;place-items:center;font-size:11px;font-weight:800;padding:0;margin-left:1px}
      .u99-stamp{position:absolute;right:-1px;top:-1px;width:72px;height:72px;border:2px solid rgba(225,29,141,.32);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:rgba(225,29,141,.55);font-size:6.5px;line-height:1.15;font-weight:900;transform:rotate(-11deg);pointer-events:none;gap:2px}
      .u99-stamp b{font-size:8px;background:#ff8fc7;color:#fff;padding:3px 4px;border-radius:3px;transform:rotate(-4deg);letter-spacing:.1px}
      .u99-carousel-wrap{position:relative}
      .u99-carousel{display:flex;gap:11px;overflow-x:auto;scroll-snap-type:x mandatory;padding:13px 0 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
      .u99-carousel::-webkit-scrollbar{display:none}
      .u99-item{min-width:calc((100% - 22px)/3);width:calc((100% - 22px)/3);scroll-snap-align:start;overflow:visible}
      .u99-item-image{position:relative;width:100%;aspect-ratio:1.06/1;border-radius:15px;overflow:hidden;background:#f0f1f3;border:1px solid #e9eaed}
      .u99-item-image img{width:100%;height:100%;object-fit:cover;display:block}
      .u99-image-fallback{position:absolute;inset:0;display:grid;place-items:center;color:#aeb4bc;background:#f0f1f3;font-size:10px;font-weight:700}
      .u99-hidden{display:none}
      .u99-popular{position:absolute;left:7px;top:7px;z-index:2;background:#fff;color:#16865a;border-radius:999px;padding:5px 9px;font-size:10px;line-height:1;font-weight:900;box-shadow:0 2px 8px rgba(16,24,40,.08)}
      .u99-item-action{position:absolute;right:7px;bottom:7px;z-index:3}
      .u99-add{width:43px;height:43px;border-radius:50%;border:3px solid #ff9ed1;background:#fff;color:#e11d8d;display:grid;place-items:center;box-shadow:0 3px 9px rgba(16,24,40,.13);font-size:28px;line-height:1;font-weight:500;padding:0}
      .u99-add:active{transform:scale(.93)}
      .u99-add-disabled{font-size:8px;width:52px;height:34px;border-width:1.5px;color:#9aa0a8;border-color:#ddd;cursor:not-allowed}
      .u99-stepper{height:37px;min-width:88px;padding:0 4px;border:1.5px solid #e11d8d;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:space-between;box-shadow:0 3px 9px rgba(16,24,40,.12)}
      .u99-stepper button{width:28px;height:30px;border:0;background:transparent;color:#e11d8d;font-size:18px;font-weight:900;display:grid;place-items:center;padding:0}
      .u99-stepper span{font-size:12px;font-weight:900;color:#171a20}
      .u99-item-name{margin:8px 2px 0;min-height:36px;display:flex;align-items:flex-start;gap:6px;font-size:13px;line-height:1.28;font-weight:700;color:#171a20}
      .u99-dietary{width:17px;height:17px;flex:0 0 17px;margin-top:0;border:1.7px solid #16865a;border-radius:4px;display:grid;place-items:center}
      .u99-dietary:after{content:"";width:7px;height:7px;border-radius:50%;background:#16865a}
      .u99-dietary.u99-nonveg{border-color:#dc2446}
      .u99-dietary.u99-nonveg:after{width:0;height:0;border-radius:0;background:none;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid #dc2446}
      .u99-price-row{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:7px 2px 0}
      .u99-price{font-size:18px;font-weight:900;color:#111827}
      .u99-old-price{font-size:11px;color:#8d939b;text-decoration:line-through}
      .u99-off{background:#fff0f8;color:#e11d8d;padding:5px 8px;border-radius:999px;font-size:9px;line-height:1;font-weight:900;white-space:nowrap}
      .u99-full-menu{width:100%;margin-top:10px;padding:8px 2px 1px;border:0;border-top:1px solid #f0f1f3;background:#fff;color:#e11d8d;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:800}
      .u99-scroll-hint{position:absolute;right:2px;top:17px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(16,24,40,.1);color:#e11d8d;font-weight:900;pointer-events:none}
      @media(max-width:430px){.u99-restaurant-card{padding:13px;border-radius:20px}.u99-restaurant-name{font-size:20px}.u99-discount-line{font-size:14px}.u99-item{min-width:calc((100% - 22px)/3);width:calc((100% - 22px)/3)}}
      @media(max-width:370px){.u99-restaurant-name{font-size:18px}.u99-meta,.u99-free-row{font-size:11px}.u99-item-name{font-size:12px}.u99-price{font-size:16px}}
    `;
    document.head.appendChild(style);
  }

  injectStyles();
  window.Eatswada99Card = { createRestaurantCard, refreshCard, changeCart };
})();


/* Pixel-match override injected for Meals Under ₹99 page */
(() => {
  if (document.getElementById('u99-pixel-match-overrides')) return;
  const css = `
:root{--ink:#07152D;--muted:#6B7488;--soft:#FAFBFD;--line:#E8ECF2;--pink:#EC168C;--pink-soft:#FFF0F8;--green:#09965F;--gold:#FFB21D}
html,body{background:var(--soft)!important;color:var(--ink)!important}body{padding-bottom:0!important}.store-header{background:rgba(250,251,253,.98)!important;border-bottom:0!important;box-shadow:none!important}.header-top{height:98px!important;padding:14px 24px 8px!important;gap:22px!important}.header-left{gap:22px!important}.icon-btn{width:70px!important;height:70px!important;flex-basis:70px!important;border:1.5px solid #DFE4EC!important;box-shadow:none!important;background:#fff!important}.icon-btn svg{width:32px!important;height:32px!important;stroke-width:2.8!important}.header-title{font-size:29px!important;line-height:1.08!important;font-weight:900!important;letter-spacing:-.75px!important;color:var(--ink)!important}.header-sub{margin-top:7px!important;font-size:20px!important;line-height:1.15!important;font-weight:500!important;color:var(--muted)!important}.filter-row{padding:20px 24px 25px!important;gap:14px!important}.filter-pill{height:64px!important;padding:0 24px!important;border-radius:34px!important;border:1.5px solid #DFE4EC!important;background:#fff!important;color:#101828!important;font-size:22px!important;font-weight:600!important;gap:11px!important;box-shadow:none!important}.filter-pill:first-child{width:70px!important;padding:0!important;justify-content:center!important}.filter-pill svg{width:25px!important;height:25px!important}.filter-pill.active{background:var(--pink-soft)!important;border-color:#F7BEDC!important;color:var(--pink)!important;font-weight:700!important}main{max-width:864px!important;margin:0 auto!important;padding:0 24px 36px!important}.items-found-label,.bottom-nav{display:none!important}.restaurant-feed{gap:28px!important}.u99-restaurant-card{border:1.5px solid var(--line)!important;border-radius:28px!important;box-shadow:0 8px 26px rgba(7,21,45,.035)!important;padding:24px!important;background:#fff!important}.u99-restaurant-head{padding-right:150px!important}.u99-discount-line{font-size:25px!important;line-height:1.05!important;font-weight:900!important;letter-spacing:-.55px!important;color:var(--pink)!important;margin-bottom:7px!important}.u99-restaurant-name{font-size:34px!important;line-height:1.08!important;font-weight:900!important;letter-spacing:-1px!important;color:var(--ink)!important;margin-bottom:14px!important;white-space:normal!important}.u99-meta{font-size:20px!important;line-height:1.2!important;font-weight:500!important;color:var(--muted)!important;gap:14px!important;flex-wrap:nowrap!important}.u99-rating{gap:10px!important;color:var(--ink)!important;font-weight:700!important}.u99-star{font-size:31px!important;color:var(--gold)!important}.u99-rating-count{color:var(--muted)!important;font-weight:500!important}.u99-clock{font-size:29px!important;color:var(--muted)!important}.u99-cuisine{max-width:285px!important}.u99-free-row{margin-top:16px!important;font-size:20px!important;font-weight:700!important;color:var(--ink)!important;gap:12px!important}.u99-free-icon{width:30px!important;height:30px!important;flex-basis:30px!important;border-radius:8px!important;background:var(--green)!important;font-size:18px!important}.u99-info{width:24px!important;height:24px!important;border:2px solid #8B95A5!important;color:#718096!important;font-size:15px!important}.u99-stamp{right:18px!important;top:12px!important;width:118px!important;height:118px!important;border:3px solid rgba(236,22,140,.55)!important;color:rgba(236,22,140,.64)!important;font-size:13px!important;letter-spacing:1px!important}.u99-stamp b{font-size:15px!important;padding:8px 11px!important;border-radius:6px!important;background:#F267B0!important;color:#fff!important}.u99-carousel{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:20px!important;overflow:visible!important;padding:26px 0 0!important}.u99-item{min-width:0!important;width:auto!important}.u99-item:nth-child(n+4){display:none!important}.u99-item-image{aspect-ratio:1.55/1!important;border-radius:15px!important;border:0!important;background:#F2F4F7!important}.u99-popular{left:8px!important;top:8px!important;padding:9px 16px!important;border-radius:999px!important;font-size:18px!important;color:var(--green)!important;background:#fff!important;font-weight:900!important}.u99-item-action{right:16px!important;bottom:8px!important;transform:translateY(12px)!important}.u99-add{width:64px!important;height:64px!important;border:3px solid #EC168C!important;color:#EC168C!important;font-size:45px!important;font-weight:500!important;box-shadow:0 4px 10px rgba(7,21,45,.16)!important}.u99-item-name{margin:14px 0 0!important;min-height:54px!important;font-size:20px!important;line-height:1.25!important;font-weight:700!important;color:var(--ink)!important;gap:9px!important}.u99-dietary{width:23px!important;height:23px!important;flex-basis:23px!important;border-width:2.2px!important;border-radius:4px!important;margin-top:1px!important}.u99-dietary:after{width:9px!important;height:9px!important}.u99-price-row{margin-top:10px!important;gap:12px!important;flex-wrap:nowrap!important}.u99-price{font-size:28px!important;line-height:1!important;font-weight:900!important;color:var(--ink)!important}.u99-old-price{font-size:20px!important;color:#8A94A3!important;text-decoration:line-through!important;font-weight:600!important}.u99-off{font-size:18px!important;line-height:1!important;font-weight:800!important;color:var(--pink)!important;background:var(--pink-soft)!important;border-radius:999px!important;padding:12px 17px!important;margin-left:auto!important}.u99-full-menu,.u99-scroll-hint{display:none!important}
@media(max-width:430px){.header-top{height:76px!important;padding:10px 14px 5px!important;gap:12px!important}.header-left{gap:12px!important}.icon-btn{width:48px!important;height:48px!important;flex-basis:48px!important}.icon-btn svg{width:23px!important;height:23px!important}.header-title{font-size:20px!important}.header-sub{font-size:13px!important}.filter-row{padding:12px 14px 16px!important;gap:8px!important}.filter-pill{height:44px!important;padding:0 14px!important;font-size:14px!important}.filter-pill:first-child{width:48px!important}main{padding:0 14px 24px!important}.u99-restaurant-card{border-radius:22px!important;padding:15px!important}.u99-restaurant-head{padding-right:84px!important}.u99-discount-line{font-size:16px!important}.u99-restaurant-name{font-size:22px!important}.u99-meta,.u99-free-row{font-size:13px!important;gap:7px!important}.u99-star{font-size:20px!important}.u99-clock{font-size:18px!important}.u99-stamp{width:72px!important;height:72px!important;font-size:7px!important}.u99-stamp b{font-size:8px!important;padding:4px 5px!important}.u99-carousel{gap:11px!important}.u99-item-image{aspect-ratio:1.3/1!important}.u99-add{width:43px!important;height:43px!important;font-size:30px!important}.u99-item-name{font-size:13px!important;min-height:36px!important}.u99-price{font-size:18px!important}.u99-old-price{font-size:12px!important}.u99-off{font-size:10px!important;padding:7px 9px!important}}
`;
  const style = document.createElement('style');
  style.id = 'u99-pixel-match-overrides';
  style.textContent = css;
  document.head.appendChild(style);
})();
