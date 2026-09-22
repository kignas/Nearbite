(() => {
  const API='https://eatswada.onrender.com/api/restaurants/under99';
  const HERO_API='https://eatswada.onrender.com/api/home-banners?placement=under99';
  const CART_KEY='nearbite_cart';
  const state=window.Eatswada99State={
    restaurants:[], discountOnly:true, foodType:'all',
    priceRanges:[], deliveryLimit:null, priceBand:'99', sortMode:'default'
  };
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f};
  const qs=id=>document.getElementById(id);
  const deliveryMax=v=>{const m=String(v||'').match(/\d+/g);return m?.length?Math.max(...m.map(Number)):Infinity};

  function normalizeRestaurant(raw){
    const r=raw?.restaurant&&typeof raw.restaurant==='object'?raw.restaurant:raw;
    const sourceMenu=Array.isArray(raw?.menu)?raw.menu:(Array.isArray(r?.menu)?r.menu:[]);
    const menu=sourceMenu.map(item=>({
      id:String(item?.id||item?._id||''), name:item?.name||'Item', description:item?.description||'',
      price:num(item?.price), originalPrice:item?.originalPrice==null?null:num(item.originalPrice),
      discountPercent:item?.discountPercent==null?null:num(item.discountPercent), image:item?.image||'',
      isVeg:Boolean(item?.isVeg), category:item?.category||'Recommended',
      isUnder99:Boolean(item?.isUnder99??num(item?.price)<=99), isBestseller:Boolean(item?.isBestseller),
      isRecommended:Boolean(item?.isRecommended), inStock:item?.inStock!==false,
      customizations:Array.isArray(item?.customizations)?item.customizations:[]
    })).filter(x=>x.id&&x.price>0);
    return {
      id:String(r?.id||r?._id||''), name:r?.name||'Restaurant', rating:num(r?.rating),
      ratingCount:r?.ratingCount??'', deliveryTime:String(r?.deliveryTime||''),
      estimatedDeliveryMin:num(r?.estimatedDeliveryMin), estimatedDeliveryMax:num(r?.estimatedDeliveryMax),
      cuisine:Array.isArray(r?.cuisine)?r.cuisine.join(', '):String(r?.cuisine||''),
      freeDeliveryAbove:r?.freeDeliveryAbove==null?null:num(r.freeDeliveryAbove), menu
    };
  }
  async function fetchJson(url,timeout=15000){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
    try{const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}
    finally{clearTimeout(t)}
  }
  async function loadHero(){
    try{const result=await fetchJson(HERO_API,12000),b=Array.isArray(result?.data)?result.data[0]:null;const image=String(b?.mobileImage||b?.image||'').trim();if(image){const el=qs('u99-hero-art');el.src=image;el.hidden=false}}
    catch(e){console.warn('[99 Store] hero artwork unavailable',e)}
  }
  async function load(){
    const skeleton=qs('u99-skeleton'),grid=qs('u99-product-grid'); skeleton?.classList.remove('u99-hidden');
    try{
      const result=await fetchJson(API,30000),raw=Array.isArray(result?.data)?result.data:(Array.isArray(result)?result:[]);
      state.restaurants=raw.map(normalizeRestaurant).filter(r=>r.id&&r.menu.length);
      if(!state.restaurants.length)throw new Error('No qualifying restaurant data returned');
      document.dispatchEvent(new Event('eatswada99:data-ready'));
    }catch(e){console.error('[99 Store] load failed',e);if(grid)grid.innerHTML='<div class="u99-empty"><strong>Couldn’t load deals</strong><span>We could not load the deals right now. Please try again.</span><button class="u99-retry" type="button" onclick="location.reload()">Try again</button></div>';document.dispatchEvent(new CustomEvent('eatswada99:data-error',{detail:e}))}
    finally{skeleton?.classList.add('u99-hidden')}
  }
  function readCart(){try{const p=JSON.parse(localStorage.getItem(CART_KEY)||'{}');return p&&typeof p==='object'&&!Array.isArray(p)?p:{}}catch{return{}}}
  function cartQty(menuItemId,restaurantId){
    const mid=String(menuItemId||''),rid=String(restaurantId||'');if(!mid)return 0;let q=0;const cart=readCart();
    for(const k in cart){const e=cart[k];if(e&&String(e.menuItem||'')===mid&&String(e.resId||'')===rid)q+=num(e.quantity)}
    return q;
  }
  function cartPayload(item,r){
    const price=num(item.price),original=item.originalPrice!=null&&num(item.originalPrice)>price?num(item.originalPrice):null;
    return encodeURIComponent(JSON.stringify({name:item.name,price,originalPrice:original,resId:String(r.id),menuItem:String(item.id),image:item.image||'',isVeg:Boolean(item.isVeg)}));
  }
  function cartChange(item,r,delta){
    if(typeof window.updateCart!=='function'){console.error('[99 Store] updateCart unavailable');window.showToast?.('Cart is still loading');return}
    if(!item.id){console.error('[99 Store] real menu item id missing',item);window.showToast?.('This item is unavailable');return}
    window.updateCart(cartPayload(item,r),delta>0?1:-1);
  }
  function findItem(menuItemId,restaurantId){const r=state.restaurants.find(x=>x.id===String(restaurantId));const item=r?.menu.find(x=>x.id===String(menuItemId));return item&&r?{item,r}:null}
  function addControlInner(item,r){
    const qty=cartQty(item.id,r.id);
    if(qty>0)return `<div class="u99-stepper" role="group" aria-label="Quantity in cart"><button type="button" class="u99-step-btn" data-cart-dec aria-label="Remove one ${esc(item.name)}">−</button><span class="u99-step-qty" aria-live="polite">${qty}</span><button type="button" class="u99-step-btn" data-cart-inc aria-label="Add one ${esc(item.name)}">+</button></div>`;
    return `<button type="button" class="u99-add-btn" data-cart-add aria-label="Add ${esc(item.name)}">+</button>`;
  }
  function renderAddControl(item,r){return `<div class="u99-add-control" data-mi="${esc(item.id)}" data-ri="${esc(r.id)}">${addControlInner(item,r)}</div>`}
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-cart-add],[data-cart-inc],[data-cart-dec]');if(!btn)return;const control=btn.closest('.u99-add-control');if(!control)return;e.preventDefault();e.stopPropagation();const hit=findItem(control.dataset.mi,control.dataset.ri);if(!hit)return;cartChange(hit.item,hit.r,btn.hasAttribute('data-cart-dec')?-1:1)});
  function syncAddControls(){document.querySelectorAll('.u99-add-control').forEach(c=>{const hit=findItem(c.dataset.mi,c.dataset.ri);if(hit)c.innerHTML=addControlInner(hit.item,hit.r)})}
  document.addEventListener('eatswada:cart-updated',syncAddControls);
  window.Eatswada99={esc,num,deliveryMax,qs,load,loadHero,state,renderAddControl,syncAddControls};
})();
