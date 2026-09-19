/*
 * Eatswada 99 Store — Premium Card v2
 *
 * Contract with under99.html:
 *   window.Eatswada99Card.createRestaurantCard(restaurant)
 *   window.Eatswada99Card.refreshCard(host, restaurant)
 *   window.Eatswada99Card.changeCart(item, restaurant, delta)
 *
 * Cart contract:
 *   localStorage key: nearbite_cart
 *   compatible with cart.html + the existing floating cart-bar.js.
 *
 * Design rule:
 *   The benchmark informs hierarchy, spacing, typography and icon language.
 *   Food-tile proportions are intentionally kept tall/wide (1.46:1), not
 *   copied from the shorter benchmark tiles.
 */
(() => {
  'use strict';

  const CART_KEY = 'nearbite_cart';
  const esc = v => String(v ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = (v, fallback=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const idOf = x => String(x?.id || x?._id || '');

  function getCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch (_) { return {}; }
  }
  function saveCart(cart){
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {}
  }

  /* Unique normal-item key. cart.html does not require the key to be the name;
     it renders the stored `name` field and adjusts using the same key. */
  function cartKey(item, restaurant){
    const iid = idOf(item);
    const rid = idOf(restaurant);
    return iid ? `u99:${rid}:${iid}` : `u99:${rid}:${String(item?.name || 'item').trim()}`;
  }

  function getQuantity(item, restaurant){
    const cart = getCart();
    const key = cartKey(item, restaurant);
    if (cart[key]) return Math.max(0, Number(cart[key].quantity || 0));

    /* Read older normal-item entries without breaking them. */
    const legacy = cart[item?.name];
    if (legacy && String(legacy.resId || '') === idOf(restaurant)) {
      return Math.max(0, Number(legacy.quantity || 0));
    }
    return 0;
  }

  function dispatchCartUpdated(item, restaurant){
    document.dispatchEvent(new CustomEvent('eatswada:cart-updated', {
      detail:{ item, restaurant }
    }));
    if (typeof window.updateGlobalCart === 'function') {
      try { window.updateGlobalCart(); } catch (_) {}
    }
  }

  function changeCart(item, restaurant, delta){
    if (!item || !restaurant || !delta) return;
    if (item.inStock === false && delta > 0) return;

    const cart = getCart();
    const key = cartKey(item, restaurant);
    const existing = cart[key] || {
      quantity: 0,
      price: num(item.price),
      originalPrice: item.originalPrice != null ? num(item.originalPrice) : null,
      resId: idOf(restaurant),
      menuItem: idOf(item),
      image: item.image || item.img || item.imageUrl || '',
      name: item.name || 'Item',
      isVeg: item.isVeg === true,
      restaurantName: restaurant.name || ''
    };

    existing.quantity = Number(existing.quantity || 0) + delta;
    if (existing.quantity <= 0) delete cart[key];
    else cart[key] = existing;

    saveCart(cart);
    dispatchCartUpdated(item, restaurant);
    syncCard(document.querySelector(`[data-under99-restaurant="${cssEscape(idOf(restaurant))}"]`), restaurant);
  }

  function cssEscape(v){
    try { return CSS.escape(String(v)); }
    catch (_) { return String(v).replace(/[^a-zA-Z0-9_-]/g,'\\$&'); }
  }

  const ICON = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.7 2.55 5.17 5.71.83-4.13 4.03.98 5.69L12 16.74l-5.11 2.68.98-5.69-4.13-4.03 5.71-.83L12 3.7Z" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5v4.9l3.2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.7v5.1M12 7.55h.01" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 8.2h11.6l.8 11.1H5.4L6.2 8.2Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 9V6.8a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
  };

  function ratingBadge(r){
    const rating = num(r.rating);
    const count = r.ratingCount != null ? Number(r.ratingCount) : 0;
    const countText = count > 0 ? ` <span class="u99v2-rating-count">(${formatCount(count)})</span>` : '';
    return `<span class="u99v2-rating">${ICON.star}<b>${rating ? rating.toFixed(1) : '—'}</b>${countText}</span>`;
  }

  function formatCount(n){
    n = Number(n) || 0;
    if (n >= 1000000) return `${(n/1000000).toFixed(1).replace(/\.0$/,'')}m`;
    if (n >= 1000) return `${(n/1000).toFixed(1).replace(/\.0$/,'')}k`;
    return String(Math.round(n));
  }

  function customGroups(item){
    const g = item && (item.customizations || item.customizationGroups || item.customization || item.customGroups);
    return Array.isArray(g) ? g.filter(x => x && Array.isArray(x.options) && x.options.length) : [];
  }
  function isCustomisable(item){
    return !!item && (item.isCustomisable === true || item.customisable === true || customGroups(item).length > 0);
  }

  /* ───────────────────────── Customization sheet ───────────────────────── */
  let customState = null;
  let customSheet = null;

  function ensureCustomizationSheet(){
    if (customSheet) return customSheet;

    const wrap = document.createElement('div');
    wrap.id = 'u99v2-custom-root';
    wrap.innerHTML = `
      <div class="u99v2-cs-backdrop" data-cs-close></div>
      <section class="u99v2-cs-sheet" role="dialog" aria-modal="true" aria-labelledby="u99v2-cs-title">
        <button class="u99v2-cs-close" type="button" data-cs-close aria-label="Close">×</button>
        <div class="u99v2-cs-grab"></div>
        <div class="u99v2-cs-head">
          <div class="u99v2-cs-diet" id="u99v2-cs-diet"></div>
          <div><h3 id="u99v2-cs-title">Customize item</h3><p id="u99v2-cs-sub">Choose your options</p></div>
        </div>
        <div class="u99v2-cs-body" id="u99v2-cs-body"></div>
        <div class="u99v2-cs-footer">
          <div class="u99v2-cs-qty"><button type="button" data-cs-minus>−</button><b id="u99v2-cs-qty">1</b><button type="button" data-cs-plus>+</button></div>
          <button type="button" class="u99v2-cs-add" id="u99v2-cs-add">Add item</button>
        </div>
      </section>`;
    document.body.appendChild(wrap);

    const close = () => closeCustomization();
    wrap.addEventListener('click', e => { if (e.target.closest('[data-cs-close]')) close(); });
    wrap.querySelector('[data-cs-minus]').addEventListener('click', () => {
      if (!customState) return;
      customState.qty = Math.max(1, customState.qty - 1);
      wrap.querySelector('#u99v2-cs-qty').textContent = customState.qty;
      refreshCustomization();
    });
    wrap.querySelector('[data-cs-plus]').addEventListener('click', () => {
      if (!customState) return;
      customState.qty = Math.min(20, customState.qty + 1);
      wrap.querySelector('#u99v2-cs-qty').textContent = customState.qty;
      refreshCustomization();
    });
    wrap.querySelector('#u99v2-cs-body').addEventListener('change', refreshCustomization);
    wrap.querySelector('#u99v2-cs-add').addEventListener('click', confirmCustomization);

    customSheet = wrap;
    return wrap;
  }

  function openCustomize(item, restaurant){
    const groups = customGroups(item);
    if (!groups.length) { changeCart(item, restaurant, 1); return; }
    const root = ensureCustomizationSheet();
    customState = { item, restaurant, groups, qty: 1, unit: num(item.price) };

    root.querySelector('#u99v2-cs-title').textContent = item.name || 'Customize item';
    root.querySelector('#u99v2-cs-sub').textContent = `Base price ₹${Math.round(num(item.price))}`;
    root.querySelector('#u99v2-cs-qty').textContent = '1';
    root.querySelector('#u99v2-cs-diet').className = `u99v2-cs-diet ${item.isVeg === false ? 'nonveg' : 'veg'}`;

    const body = root.querySelector('#u99v2-cs-body');
    body.innerHTML = groups.map((g, gi) => {
      const max = Math.max(1, Number(g.maxSelect || 1));
      const multi = max > 1;
      const required = g.required === true;
      const rule = multi ? `Select up to ${max}` : (required ? 'Required · Select 1' : 'Select 1');
      const options = g.options.map((o, oi) => {
        const extra = num(o.extraPrice);
        const inputType = multi ? 'checkbox' : 'radio';
        const checked = (!multi && required && oi === 0) ? 'checked' : '';
        return `<label class="u99v2-opt">
          <span class="u99v2-opt-dot ${o.isVeg === false ? 'nonveg' : ''}"></span>
          <span class="u99v2-opt-name">${esc(o.label || 'Option')}</span>
          ${extra > 0 ? `<span class="u99v2-opt-price">+₹${Math.round(extra)}</span>` : `<span class="u99v2-opt-free">${required || multi ? 'Free' : ''}</span>`}
          <input type="${inputType}" name="u99v2-g-${gi}" value="${oi}" data-extra="${extra}" ${checked}>
        </label>`;
      }).join('');
      return `<div class="u99v2-group" data-max="${max}" data-required="${required ? '1':'0'}" data-multi="${multi ? '1':'0'}">
        <div class="u99v2-group-head"><b>${esc(g.title || 'Options')}</b><span>${rule}</span></div>${options}</div>`;
    }).join('');

    refreshCustomization();
    root.classList.add('open');
    document.body.classList.add('u99v2-sheet-open');
  }

  function refreshCustomization(){
    if (!customState || !customSheet) return;
    let extra = 0, valid = true;
    customSheet.querySelectorAll('.u99v2-group').forEach(group => {
      const multi = group.dataset.multi === '1';
      const max = Number(group.dataset.max) || 1;
      const required = group.dataset.required === '1';
      const checked = [...group.querySelectorAll('input:checked')];
      extra += checked.reduce((sum, el) => sum + num(el.dataset.extra), 0);
      if (required && checked.length < 1) valid = false;
      if (multi) {
        const full = checked.length >= max;
        group.querySelectorAll('input[type="checkbox"]').forEach(input => { if (!input.checked) input.disabled = full; });
      }
    });
    customState.unit = num(customState.item.price) + extra;
    const add = customSheet.querySelector('#u99v2-cs-add');
    add.disabled = !valid;
    add.textContent = valid ? `Add item · ₹${Math.round(customState.unit * customState.qty)}` : 'Select required options';
  }

  function confirmCustomization(){
    if (!customState || !customSheet) return;
    const add = customSheet.querySelector('#u99v2-cs-add');
    if (add.disabled) return;

    const selections = [];
    const labels = [];
    customSheet.querySelectorAll('.u99v2-group').forEach((group, gi) => {
      const title = customState.groups[gi]?.title || 'Options';
      group.querySelectorAll('input:checked').forEach(input => {
        const option = customState.groups[gi]?.options?.[Number(input.value)];
        const label = option?.label || 'Option';
        labels.push(label);
        selections.push({
          title,
          label,
          extraPrice: num(input.dataset.extra),
          isVeg: option?.isVeg !== false
        });
      });
    });

    const item = customState.item;
    const restaurant = customState.restaurant;
    const unit = customState.unit;
    const baseName = item.name || 'Item';
    const displayName = labels.length ? `${baseName} (${labels.join(', ')})` : baseName;
    const key = `u99c:${idOf(restaurant)}:${idOf(item)}:${labels.map(x => x.toLowerCase()).join('|') || 'base'}`;
    const cart = getCart();

    if (cart[key]) {
      cart[key].quantity = Number(cart[key].quantity || 0) + customState.qty;
    } else {
      cart[key] = {
        quantity: customState.qty,
        price: unit,
        originalPrice: num(item.originalPrice) > num(item.price) ? num(item.originalPrice) + (unit - num(item.price)) : null,
        resId: idOf(restaurant),
        menuItem: idOf(item),
        image: item.image || item.img || item.imageUrl || '',
        name: displayName,
        isVeg: item.isVeg !== false,
        restaurantName: restaurant.name || '',
        customizations: selections
      };
    }
    saveCart(cart);
    const state = customState;
    closeCustomization();
    dispatchCartUpdated(state.item, state.restaurant);
    syncCard(document.querySelector(`[data-under99-restaurant="${cssEscape(idOf(state.restaurant))}"]`), state.restaurant);
  }

  function closeCustomization(){
    if (!customSheet) return;
    customSheet.classList.remove('open');
    document.body.classList.remove('u99v2-sheet-open');
    customState = null;
  }

  function customizedQuantity(item, restaurant){
    const cart = getCart();
    const iid = idOf(item), rid = idOf(restaurant), baseName = String(item.name || '').trim();
    let total = 0;
    Object.entries(cart).forEach(([key, info]) => {
      if (!info || Number(info.quantity || 0) <= 0) return;
      if (String(info.resId || '') !== rid) return;
      if (iid && String(info.menuItem || '') === iid && (key.startsWith('u99c:') || String(info.name || '') === baseName || String(info.name || '').startsWith(baseName + ' ('))) {
        total += Number(info.quantity || 0);
      }
    });
    return total;
  }

  /* ─────────────────────────── Card rendering ──────────────────────────── */
  function itemImage(item){
    const src = item.image || item.img || item.imageUrl || '';
    if (!src) return `<div class="u99v2-fallback" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18h16M6 16l3.2-5 3.2 3 2.7-5 3.9 7"/></svg></div>`;
    return `<img src="${esc(src)}" alt="${esc(item.name || 'Food')}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="u99v2-fallback" hidden aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18h16M6 16l3.2-5 3.2 3 2.7-5 3.9 7"/></svg></div>`;
  }

  function actionControl(item, restaurant){
    if (item.inStock === false) return `<button type="button" class="u99v2-add disabled" disabled>Unavailable</button>`;
    if (isCustomisable(item)) {
      const qty = customizedQuantity(item, restaurant);
      return `<button type="button" class="u99v2-add custom" data-action="customize" aria-label="Customize ${esc(item.name)}">ADD${qty > 0 ? `<span class="u99v2-qty-dot">${qty}</span>` : ''}</button>`;
    }
    const qty = getQuantity(item, restaurant);
    if (qty > 0) return `<div class="u99v2-stepper" role="group" aria-label="${esc(item.name)} quantity"><button type="button" data-action="minus">−</button><b>${qty}</b><button type="button" data-action="plus">+</button></div>`;
    return `<button type="button" class="u99v2-add" data-action="add" aria-label="Add ${esc(item.name)}">ADD</button>`;
  }

  function itemMarkup(item, restaurant){
    const price = num(item.price);
    const original = num(item.originalPrice) > price ? num(item.originalPrice) : 0;
    const discount = original ? Math.round((1 - price/original) * 100) : num(item.discountPercent);
    const dietary = item.isVeg === true ? '<span class="u99v2-diet veg" aria-label="Veg"></span>' : item.isVeg === false ? '<span class="u99v2-diet nonveg" aria-label="Non-veg"></span>' : '';
    const popular = item.isBestseller || item.isRecommended ? '<span class="u99v2-popular">Popular</span>' : '';

    return `<article class="u99v2-item" data-item-id="${esc(idOf(item))}">
      <div class="u99v2-image">
        ${itemImage(item)}
        ${popular}
        <div class="u99v2-action">${actionControl(item, restaurant)}</div>
      </div>
      <div class="u99v2-item-name">${dietary}<span>${esc(item.name || 'Item')}</span></div>
      <div class="u99v2-price"><b>₹${Math.round(price)}</b>${original ? `<del>₹${Math.round(original)}</del>` : ''}${discount > 0 ? `<span>${Math.round(discount)}% OFF</span>` : ''}</div>
    </article>`;
  }

  function offerText(r){
    const raw = String(r.offer || '').trim();
    const match = raw.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match) return `${Math.round(Number(match[1]))}% LOWER PRICES`;
    if (r.discountPercent != null && num(r.discountPercent) > 0) return `${Math.round(num(r.discountPercent))}% LOWER PRICES`;
    if (/lower|off|deal|discount/i.test(raw)) return raw.toUpperCase();
    return 'LOWER PRICES';
  }

  function cardMarkup(r, menu){
    const cuisine = String(r.cuisine || '').trim();
    const delivery = String(r.deliveryTime || '').trim();
    const free = r.freeDeliveryAbove != null ? `<div class="u99v2-free">${ICON.bag}<span>Free delivery above ₹${Math.round(num(r.freeDeliveryAbove))}</span><button type="button" data-action="info" aria-label="Free delivery information">${ICON.info}</button></div>` : '';

    return `<article class="u99v2-card">
      <button type="button" class="u99v2-head" data-action="restaurant" aria-label="Open ${esc(r.name || 'restaurant')}">
        <div class="u99v2-offer">${esc(offerText(r))}</div>
        <div class="u99v2-title-row"><h2>${esc(r.name || 'Restaurant')}</h2><span class="u99v2-head-arrow">${ICON.arrow}</span></div>
        <div class="u99v2-meta">${ratingBadge(r)}${delivery ? `<i>•</i><span class="u99v2-delivery">${ICON.clock}${esc(delivery)}</span>` : ''}${cuisine ? `<i>•</i><span class="u99v2-cuisine">${esc(cuisine)}</span>` : ''}</div>
        ${free}
      </button>
      <div class="u99v2-rule"></div>
      <div class="u99v2-carousel" tabindex="0" aria-label="${esc(r.name || 'Restaurant')} menu">${menu.map(item => itemMarkup(item, r)).join('')}</div>
    </article>`;
  }

  function sortedMenu(r){
    return Array.isArray(r.menu)
      ? [...r.menu].filter(x => x && num(x.price) > 0).sort((a,b) => num(a.price)-num(b.price) || String(a.name||'').localeCompare(String(b.name||'')))
      : [];
  }

  const data = new WeakMap();

  function findItem(r, id){
    return (r.menu || []).find(x => idOf(x) === String(id));
  }

  function bindHost(host, restaurant){
    if (!host || host.__u99v2Bound) return;
    host.__u99v2Bound = true;
    data.set(host, restaurant);
    host.addEventListener('click', e => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl || !host.contains(actionEl)) return;
      const action = actionEl.dataset.action;
      const r = data.get(host);
      if (!r) return;
      e.preventDefault();
      e.stopPropagation();
      if (action === 'restaurant') {
        const rid = idOf(r);
        if (rid) window.location.href = `restaurant.html?id=${encodeURIComponent(rid)}`;
        return;
      }
      if (action === 'info') {
        const msg = `Free delivery above ₹${Math.round(num(r.freeDeliveryAbove))}`;
        if (typeof window.showToast === 'function') window.showToast(msg);
        else if (typeof window.toast === 'function') window.toast(msg);
        return;
      }
      const item = findItem(r, actionEl.closest('.u99v2-item')?.dataset.itemId);
      if (!item) return;
      if (action === 'customize') openCustomize(item, r);
      else if (action === 'add' || action === 'plus') changeCart(item, r, 1);
      else if (action === 'minus') changeCart(item, r, -1);
    });

    const carousel = host.querySelector('.u99v2-carousel');
    if (carousel) {
      carousel.addEventListener('wheel', e => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) carousel.scrollLeft += e.deltaY;
      }, {passive:true});
    }
  }

  function syncCard(host, restaurant){
    if (!host || !restaurant) return;
    const menu = sortedMenu(restaurant);
    host.querySelectorAll('.u99v2-item').forEach(itemEl => {
      const item = findItem(restaurant, itemEl.dataset.itemId);
      if (!item) return;
      const action = itemEl.querySelector('.u99v2-action');
      if (action) action.innerHTML = actionControl(item, restaurant);
    });
  }

  function refreshCard(host, restaurant){
    if (!host || !restaurant) return;
    const menu = sortedMenu(restaurant);
    host.innerHTML = cardMarkup(restaurant, menu);
    bindHost(host, restaurant);
  }

  function createRestaurantCard(restaurant){
    ensureStyles();
    const host = document.createElement('div');
    host.className = 'u99v2-host';
    host.dataset.under99Restaurant = idOf(restaurant);
    refreshCard(host, restaurant);
    return host;
  }

  /* Repaint only controls after an external cart mutation (cart restore,
     checkout return, another component, etc.). */
  document.addEventListener('eatswada:cart-updated', () => {
    document.querySelectorAll('[data-under99-restaurant]').forEach(host => {
      const r = data.get(host);
      if (r) syncCard(host, r);
    });
  });

  /* ───────────────────────────────── CSS ───────────────────────────────── */
  function ensureStyles(){
    if (document.getElementById('u99v2-card-styles')) return;
    const style = document.createElement('style');
    style.id = 'u99v2-card-styles';
    style.textContent = `
      .u99v2-host{display:block;min-width:0}
      .u99v2-card{background:#fff;border:1px solid #E7E9ED;border-radius:22px;padding:16px 15px 15px;box-shadow:0 5px 20px rgba(20,24,35,.055);overflow:hidden}
      .u99v2-head{display:block;width:100%;border:0;background:transparent;padding:0;text-align:left;color:#15171B;cursor:pointer}
      .u99v2-offer{font-size:12px;line-height:1;font-weight:850;letter-spacing:.15px;color:#E51488;text-transform:uppercase;margin-bottom:6px}
      .u99v2-title-row{display:flex;align-items:center;gap:7px;min-width:0}
      .u99v2-title-row h2{margin:0;font-size:20px;line-height:1.1;font-weight:820;letter-spacing:-.48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .u99v2-head-arrow{margin-left:auto;width:22px;height:22px;display:grid;place-items:center;color:#8B929C;flex:0 0 22px}
      .u99v2-head-arrow svg{width:18px;height:18px}
      .u99v2-meta{display:flex;align-items:center;gap:5px;margin-top:8px;min-width:0;color:#727984;font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden}
      .u99v2-meta i{font-style:normal;color:#C8CCD2}
      .u99v2-rating{display:inline-flex;align-items:center;gap:4px;color:#30353C;flex:0 0 auto}
      .u99v2-rating svg{width:16px;height:16px;color:#159A62}
      .u99v2-rating b{font-weight:800}
      .u99v2-rating-count{font-weight:500;color:#858B94}
      .u99v2-delivery{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto}
      .u99v2-delivery svg{width:15px;height:15px}
      .u99v2-cuisine{overflow:hidden;text-overflow:ellipsis;min-width:0}
      .u99v2-free{display:flex;align-items:center;gap:5px;margin-top:7px;font-size:11.5px;font-weight:650;color:#354052;white-space:nowrap}
      .u99v2-free>svg:first-child{width:17px;height:17px;color:#159A62;flex:0 0 17px}
      .u99v2-free span{overflow:hidden;text-overflow:ellipsis}
      .u99v2-free button{margin-left:0;padding:0;border:0;background:transparent;color:#969DA7;display:grid;place-items:center;cursor:pointer}
      .u99v2-free button svg{width:15px;height:15px}
      .u99v2-rule{height:1px;background:#EEF0F3;margin:13px 0 12px}
      .u99v2-carousel{display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 20px)/3);gap:10px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:none;padding:0 1px 2px}
      .u99v2-carousel::-webkit-scrollbar{display:none}
      .u99v2-item{min-width:0;scroll-snap-align:start}
      .u99v2-image{position:relative;width:100%;aspect-ratio:1.46/1;border-radius:16px;overflow:hidden;background:#F1F2F4}
      .u99v2-image>img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;background:#F1F2F4}
      .u99v2-fallback{position:absolute;inset:0;display:grid;place-items:center;color:#B7BDC6;background:#F1F2F4}
      .u99v2-fallback svg{width:27%;height:27%;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
      .u99v2-popular{position:absolute;top:7px;left:7px;padding:4px 7px;border-radius:7px;background:rgba(20,24,31,.78);color:#fff;font-size:8.5px;font-weight:800;letter-spacing:.15px}
      .u99v2-action{position:absolute;right:7px;bottom:7px;z-index:2}
      .u99v2-add,.u99v2-stepper{height:31px;border-radius:10px;background:#fff;border:1px solid #E1E4E8;box-shadow:0 4px 12px rgba(0,0,0,.11);font-size:10px;font-weight:850;color:#E51488}
      .u99v2-add{min-width:52px;padding:0 10px;cursor:pointer}
      .u99v2-add:hover{background:#FFF8FC}
      .u99v2-add.custom{position:relative}
      .u99v2-add.disabled{color:#A0A6AF;background:#F7F7F8;cursor:not-allowed;box-shadow:none}
      .u99v2-qty-dot{position:absolute;right:-5px;top:-7px;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#E51488;color:#fff;border:2px solid #fff;font-size:9px;line-height:14px}
      .u99v2-stepper{display:flex;align-items:center;overflow:hidden}
      .u99v2-stepper button{width:27px;height:30px;border:0;background:#fff;color:#E51488;font-size:17px;font-weight:750;cursor:pointer}
      .u99v2-stepper b{min-width:18px;text-align:center;font-size:10px;color:#252A31}
      .u99v2-item-name{display:flex;align-items:flex-start;gap:4px;margin-top:8px;min-height:30px;font-size:11.5px;line-height:1.28;font-weight:700;color:#252932}
      .u99v2-item-name>span:last-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .u99v2-diet{width:10px;height:10px;margin-top:2px;border:1.5px solid #159A62;border-radius:2px;position:relative;flex:0 0 10px}
      .u99v2-diet:after{content:"";position:absolute;width:4px;height:4px;border-radius:50%;background:#159A62;left:1.5px;top:1.5px}
      .u99v2-diet.nonveg{border-color:#C43B43}
      .u99v2-diet.nonveg:after{background:#C43B43}
      .u99v2-price{display:flex;align-items:center;gap:5px;margin-top:4px;min-width:0;white-space:nowrap}
      .u99v2-price b{font-size:12.5px;color:#15181D;font-weight:850}
      .u99v2-price del{font-size:9.5px;color:#9AA0A8}
      .u99v2-price span{font-size:8px;font-weight:850;color:#159A62;overflow:hidden;text-overflow:ellipsis}

      /* Customization sheet — same cart data model as restaurant/cart pages. */
      body.u99v2-sheet-open{overflow:hidden}
      #u99v2-custom-root{position:fixed;inset:0;z-index:100000;pointer-events:none}
      #u99v2-custom-root.open{pointer-events:auto}
      .u99v2-cs-backdrop{position:absolute;inset:0;background:rgba(15,18,24,.42);opacity:0;transition:opacity .22s ease}
      #u99v2-custom-root.open .u99v2-cs-backdrop{opacity:1}
      .u99v2-cs-sheet{position:absolute;left:50%;bottom:0;width:min(560px,100%);max-height:min(82vh,720px);transform:translate(-50%,105%);background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -12px 45px rgba(0,0,0,.18);transition:transform .28s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;overflow:hidden}
      #u99v2-custom-root.open .u99v2-cs-sheet{transform:translate(-50%,0)}
      .u99v2-cs-grab{width:42px;height:4px;border-radius:99px;background:#D9DCE1;margin:9px auto 4px}
      .u99v2-cs-close{position:absolute;right:14px;top:14px;width:32px;height:32px;border:0;border-radius:50%;background:#F1F2F4;color:#59606A;font-size:21px;line-height:1;cursor:pointer}
      .u99v2-cs-head{display:flex;align-items:center;gap:10px;padding:12px 18px 13px;border-bottom:1px solid #EEF0F3}
      .u99v2-cs-diet{width:13px;height:13px;border:1.7px solid #159A62;border-radius:3px;position:relative;flex:0 0 13px}
      .u99v2-cs-diet:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#159A62;left:2.2px;top:2.2px}
      .u99v2-cs-diet.nonveg{border-color:#C43B43}.u99v2-cs-diet.nonveg:after{background:#C43B43}
      .u99v2-cs-head h3{margin:0;font-size:17px;font-weight:820;color:#171A1F}
      .u99v2-cs-head p{margin:3px 0 0;font-size:11px;color:#818792}
      .u99v2-cs-body{overflow:auto;padding:4px 18px 18px}
      .u99v2-group{padding:15px 0;border-bottom:1px solid #EEF0F3}
      .u99v2-group-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}
      .u99v2-group-head b{font-size:13px;color:#20242A}.u99v2-group-head span{font-size:10px;color:#8B919A}
      .u99v2-opt{display:flex;align-items:center;gap:9px;min-height:44px;cursor:pointer}
      .u99v2-opt-dot{width:11px;height:11px;border:1.5px solid #159A62;border-radius:3px;position:relative;flex:0 0 11px}.u99v2-opt-dot:after{content:"";position:absolute;width:4px;height:4px;border-radius:50%;background:#159A62;left:2px;top:2px}.u99v2-opt-dot.nonveg{border-color:#C43B43}.u99v2-opt-dot.nonveg:after{background:#C43B43}
      .u99v2-opt-name{font-size:12px;color:#2B3037;flex:1}.u99v2-opt-price,.u99v2-opt-free{font-size:11px;color:#777E88}.u99v2-opt-price{font-weight:700}
      .u99v2-opt input{width:17px;height:17px;accent-color:#E51488;margin-left:4px}
      .u99v2-cs-footer{display:flex;gap:10px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #E9EBEF;background:#fff}
      .u99v2-cs-qty{height:48px;border:1px solid #E1E4E8;border-radius:13px;display:flex;align-items:center;overflow:hidden}.u99v2-cs-qty button{width:40px;height:48px;border:0;background:#fff;color:#E51488;font-size:19px}.u99v2-cs-qty b{min-width:28px;text-align:center;font-size:13px}
      .u99v2-cs-add{flex:1;height:48px;border:0;border-radius:13px;background:#E51488;color:#fff;font-size:13px;font-weight:800}.u99v2-cs-add:disabled{background:#D9DCE1;color:#878D96}

      @media(max-width:560px){
        .u99v2-card{border-radius:20px;padding:15px 13px 14px}
        .u99v2-carousel{grid-auto-columns:calc((100% - 18px)/3);gap:9px}
        .u99v2-title-row h2{font-size:18px}
      }
    `;
    document.head.appendChild(style);
  }

  ensureStyles();
  window.Eatswada99Card = { createRestaurantCard, refreshCard, changeCart };
})();
