(() => {
  const API='https://eatswada.onrender.com/api/restaurants/under99';
  const HERO_API='https://eatswada.onrender.com/api/home-banners?placement=under99';
  const state=window.Eatswada99State={
    restaurants:[], filtered:[], discountOnly:true, foodType:'all',
    priceRanges:[], deliveryLimit:null, priceBand:'all', sortMode:'default'
  };
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f};
  const qs=id=>document.getElementById(id);

  function deliveryMax(v){
    const m=String(v||'').match(/\d+/g);
    return m?.length?Math.max(...m.map(Number)):Infinity;
  }
  function normalizeRestaurant(raw){
    const r=raw?.restaurant&&typeof raw.restaurant==='object'?raw.restaurant:raw;
    const menu=Array.isArray(raw?.menu)?raw.menu.map(item=>({
      id:item.id||item._id||'',
      name:item.name||'Item',description:item.description||'',price:num(item.price),
      originalPrice:item.originalPrice==null?null:num(item.originalPrice),
      discountPercent:item.discountPercent==null?null:num(item.discountPercent),
      image:item.image||'',isVeg:Boolean(item.isVeg),category:item.category||'Recommended',
      isUnder99:Boolean(item.isUnder99??num(item.price)<=99),isBestseller:Boolean(item.isBestseller),
      isRecommended:Boolean(item.isRecommended),inStock:item.inStock!==false
    })).filter(x=>x.price>0):[];
    menu.sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name));
    return {
      id:String(r?.id||r?._id||''),name:r?.name||'Restaurant',rating:num(r?.rating),
      ratingCount:r?.ratingCount??'',deliveryTime:String(r?.deliveryTime||''),
      cuisine:Array.isArray(r?.cuisine)?r.cuisine.join(', '):String(r?.cuisine||''),
      freeDeliveryAbove:r?.freeDeliveryAbove==null?null:num(r.freeDeliveryAbove),menu
    };
  }
  async function fetchJson(url,timeout=15000){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:c.signal});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }finally{clearTimeout(t)}
  }
  async function loadHero(){
    try{
      const result=await fetchJson(HERO_API,12000),b=Array.isArray(result?.data)?result.data[0]:null;
      const image=String(b?.mobileImage||b?.image||'').trim();
      if(image){const el=qs('u99-hero-art');el.src=image;el.hidden=false}
    }catch(e){console.warn('[99 Store] hero artwork unavailable',e)}
  }
  async function load(){
    const skeleton=qs('u99-skeleton'),grid=qs('u99-product-grid');
    skeleton?.classList.remove('u99-hidden');
    try{
      const result=await fetchJson(API,30000);
      const raw=Array.isArray(result?.data)?result.data:(Array.isArray(result)?result:[]);
      state.restaurants=raw.map(normalizeRestaurant).filter(r=>r.id&&r.menu.length);
      if(!state.restaurants.length)throw new Error('No qualifying restaurant data returned');
      document.dispatchEvent(new Event('eatswada99:data-ready'));
    }catch(e){
      console.error('[99 Store] load failed',e);
      if(grid)grid.innerHTML='<div class="u99-empty"><strong>Couldn’t load deals</strong><span>We could not load the deals right now. Please try again.</span></div>';
      document.dispatchEvent(new CustomEvent('eatswada99:data-error',{detail:e}));
    }finally{
      skeleton?.classList.add('u99-hidden');
    }
  }
  /* ── CANONICAL CART BRIDGE ──────────────────────────────────────────
     cart-bar.js is the SINGLE owner of the cart. This page NEVER writes
     localStorage itself. Every add/remove calls the shared canonical
     window.updateCart(payload, ±1). Items are identified by their REAL
     backend menuItem id + restaurant id — never by name. */
  const CART_KEY='nearbite_cart';
  function readCart(){
    try{
      const d=localStorage.getItem(CART_KEY);
      if(!d||d==='undefined'||d==='null')return{};
      const p=JSON.parse(d);
      return (p&&typeof p==='object'&&!Array.isArray(p))?p:{};
    }catch{return{}}
  }
  // Quantity of ONE specific item, matched by (menuItem id + restaurant id)
  // across whatever keys cart-bar used — so identity is never the name.
  function cartQty(menuItemId,restaurantId){
    const mid=String(menuItemId??''),rid=String(restaurantId??'');
    if(!mid)return 0;
    const c=readCart();let q=0;
    for(const k in c){
      const e=c[k];if(!e)continue;
      if(String(e.menuItem??'')===mid && String(e.resId??'')===rid) q+=num(e.quantity);
    }
    return q;
  }
  // The exact URL-encoded JSON payload cart-bar.js's updateCart() decodes.
  function cartPayload(item,r){
    const price=num(item.price);
    const original=item.originalPrice!=null&&num(item.originalPrice)>price?num(item.originalPrice):null;
    return encodeURIComponent(JSON.stringify({
      name:item.name, price:price, originalPrice:original,
      resId:String(r.id), menuItem:String(item.id||item._id||''),
      image:item.image||'', isVeg:Boolean(item.isVeg)
    }));
  }
  function cartChange(item,r,delta){
    if(typeof window.updateCart!=='function'){console.error('[99 Store] canonical updateCart() unavailable — cart-bar.js not loaded');return;}
    if(!(item.id||item._id)){console.error('[99 Store] menu item has no backend id; refusing to add',item);return;}
    window.updateCart(cartPayload(item,r), delta>0?1:-1);
  }
  function findItem(menuItemId,restaurantId){
    const r=state.restaurants.find(x=>String(x.id)===String(restaurantId));
    const item=r&&r.menu.find(x=>String(x.id||x._id)===String(menuItemId));
    return (item&&r)?{item,r}:null;
  }
  // The +/stepper inner markup for an item, reflecting its current qty.
  function addControlInner(item,r){
    const qty=cartQty(item.id||item._id,r.id);
    return qty>0
      ? `<div class="u99-stepper" role="group" aria-label="Quantity in cart"><button type="button" class="u99-step-btn" data-cart-dec aria-label="Remove one ${esc(item.name)}">−</button><span class="u99-step-qty" aria-live="polite">${qty}</span><button type="button" class="u99-step-btn" data-cart-inc aria-label="Add one ${esc(item.name)}">+</button></div>`
      : `<button type="button" class="u99-add-btn" data-cart-add aria-label="Add ${esc(item.name)}">+</button>`;
  }
  // Full control container, carrying the ids used for lookup/sync.
  function renderAddControl(item,r){
    return `<div class="u99-add-control" data-mi="${esc(item.id||item._id)}" data-ri="${esc(r.id)}">${addControlInner(item,r)}</div>`;
  }
  // ONE delegated click handler for every add-control on the page
  // (product grid AND popular rail share it).
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-cart-add],[data-cart-inc],[data-cart-dec]');
    if(!btn)return;
    const control=btn.closest('.u99-add-control');if(!control)return;
    e.preventDefault();e.stopPropagation();
    const hit=findItem(control.dataset.mi,control.dataset.ri);
    if(!hit)return;
    cartChange(hit.item,hit.r, btn.hasAttribute('data-cart-dec')?-1:1);
  });
  // When the cart changes anywhere (this page, home, restaurant, clear),
  // re-sync every control's qty in place — no full re-render, no image reload.
  function syncAddControls(){
    document.querySelectorAll('.u99-add-control').forEach(control=>{
      const hit=findItem(control.dataset.mi,control.dataset.ri);
      if(hit)control.innerHTML=addControlInner(hit.item,hit.r);
    });
  }
  document.addEventListener('eatswada:cart-updated',syncAddControls);

  window.Eatswada99={esc,num,deliveryMax,qs,load,loadHero,state,renderAddControl,syncAddControls};
})();
