(() => {
  const S=window.Eatswada99State;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-price-band]');if(!b)return;S.priceBand=b.dataset.priceBand;document.querySelectorAll('[data-price-band]').forEach(x=>x.classList.toggle('active',x===b));document.dispatchEvent(new Event('eatswada99:filters-changed'));});
  document.addEventListener('eatswada99:data-ready',()=>{document.querySelectorAll('[data-price-band]').forEach(x=>x.classList.toggle('active',x.dataset.priceBand===S.priceBand));});
})();
