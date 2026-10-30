/* =====================================================================
   99 STORE — BOOT + SORT SHEET (reference #03)
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const S = window.Eatswada99State;
  const backdrop = document.getElementById('u99-sort-backdrop');
  let sortDraft = S.sortMode;

  const LABELS = {
    default: 'Recommended', rating: 'Rating: High to Low',
    price: 'Price: Low to High', 'price-desc': 'Price: High to Low',
    delivery: 'Delivery time'
  };

  const syncSort = () => {
    document.querySelectorAll('.u99-sort-option').forEach(x =>
      x.classList.toggle('selected', x.dataset.sortOption === sortDraft));
  };
  const openSort = () => {
    sortDraft = S.sortMode;
    syncSort();
    backdrop?.classList.add('open');
    document.body.classList.add('u99-modal-open');
  };
  const closeSort = () => {
    backdrop?.classList.remove('open');
    document.body.classList.remove('u99-modal-open');
  };

  document.getElementById('u99-sort')?.addEventListener('click', openSort);

  document.addEventListener('click', e => {
    const opt = e.target.closest('[data-sort-option]');
    if (opt) { sortDraft = opt.dataset.sortOption; syncSort(); return; }
    if (e.target.closest('[data-sort-action="apply"]')) {
      S.sortMode = sortDraft;
      const lbl = document.getElementById('u99-sort-label');
      if (lbl) lbl.textContent = S.sortMode === 'default' ? 'Sort' : (LABELS[S.sortMode] || 'Sort');
      closeSort();
      window.Eatswada99Products?.render();
      return;
    }
    if (e.target.closest('[data-sort-action="close"]') || e.target === backdrop) closeSort();
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSort(); });

  window.Eatswada99.loadHero();

  /* Backend pricing (free-delivery / distance) is attached after the grid
     paints and the card re-rendered, so a slow pricing call never delays
     browsing. Debounced and stale-safe; failures are swallowed. */
  let pricingSeq = 0;
  const enrichPricing = () => {
    if (!window.EWRestaurantCards || !window.EWPricing) return;
    let addressId = '';
    try { addressId = localStorage.getItem('nearbite_selected_address_id') || ''; } catch (e) { addressId = ''; }
    const list = S.restaurants;
    if (!addressId || !Array.isArray(list) || !list.length) return;
    const seq = ++pricingSeq;
    window.EWRestaurantCards.enrich(list, { addressId })
      .then(res => { if (seq === pricingSeq && res && res.applied) window.Eatswada99Products?.render(); })
      .catch(() => {});
  };
  document.addEventListener('eatswada99:data-ready', enrichPricing);

  window.Eatswada99.load();
});

window.showToast = (message) => {
  const t = document.getElementById('u99-toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(window.__u99Toast);
  window.__u99Toast = setTimeout(() => t.classList.remove('show'), 1600);
};
