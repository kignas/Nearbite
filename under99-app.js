/* ==========================================================================
   99 Store — page app: data load, filters, render
   Extracted verbatim from under99.html. Must load AFTER cart-bar.js and
   under99card.js (it uses window.Eatswada99Card + window.updateGlobalCart).
   ========================================================================== */
(() => {
  const API = 'https://eatswada.onrender.com/api/restaurants/under99';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = (value, fallback=0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  let allRestaurants = [];
  let discountOnly = true;
  let sortMode = 'default';

  function showToast(message){
    const t=$('toast');
    if(!t)return;
    t.textContent=message;
    t.style.display='block';
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>t.style.display='none',1800);
  }
  window.showToast = showToast;

  function normalizeRestaurant(raw){
    const r = raw?.restaurant && typeof raw.restaurant === 'object'
      ? raw.restaurant : raw;
    const menu = Array.isArray(raw?.menu) ? raw.menu.map(item => ({
      id:item.id || item._id || item.menuItemId || item.menuItem || '',
      name:item.name || item.title || 'Item',
      description:item.description || '',
      price:num(item.price),
      originalPrice:item.originalPrice == null ? null : num(item.originalPrice),
      discountPercent:item.discountPercent == null ? null : num(item.discountPercent),
      image:item.image || '',
      isVeg:Boolean(item.isVeg),
      category:item.category || 'Recommended',
      isUnder99:Boolean(item.isUnder99 ?? num(item.price) <= 99),
      isBestseller:Boolean(item.isBestseller),
      isRecommended:Boolean(item.isRecommended),
      inStock:item.inStock !== false,
      customizations:Array.isArray(item.customizations) ? item.customizations : []
    })).filter(item => item.price > 0) : [];

    menu.sort((a,b) => a.price-b.price || String(a.name).localeCompare(String(b.name)));
    return {
      id:String(r?.id || r?._id || ''),
      name:r?.name || 'Restaurant',
      image:r?.image || '',
      images:Array.isArray(r?.images) ? r.images : [],
      rating:num(r?.rating,0),
      ratingCount:r?.ratingCount ?? '',
      deliveryTime:String(r?.deliveryTime || ''),
      cuisine:Array.isArray(r?.cuisine) ? r.cuisine.join(', ') : String(r?.cuisine || ''),
      offer:String(
        r?.offer ??
        r?.discountLabel ??
        r?.discountText ??
        (r?.discountPercent != null ? `${num(r.discountPercent)}%` : '') ??
        ''
      ),
      discountPercent: r?.discountPercent == null ? null : num(r.discountPercent),
      freeDeliveryAbove:r?.freeDeliveryAbove == null ? null : num(r.freeDeliveryAbove),
      deliveryFee:r?.deliveryFee,
      menu
    };
  }

  function passesFilters(r){
    if(deliveryLimit !== null && deliveryMaxMinutes(r.deliveryTime) > deliveryLimit){
      return { visible:[], qualifies:false };
    }
    const visible = r.menu.filter(item => {
      if(item.price > 99) return false;
      if(foodType==='veg' && !item.isVeg) return false;
      if(foodType==='nonveg' && item.isVeg) return false;
      if(priceRanges.length){
        const inRange = priceRanges.some(range => {
          const [lo,hi]=range.split('-').map(Number);
          return item.price >= lo && item.price <= hi;
        });
        if(!inRange) return false;
      }
      if(discountOnly && item.discountPercent != null && num(item.discountPercent) < 20) return false;
      return true;
    });
    return { visible, qualifies: visible.length > 0 };
  }

  function render(){
    const list=$('under99-list');
    const skeleton=$('skeleton-feed');
    if(!list)return;

    const groups = allRestaurants.map(r => ({r, ...passesFilters(r)})).filter(x => x.qualifies);

    // Flatten to an item-first list: one entry per qualifying dish, carrying
    // its parent restaurant. This is what drives the Swiggy-style grid.
    const dishes = [];
    groups.forEach(({r, visible}) => visible.forEach(item => dishes.push({item, restaurant:r})));

    if(sortMode==='price')  dishes.sort((a,b)=>num(a.item.price)-num(b.item.price));
    if(sortMode==='rating') dishes.sort((a,b)=>num(b.restaurant.rating)-num(a.restaurant.rating));

    skeleton.style.display='none';
    list.style.display='block';

    const totalItems = dishes.length;
    const anyFilter = foodType!=='all' || priceRanges.length>0 || deliveryLimit!==null || !discountOnly;
    const countEl = $('item-count');
    if(countEl){
      countEl.textContent = totalItems
        ? `${anyFilter?'':'All '}${totalItems} item${totalItems===1?'':'s'}`
        : '';
      countEl.style.display = totalItems ? 'block' : 'none';
    }

    if(!totalItems){
      list.innerHTML='<div class="empty"><div style="font-size:35px">₹</div><h3>No deals match these filters</h3><p>Try another price or food preference.</p></div>';
      return;
    }

    list.innerHTML='';
    const grid=window.Eatswada99Card.createDishGrid(dishes);
    grid.style.animation='fadeUp .3s ease both';
    list.appendChild(grid);
    if(typeof window.updateGlobalCart==='function') window.updateGlobalCart();
  }

  window.toggleDiscount=()=>{
    discountOnly=!discountOnly;
    updateFilterButtons();
    render();
  };

  let activeSheet = null;
  let deliveryLimit = null;
  let foodType = 'all';
  let priceRanges = [];

  function getSheet(name){
    if(name==='all') return $('all-sheet');
    if(name==='delivery') return $('delivery-sheet');
    if(name==='veg') return $('veg-sheet');
    if(name==='sort') return $('sort-sheet');
    return $('price-sheet');
  }

  function openFilter(name){
    const backdrop=$('filter-backdrop');
    if(!backdrop)return;
    document.querySelectorAll('.filter-sheet').forEach(s=>{
      s.hidden = s.id !== `${name}-sheet`;
    });
    activeSheet=name;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden','false');
    document.body.classList.add('filter-open');
    syncSheetInputs(name);
  }

  function closeFilter(){
    const backdrop=$('filter-backdrop');
    if(!backdrop)return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden','true');
    document.body.classList.remove('filter-open');
    setTimeout(()=>document.querySelectorAll('.filter-sheet').forEach(s=>s.hidden=true),240);
    activeSheet=null;
  }

  function syncSheetInputs(name){
    if(name==='all'){
      const d=$('all-discount');
      if(d)d.checked=discountOnly;
      document.querySelectorAll('input[name="all-food-type"]').forEach(i=>i.checked=i.value===foodType);
      document.querySelectorAll('input[name="all-price-range"]').forEach(i=>i.checked=priceRanges.includes(i.value));
    }else if(name==='delivery'){
      document.querySelectorAll('input[name="delivery-time"]').forEach(i=>i.checked=Number(i.value)===deliveryLimit);
    }else if(name==='veg'){
      document.querySelectorAll('input[name="food-type"]').forEach(i=>i.checked=i.value===foodType);
    }else if(name==='sort'){
      document.querySelectorAll('input[name="sort-mode"]').forEach(i=>i.checked=i.value===sortMode);
    }else{
      document.querySelectorAll('input[name="price-range"]').forEach(i=>i.checked=priceRanges.includes(i.value));
    }
  }

  function updateFilterButtons(){
    $('discount-btn')?.classList.toggle('active',discountOnly);
    $('veg-btn')?.classList.toggle('active',foodType!=='all');$('price-btn')?.classList.toggle('active',priceRanges.length>0);
    $('delivery-btn')?.classList.toggle('active',deliveryLimit!==null);$('sort-btn')?.classList.toggle('has-filter',
      foodType!=='all'||priceRanges.length>0||deliveryLimit!==null||!discountOnly);
    $('sort-pill')?.classList.toggle('active',sortMode!=='default');
  }

  function applyFilter(){
    if(activeSheet==='all'){
      discountOnly=Boolean($('all-discount')?.checked);
      const food=document.querySelector('input[name="all-food-type"]:checked');
      foodType=food ? food.value : 'all';
      priceRanges=[...document.querySelectorAll('input[name="all-price-range"]:checked')].map(i=>i.value);
    }else if(activeSheet==='delivery'){
      const checked=document.querySelector('input[name="delivery-time"]:checked');
      deliveryLimit=checked ? Number(checked.value) : null;
    }else if(activeSheet==='veg'){
      const checked=document.querySelector('input[name="food-type"]:checked');
      foodType=checked ? checked.value : 'all';
    }else if(activeSheet==='price'){
      priceRanges=[...document.querySelectorAll('input[name="price-range"]:checked')].map(i=>i.value);
    }else if(activeSheet==='sort'){
      const checked=document.querySelector('input[name="sort-mode"]:checked');
      sortMode=checked ? checked.value : 'default';
    }
    updateFilterButtons();
    closeFilter();
    render();
  }

  function clearFilter(){
    if(activeSheet==='all'){
      discountOnly=true;
      foodType='all';
      priceRanges=[];
      deliveryLimit=null;
    }else if(activeSheet==='delivery'){
      deliveryLimit=null;
    }else if(activeSheet==='veg'){
      foodType='all';
    }else if(activeSheet==='price'){
      priceRanges=[];
    }else if(activeSheet==='sort'){
      sortMode='default';
    }
    updateFilterButtons();
    closeFilter();
    render();
  }

  function deliveryMaxMinutes(value){
    const matches=String(value||'').match(/\d+/g);
    return matches && matches.length ? Math.max(...matches.map(Number)) : Infinity;
  }

  document.addEventListener('click', event=>{
    const open=event.target.closest('[data-open-filter]');
    if(open){ openFilter(open.dataset.openFilter); return; }
    if(event.target.closest('[data-close-filter]')){ closeFilter(); return; }
    if(event.target.closest('[data-apply-filter]')){ applyFilter(); return; }
    if(event.target.closest('[data-clear-filter]')){ clearFilter(); return; }
    if(event.target=== $('filter-backdrop')) closeFilter();
  });

  document.addEventListener('keydown', event=>{
    if(event.key==='Escape' && activeSheet) closeFilter();
  });


  /* 99 Store artwork only. The benchmark visual/text/background are fixed.
   Backend/Admin may provide the transparent food artwork only. */
  const HERO_API='https://eatswada.onrender.com/api/home-banners?placement=under99';

  async function loadUnder99Hero(){
    const art=$('u99-hero-art');
    try{
      const response=await fetch(HERO_API,{headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok) throw new Error(`Hero HTTP ${response.status}`);
      const result=await response.json();
      const banners=Array.isArray(result?.data)?result.data:[];
      const banner=banners[0];
      const image=String(banner?.mobileImage||banner?.image||'').trim();
      if(image&&art){art.src=image;art.hidden=false;}
    }catch(error){
      console.warn('[99 Store] Artwork could not be loaded:',error);
    }
  }

  async function fetchJson(url, timeoutMs=12000){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{
        headers:{Accept:'application/json'},
        cache:'no-store',
        signal:controller.signal
      });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }finally{
      clearTimeout(timer);
    }
  }

  function flattenMenuPayload(payload){
    const data=payload?.data ?? payload;
    if(Array.isArray(data)) return data;
    if(!data || typeof data!=='object') return [];

    for(const key of ['menu','items','results']){
      if(Array.isArray(data[key])) return data[key];
    }

    const groups=[];
    for(const value of Object.values(data)){
      if(Array.isArray(value)) groups.push(...value);
      else if(value && typeof value==='object'){
        for(const nested of Object.values(value)){
          if(Array.isArray(nested)) groups.push(...nested);
        }
      }
    }
    return groups;
  }

  function extractArray(payload, preferredKeys=[]){
    const seen=new Set();
    function walk(value, depth=0){
      if(depth>5 || value==null) return [];
      if(Array.isArray(value)) return value;
      if(typeof value!=='object' || seen.has(value)) return [];
      seen.add(value);
      for(const key of preferredKeys){
        if(Array.isArray(value[key])) return value[key];
      }
      for(const key of ['data','restaurants','items','results','docs','records','list']){
        if(Array.isArray(value[key])) return value[key];
      }
      for(const child of Object.values(value)){
        const found=walk(child,depth+1);
        if(found.length) return found;
      }
      return [];
    }
    return walk(payload);
  }

  async function loadRestaurantsWithMenus(){
    const result=await fetchJson(
      'https://eatswada.onrender.com/api/restaurants?limit=50&sort=rating',
      30000
    );
    const restaurants=extractArray(result,['restaurants','data']);
    if(!restaurants.length) throw new Error('Restaurant list returned no usable data');

    const enriched=await Promise.all(restaurants.slice(0,50).map(async r=>{
      const existingMenu=Array.isArray(r?.menu) ? r.menu : [];
      if(existingMenu.length) return {...r,menu:existingMenu};

      const id=String(r?._id||r?.id||r?.restaurantId||'');
      if(!id) return null;

      try{
        const menuPayload=await fetchJson(
          `https://eatswada.onrender.com/api/restaurants/${encodeURIComponent(id)}/menu`,
          15000
        );
        const menu=flattenMenuPayload(menuPayload);
        return {...r,menu};
      }catch(error){
        console.warn('[99 Store] menu load failed for',id,error);
        return null;
      }
    }));

    return enriched.filter(r=>r && Array.isArray(r.menu) && r.menu.length);
  }

  function showLoadError(message){
    const skeleton=$('skeleton-feed');
    const list=$('under99-list');
    if(skeleton)skeleton.style.display='none';
    if(!list)return;

    list.style.display='flex';
    list.innerHTML=`
      <div class="empty">
        <div style="font-size:35px">!</div>
        <h3>Couldn’t load deals</h3>
        <p>${esc(message || 'We could not load the restaurant menu data right now.')}</p>
        <button id="u99-retry" style="margin-top:14px;border:0;border-radius:999px;padding:11px 20px;background:#e11d8d;color:#fff;font-weight:800">Retry</button>
      </div>`;
    $('u99-retry')?.addEventListener('click',load);
  }

  async function load(){
    const skeleton=$('skeleton-feed');
    const list=$('under99-list');
    const MAX_ATTEMPTS=3;

    if(skeleton)skeleton.style.display='flex';
    if(list)list.style.display='none';

    let lastError=null;

    for(let attempt=1; attempt<=MAX_ATTEMPTS; attempt++){
      try{
        /*
         * PRIMARY SOURCE:
         * The current backend returns:
         * { success, count, data: [{ restaurant: {...}, menu: [...] }] }
         * from GET /api/restaurants/under99.
         */
        const result=await fetchJson(
          'https://eatswada.onrender.com/api/restaurants/under99?cb='+Date.now(),
          30000
        );

        if(result?.success===false){
          throw new Error(result.message || '99 Store API returned success:false');
        }

        const raw=Array.isArray(result?.data)
          ? result.data
          : (Array.isArray(result) ? result : []);

        console.info('[99 Store] API response:', {
          success: result?.success,
          count: result?.count,
          rows: raw.length
        });

        if(raw.length){
          const normalized=raw
            .map(rawItem=>normalizeRestaurant(rawItem))
            .filter(r=>r.id && r.menu.length);

          if(normalized.length){
            allRestaurants=normalized;
            updateFilterButtons();
            render();
            return;
          }

          throw new Error('99 Store returned rows, but no usable restaurant/menu data was found');
        }

        /*
         * If the dedicated endpoint is empty, use the normal restaurant
         * + menu endpoints as a fallback. This also helps while older
         * restaurant documents are being migrated.
         */
        console.warn('[99 Store] Dedicated endpoint returned no rows; trying restaurant/menu fallback.');
        const fallback=await loadRestaurantsWithMenus();

        const normalizedFallback=fallback
          .map(rawItem=>normalizeRestaurant(rawItem))
          .filter(r=>r.id && r.menu.length);

        if(normalizedFallback.length){
          allRestaurants=normalizedFallback;
          updateFilterButtons();
          render();
          return;
        }

        // This is a valid empty state, not a network/server error.
        allRestaurants=[];
        if(skeleton)skeleton.style.display='none';
        if(list){
          list.style.display='flex';
          list.innerHTML='<div class="empty"><div style="font-size:35px">₹</div><h3>No ₹99 deals available</h3><p>There are no qualifying restaurant deals available right now.</p></div>';
        }
        return;

      }catch(error){
        lastError=error;
        console.error(`[99 Store] load attempt ${attempt} failed:`,error);

        if(attempt<MAX_ATTEMPTS){
          await new Promise(res=>setTimeout(res, attempt*2000));
        }
      }
    }

    showLoadError(
      lastError?.message
        ? `We could not load the restaurant data. (${lastError.message})`
        : 'We could not load the restaurant menu data right now.'
    );
  }

  document.addEventListener('DOMContentLoaded',()=>{ loadUnder99Hero(); load(); });
})();
