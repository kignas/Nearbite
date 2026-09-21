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
  window.Eatswada99={esc,num,deliveryMax,qs,load,loadHero,state};
})();
