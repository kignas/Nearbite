(() => {
  const S=window.Eatswada99State, E=window.Eatswada99;
  const cartKey='nearbite_cart';
  const cart=()=>{try{return JSON.parse(localStorage.getItem(cartKey))||{}}catch{return{}}};
  const save=c=>localStorage.setItem(cartKey,JSON.stringify(c));
  function add(item,r){
    const c=cart(),k=String(item.id||`${r.id}|${item.name}`);
    const x=c[k]||{quantity:0,price:item.price,resId:r.id,menuItem:item.id,name:item.name,image:item.image,isVeg:item.isVeg};
    x.quantity++;c[k]=x;save(c);
    document.dispatchEvent(new CustomEvent('eatswada:cart-updated',{detail:{item,restaurant:r}}));
    if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();
    if(window.showToast)window.showToast(`${item.name} added`);
  }
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
        <button class="u99-product-add" data-add-item="${E.esc(item.id)}" data-add-restaurant="${E.esc(r.id)}" aria-label="Add ${E.esc(item.name)}">+</button>
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
    document.querySelectorAll('[data-add-item]').forEach(btn=>btn.addEventListener('click',()=>{
      const r=S.restaurants.find(x=>x.id===btn.dataset.addRestaurant);const item=r?.menu.find(x=>String(x.id)===btn.dataset.addItem);
      if(item&&r)add(item,r);
    }));
  }
  document.addEventListener('eatswada99:data-ready',render);
  document.addEventListener('eatswada99:filters-changed',render);
  document.addEventListener('click',e=>{
    const s=e.target.closest('[data-sort-option]');
    if(s){S.sortMode=s.dataset.sortOption;render()}
  });
  window.Eatswada99Products={render};
})();
