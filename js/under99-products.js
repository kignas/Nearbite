(() => {
  const S=window.Eatswada99State,E=window.Eatswada99;
  const bandMatch=(price,band)=>band==='99'?price<=99:band==='100'?price>=100&&price<=149:band==='150'?price>=150&&price<=200:true;
  function filtered(){
    const groups=[];
    S.restaurants.forEach(r=>{
      let items=r.menu.filter(x=>bandMatch(x.price,S.priceBand));
      if(S.foodType==='veg')items=items.filter(x=>x.isVeg);
      if(S.foodType==='nonveg')items=items.filter(x=>!x.isVeg);
      if(S.priceRanges.length)items=items.filter(x=>S.priceRanges.some(range=>{const [lo,hi]=range.split('-').map(Number);return x.price>=lo&&x.price<=hi}));
      if(S.deliveryLimit!=null&&E.deliveryMax(r.deliveryTime)>S.deliveryLimit)return;
      if(S.discountOnly)items=items.filter(x=>x.discountPercent!=null?x.discountPercent>=20:(x.originalPrice>x.price));
      items.filter(x=>x.inStock).forEach(item=>groups.push({item,r}));
    });
    if(S.sortMode==='price')groups.sort((a,b)=>a.item.price-b.item.price||a.item.name.localeCompare(b.item.name));
    if(S.sortMode==='rating')groups.sort((a,b)=>b.r.rating-a.r.rating||b.r.ratingCount-a.r.ratingCount);
    if(S.sortMode==='default')groups.sort((a,b)=>(b.item.isBestseller?1:0)-(a.item.isBestseller?1:0)||(b.item.isRecommended?1:0)-(a.item.isRecommended?1:0)||a.item.price-b.item.price);
    return groups;
  }
  function card({item,r}){
    const old=item.originalPrice&&item.originalPrice>item.price?item.originalPrice:null;
    const off=item.discountPercent!=null?Math.round(item.discountPercent):old?Math.round((1-item.price/old)*100):null;
    const rating=r.rating?`<span class="u99-rating">★ ${E.esc(r.rating)}</span>`:'';
    const delivery=r.deliveryTime?`<span class="u99-meta-dot">•</span><span>${E.esc(r.deliveryTime)}</span>`:'';
    return `<article class="u99-product-card" data-menu-id="${E.esc(item.id)}" data-restaurant-id="${E.esc(r.id)}">
      <div class="u99-product-image">
        <img src="${E.esc(item.image)}" alt="${E.esc(item.name)}" loading="lazy" decoding="async">
        ${item.isBestseller?'<span class="u99-badge bestseller">Bestseller</span>':item.isRecommended?'<span class="u99-badge">Popular</span>':''}
        <span class="u99-food-marker ${item.isVeg?'':'nonveg'}" aria-label="${item.isVeg?'Veg':'Non-veg'}"></span>
        ${E.renderAddControl(item,r)}
      </div>
      <div class="u99-product-body">
        <h3 class="u99-product-name">${E.esc(item.name)}</h3>
        <div class="u99-product-meta">${rating}${rating&&delivery?'<span class="u99-meta-dot">•</span>':''}${delivery.replace('<span class="u99-meta-dot">•</span>','')}</div>
        <div class="u99-restaurant-name">${E.esc(r.name)}</div>
        <div class="u99-product-price-row"><span class="u99-current-price">₹${Math.round(item.price)}</span>${old?`<span class="u99-old-price">₹${Math.round(old)}</span>`:''}${off?`<span class="u99-discount">${off}% OFF</span>`:''}</div>
      </div>
    </article>`;
  }
  function render(){
    const grid=document.getElementById('u99-product-grid');if(!grid)return;
    const groups=filtered(),count=document.getElementById('u99-count');
    count.textContent=`${groups.length} ${groups.length===1?'item':'items'}`;
    if(!groups.length){grid.innerHTML='<div class="u99-empty"><div class="u99-empty-icon">⌕</div><strong>No dishes found</strong><span>Try another filter or price range.</span></div>';return}
    grid.innerHTML=groups.map(card).join('');
  }
  document.addEventListener('eatswada99:data-ready',render);
  document.addEventListener('eatswada99:filters-changed',render);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-sort-option]');if(b){S.sortMode=b.dataset.sortOption;document.querySelectorAll('.u99-sort-option').forEach(x=>x.classList.toggle('selected',x.dataset.sortOption===S.sortMode));document.getElementById('u99-sort-backdrop')?.classList.remove('open');document.body.classList.remove('u99-modal-open');render();}});
  window.Eatswada99Products={render,filtered};
})();
