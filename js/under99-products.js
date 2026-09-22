(() => {
  const S=window.Eatswada99State, E=window.Eatswada99;
  // No cart writer here. All cart mutations go through the canonical
  // window.updateCart() via E.cartChange/E.renderAddControl (see core).
  function filtered(){
    let groups=[];
    S.restaurants.forEach(r=>{
      let items=r.menu.filter(x=>x.price<=99);
      if(S.priceBand==='99')items=items.filter(x=>x.price<=99);
      if(S.priceBand==='100')items=[]; // reserved for future >₹99 mode
      if(S.priceBand==='150')items=[];
      if(S.foodType==='veg')items=items.filter(x=>x.isVeg);
      if(S.foodType==='nonveg')items=items.filter(x=>!x.isVeg);
      if(S.priceRanges.length)items=items.filter(x=>S.priceRanges.some(range=>{const [lo,hi]=range.split('-').map(Number);return x.price>=lo&&x.price<=hi}));
      if(S.deliveryLimit!=null&&E.deliveryMax(r.deliveryTime)>S.deliveryLimit)return;
      if(S.discountOnly)items=items.filter(x=>x.discountPercent==null||x.discountPercent>=20);
      items.forEach(x=>groups.push({item:x,r}));
    });
    if(S.sortMode==='price')groups.sort((a,b)=>a.item.price-b.item.price);
    if(S.sortMode==='rating')groups.sort((a,b)=>b.r.rating-a.r.rating);
    return groups;
  }
  function card({item,r}){
    const old=item.originalPrice&&item.originalPrice>item.price?item.originalPrice:null;
    const off=item.discountPercent!=null?Math.round(item.discountPercent):old?Math.round((1-item.price/old)*100):null;
    return `<article class="u99-product-card">
      <div class="u99-product-image">
        <img src="${E.esc(item.image)}" alt="${E.esc(item.name)}" loading="lazy">
        ${item.isBestseller?'<span class="u99-badge bestseller">Bestseller</span>':''}
        ${!item.isBestseller&&item.isRecommended?'<span class="u99-badge">Popular</span>':''}
        <span class="u99-food-marker ${item.isVeg?'':'nonveg'}" aria-label="${item.isVeg?'Veg':'Non-veg'}"></span>
        ${E.renderAddControl(item,r)}
      </div>
      <div class="u99-product-body">
        <h3 class="u99-product-name">${E.esc(item.name)}</h3>
        <div class="u99-product-meta"><span class="u99-rating">★ ${r.rating||'4.2'}</span><span class="u99-meta-dot">•</span><span>${E.esc(r.deliveryTime||'30–40 mins')}</span></div>
        <div class="u99-restaurant-name">${E.esc(r.name)}</div>
        <div class="u99-product-price-row">
          <span class="u99-current-price">₹${Math.round(item.price)}</span>
          ${old?`<span class="u99-old-price">₹${Math.round(old)}</span>`:''}
          ${off?`<span class="u99-discount">${off}% OFF</span>`:''}
        </div>
      </div>
    </article>`;
  }
  function render(){
    const grid=document.getElementById('u99-product-grid');if(!grid)return;
    const groups=filtered();
    document.getElementById('u99-count').textContent=`${groups.length} ${groups.length===1?'item':'items'}`;
    if(!groups.length){grid.innerHTML='<div class="u99-empty"><strong>No dishes found</strong><span>Try another filter or price range.</span></div>';return}
    grid.innerHTML=groups.map(card).join('');
    // Add/stepper clicks are handled by the single delegated listener in core.
  }
  document.addEventListener('eatswada99:data-ready',render);
  document.addEventListener('eatswada99:filters-changed',render);
  document.addEventListener('click',e=>{
    const s=e.target.closest('[data-sort-option]');
    if(s){S.sortMode=s.dataset.sortOption;render()}
  });
  window.Eatswada99Products={render};
})();
