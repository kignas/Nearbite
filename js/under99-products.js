/* =====================================================================
   99 STORE — PRODUCT GRID  (reference #01 grid + #05 empty)
   Same canonical menu-item objects as Popular. Filters + sort read the
   shared state. No synthetic ids, no name-based identity.
   ===================================================================== */
(() => {
  const S = window.Eatswada99State, E = window.Eatswada99, I = window.U99Icons;

  const bandMatch = (price, band) =>
    band === '99' ? price <= 99 :
    band === '100' ? price >= 100 && price <= 149 :
    band === '150' ? price >= 150 && price <= 200 : true;

  function filtered() {
    const groups = [];
    S.restaurants.forEach(r => {
      if (S.freeDeliveryOnly && r.freeDeliveryAbove == null) return;
      if (S.deliveryLimit != null && E.deliveryMax(r.deliveryTime) > S.deliveryLimit) return;

      let items = r.menu.filter(x => bandMatch(x.price, S.priceBand));
      if (S.foodType === 'veg') items = items.filter(x => x.isVeg);
      if (S.foodType === 'nonveg') items = items.filter(x => !x.isVeg);
      if (S.priceRanges.length) items = items.filter(x => S.priceRanges.some(range => {
        const [lo, hi] = range.split('-').map(Number);
        return x.price >= lo && x.price <= hi;
      }));
      if (S.discountOnly) items = items.filter(x => x.discountPercent != null ? x.discountPercent >= 20 : (x.originalPrice > x.price));
      if (S.greatOffersOnly) items = items.filter(x => {
        const off = x.discountPercent != null ? x.discountPercent
          : (x.originalPrice > x.price ? (1 - x.price / x.originalPrice) * 100 : 0);
        return off >= 40;
      });
      items.filter(x => x.inStock).forEach(item => groups.push({ item, r }));
    });

    if (S.sortMode === 'price') groups.sort((a, b) => a.item.price - b.item.price || a.item.name.localeCompare(b.item.name));
    if (S.sortMode === 'price-desc') groups.sort((a, b) => b.item.price - a.item.price || a.item.name.localeCompare(b.item.name));
    if (S.sortMode === 'rating') groups.sort((a, b) => b.r.rating - a.r.rating || b.r.ratingCount - a.r.ratingCount);
    if (S.sortMode === 'delivery') groups.sort((a, b) => E.deliveryMax(a.r.deliveryTime) - E.deliveryMax(b.r.deliveryTime));
    if (S.sortMode === 'default') groups.sort((a, b) =>
      (b.item.isBestseller ? 1 : 0) - (a.item.isBestseller ? 1 : 0) ||
      (b.item.isRecommended ? 1 : 0) - (a.item.isRecommended ? 1 : 0) ||
      a.item.price - b.item.price);
    return groups;
  }

  function card({ item, r }) {
    const old = item.originalPrice && item.originalPrice > item.price ? item.originalPrice : null;
    const off = item.discountPercent != null ? Math.round(item.discountPercent)
      : old ? Math.round((1 - item.price / old) * 100) : null;
    const rating = r.rating
      ? '<span class="u99-rating">' + I.icon('star', { size: 11 }) + ' ' + E.esc(r.rating) +
        (r.ratingCount ? ' <span class="u99-rating-count">(' + E.esc(r.ratingCount) + ')</span>' : '') + '</span>'
      : '';
    const delivery = r.deliveryTime ? '<span>' + E.esc(r.deliveryTime) + '</span>' : '';
    const badge = item.isBestseller ? '<span class="u99-badge bestseller">Bestseller</span>'
      : item.isRecommended ? '<span class="u99-badge">Popular</span>' : '';
    return '<article class="u99-product-card" data-open-item data-menu-id="' + E.esc(item.id) +
      '" data-restaurant-id="' + E.esc(r.id) + '">' +
      '<div class="u99-product-image">' +
        '<img src="' + E.esc(item.image) + '" alt="' + E.esc(item.name) + '" loading="lazy" decoding="async">' +
        badge +
        '<span class="u99-food-marker ' + (item.isVeg ? 'veg' : 'nonveg') + '" aria-label="' +
          (item.isVeg ? 'Veg' : 'Non-veg') + '">' + I.icon(item.isVeg ? 'veg' : 'nonveg', { size: 16 }) + '</span>' +
        E.renderAddControl(item, r) +
      '</div>' +
      '<div class="u99-product-body">' +
        '<h3 class="u99-product-name">' + E.esc(item.name) + '</h3>' +
        '<div class="u99-product-meta">' + rating + (rating && delivery ? '<span class="u99-meta-dot">\u2022</span>' : '') + delivery + '</div>' +
        '<div class="u99-restaurant-name">' + E.esc(r.name) + '</div>' +
        '<div class="u99-product-price-row">' +
          '<span class="u99-current-price">\u20B9' + Math.round(item.price) + '</span>' +
          (old ? '<span class="u99-old-price">\u20B9' + Math.round(old) + '</span>' : '') +
          (off ? '<span class="u99-discount">' + off + '% OFF</span>' : '') +
        '</div>' +
      '</div></article>';
  }

  function emptyState() {
    return '<div class="u99-empty">' +
      '<div class="u99-empty-art">' +
        '<svg viewBox="0 0 88 88" width="88" height="88" fill="none" aria-hidden="true">' +
          '<rect x="14" y="34" width="60" height="40" rx="10" fill="#fff1f7"/>' +
          '<path d="M20 42h48l-4 28a6 6 0 0 1-6 5H30a6 6 0 0 1-6-5z" fill="#ffd6e7"/>' +
          '<path d="M30 30l14-14 14 14" stroke="#d80b6f" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<circle cx="34" cy="56" r="3" fill="#d80b6f"/><circle cx="54" cy="56" r="3" fill="#d80b6f"/>' +
        '</svg>' +
      '</div>' +
      '<strong>No dishes found</strong>' +
      '<span>Try another filter or price range.</span>' +
      '<button class="u99-clear-filters" type="button" data-empty-clear>Clear filters</button>' +
      '</div>';
  }

  function render() {
    const grid = document.getElementById('u99-product-grid');
    if (!grid) return;
    const groups = filtered(), count = document.getElementById('u99-count');
    if (count) count.textContent = 'All ' + groups.length + ' ' + (groups.length === 1 ? 'item' : 'items');
    grid.innerHTML = groups.length ? groups.map(card).join('') : emptyState();
  }

  function resetFilters() {
    S.discountOnly = false; S.freeDeliveryOnly = false; S.greatOffersOnly = false;
    S.deliveryLimit = null; S.foodType = 'all'; S.priceRanges = [];
    document.getElementById('u99-discount')?.classList.remove('active');
    document.querySelector('[data-rail="delivery"]')?.classList.remove('active');
    document.querySelector('[data-rail="food"]')?.classList.remove('active');
    document.dispatchEvent(new Event('eatswada99:filters-changed'));
  }

  document.addEventListener('eatswada99:data-ready', render);
  document.addEventListener('eatswada99:filters-changed', render);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-empty-clear]')) { resetFilters(); return; }
  });

  window.Eatswada99Products = { render, filtered };
})();
