/* =====================================================================
   99 STORE — PRICE RANGE CAPSULE
   Moves the sliding thumb, flips active/aria-selected, and dispatches the
   SAME 'eatswada99:filters-changed' event. State key (S.priceBand) and the
   filtering contract are unchanged — products.js recomputes count + grid.
   ===================================================================== */
(() => {
  const S = window.Eatswada99State;
  const tabs = () => Array.from(document.querySelectorAll('.u99-price-seg [data-price-band]'));

  function sync() {
    const list = tabs();
    if (!list.length) return;
    let i = list.findIndex(x => x.dataset.priceBand === S.priceBand);
    if (i < 0) i = 0;
    const thumb = document.querySelector('.u99-price-thumb');
    if (thumb) thumb.style.transform = 'translateX(' + (i * 100) + '%)';
    list.forEach((x, idx) => {
      const on = idx === i;
      x.classList.toggle('active', on);
      x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('.u99-price-seg [data-price-band]');
    if (!b) return;
    if (S.priceBand === b.dataset.priceBand) return;   // no-op re-tap
    S.priceBand = b.dataset.priceBand;
    sync();                                            // 1. animate capsule
    document.dispatchEvent(new Event('eatswada99:filters-changed')); // 2-4. re-filter, recount, keep cart
  });

  document.addEventListener('eatswada99:data-ready', sync);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
})();
