/* =====================================================================
   99 STORE — POPULAR DISHES RAIL  (reference #01)
   Discovery rail. Uses the SAME canonical menu-item objects as the grid.
   ===================================================================== */
(() => {
  const S = window.Eatswada99State, E = window.Eatswada99, esc = E.esc, I = window.U99Icons;

  function getPairs() {
    const seen = new Set(), pairs = [];
    S.restaurants.forEach(r => r.menu.filter(x => x.price <= 99 && x.inStock).forEach(item => {
      const key = r.id + '|' + item.id;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ item, r });
    }));
    return pairs.sort((a, b) =>
      (b.item.isBestseller ? 1 : 0) - (a.item.isBestseller ? 1 : 0) ||
      (b.item.isRecommended ? 1 : 0) - (a.item.isRecommended ? 1 : 0) ||
      a.item.price - b.item.price).slice(0, 12);
  }

  function render() {
    const rail = document.getElementById('u99-popular-rail');
    if (!rail) return;
    rail.innerHTML = getPairs().map(({ item, r }) =>
      '<article class="u99-pop-card" data-open-item data-menu-id="' + esc(item.id) +
        '" data-restaurant-id="' + esc(r.id) + '">' +
        '<div class="u99-pop-image">' +
          '<img src="' + esc(item.image) + '" alt="' + esc(item.name) + '" loading="lazy" decoding="async">' +
          '<span class="u99-food-marker sm ' + (item.isVeg ? 'veg' : 'nonveg') + '">' +
            I.icon(item.isVeg ? 'veg' : 'nonveg', { size: 14 }) + '</span>' +
          E.renderAddControl(item, r) +
        '</div>' +
        '<div class="u99-pop-name">' + esc(item.name) + '</div>' +
        '<div class="u99-pop-meta">' +
          '<span class="u99-pop-price">\u20B9' + Math.round(item.price) + '</span>' +
          (r.rating ? '<span class="u99-pop-rating">' + I.icon('star', { size: 11 }) + ' ' + esc(r.rating) +
            (r.ratingCount ? ' (' + esc(r.ratingCount) + ')' : '') + '</span>' : '') +
        '</div>' +
      '</article>').join('');
  }

  document.addEventListener('eatswada99:data-ready', render);
})();
