/* Eatswada 99 Store — isolated restaurant card component */
(() => {
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = (v, fallback=0) => { const n=Number(v); return Number.isFinite(n)?n:fallback; };
  const CART_KEY='nearbite_cart';

  function getCart(){ try{return JSON.parse(localStorage.getItem(CART_KEY))||{};}catch(_){return{};} }
  function saveCart(c){localStorage.setItem(CART_KEY,JSON.stringify(c));}
  function normalizeId(value){return String(value==null?'':value).trim();}
  function normalizeName(value){return String(value==null?'':value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').replace(/[–—-]/g,'-').trim();}
  function itemId(item){return normalizeId(item?.id||item?._id||item?.menuItemId||item?.menuItem);}
  function restaurantId(r){return normalizeId(r?.id||r?._id||r?.restaurantId);}
  function cartKey(item,r){return String(itemId(item)||`${restaurantId(r)||'restaurant'}|${normalizeName(item?.name)}`);}
  function findMatchingCartKey(c,item,r){
    const rid=restaurantId(r);
    const mid=itemId(item);
    const name=normalizeName(item?.name);
    const canonical=cartKey(item,r);
    if(c[canonical]) return canonical;
    for(const key of Object.keys(c)){
      const e=c[key];
      if(!e || Number(e.quantity||0)<=0) continue;
      const erid=normalizeId(e.resId||e.restaurantId);
      const emid=normalizeId(e.menuItem||e.menuItemId);
      if(rid && erid===rid && mid && emid===mid) return key;
      if(rid && erid===rid && name && normalizeName(e.name||key)===name) return key;
    }
    return null;
  }
  function getQuantity(item,r){
    const c=getCart();
    const key=findMatchingCartKey(c,item,r);
    if(key && c[key]) return Number(c[key].quantity||0);
    return 0;
  }
  function changeCart(item,r,delta){
    if(item?.inStock===false && delta>0)return;
    const c=getCart();
    const existingKey=findMatchingCartKey(c,item,r);
    const k=existingKey||cartKey(item,r);
    const existing=c[k]||{quantity:0,price:num(item.price),originalPrice:item.originalPrice??null,resId:restaurantId(r),menuItem:itemId(item),image:item.image||'',name:item.name||'Item',isVeg:Boolean(item.isVeg),restaurantName:String(r.name||'')};
    if(!existing.restaurantName && r?.name) existing.restaurantName=String(r.name);
    existing.quantity=Number(existing.quantity||0)+delta;
    if(existing.quantity<=0) delete c[k]; else c[k]=existing;
    saveCart(c);
    document.dispatchEvent(new CustomEvent('eatswada:cart-updated',{detail:{item,restaurant:r}}));
    if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();
    const host=document.querySelector(`[data-under99-restaurant="${CSS.escape(restaurantId(r))}"]`);
    if(host)syncCard(host,r);
  }

  const icon={
    // Premium rating badge: solid green circle with a clean, upright white star.
    ratingBadge:'<svg class="u99-rating-badge" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#159A62"/><path d="M12 5.4 13.94 9.33 18.28 9.96 15.14 13.02 15.88 17.34 12 15.3 8.12 17.34 8.86 13.02 5.72 9.96 10.06 9.33Z" fill="#fff"/></svg>',
    // Premium free-delivery / offer badge: green scalloped seal with a white percent mark.
    offerSeal:'<svg class="u99-seal" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0.8Q12 0.8 13.3 1.99Q14.59 3.17 16.32 2.88Q18.06 2.58 18.5 4.28Q18.95 5.98 20.57 6.66Q22.19 7.35 21.65 9.02Q21.11 10.69 22.1 12.14Q23.09 13.59 21.73 14.71Q20.37 15.82 20.42 17.58Q20.46 19.33 18.72 19.54Q16.97 19.74 16.06 21.24Q15.16 22.75 13.58 21.97Q12 21.2 10.42 21.97Q8.84 22.75 7.94 21.24Q7.03 19.74 5.28 19.54Q3.54 19.33 3.58 17.58Q3.63 15.82 2.27 14.71Q0.91 13.59 1.9 12.14Q2.89 10.69 2.35 9.02Q1.81 7.35 3.43 6.66Q5.05 5.98 5.5 4.28Q5.94 2.58 7.68 2.88Q9.41 3.17 10.7 1.99Z" fill="#159A62"/><path d="M9 15.2 15 8.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.4" cy="9.4" r="1.55" fill="#fff"/><circle cx="14.6" cy="14.6" r="1.55" fill="#fff"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.7v5.2M12 7.5h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };

  /* ── Customization bridge — reuses the EXISTING restaurant.html system ──
     restaurant.html registers customizable items into window.__ewCust and
     opens the shared sheet via window.ewOpenCustomize(menuItemId). We do the
     same here so the 99 Store card drives the very same modal + cart logic;
     we never build a second sheet or a second cart path. */
  function customGroups(item){
    // restaurant.html reads item.customizations; accept a few safe aliases in
    // case under99.html's normaliser renamed the field, without assuming one.
    const g=item&&(item.customizations||item.customizationGroups||item.customization||item.customGroups);
    return Array.isArray(g)?g:[];
  }
  function hasRealCustomization(item){
    return customGroups(item).some(g=>g&&Array.isArray(g.options)&&g.options.length>0);
  }
  function isCustomisable(item){
    return item&&(item.isCustomisable===true||item.customisable===true||hasRealCustomization(item));
  }
  function registerCustomization(item,r){
    // Mirror the exact shape restaurant.html stores, so the shared sheet reads it.
    if(!hasRealCustomization(item))return false;
    const id=itemId(item);
    if(!id)return false;
    const price=num(item.price);
    const original=item.originalPrice!=null&&num(item.originalPrice)>price?num(item.originalPrice):null;
    window.__ewCust=window.__ewCust||{};
    window.__ewCust[id]={
      name:item.name||'Item',price,resId:restaurantId(r),menuItemId:id,
      image:item.image||'',isVeg:Boolean(item.isVeg),originalPrice:original,groups:customGroups(item)
    };
    return true;
  }
  // Count customized units in the cart for an item — same rule restaurant.html
  // uses: match on the menuItem id, or on composite keys like "Name (Large)".
  function getCustomizedQuantity(item){
    const c=getCart();
    const baseName=String(item.name==null?'':item.name).trim();
    const id=itemId(item);
    let total=0;
    Object.keys(c).forEach(k=>{
      const e=c[k];
      if(!e||!(Number(e.quantity)>0))return;
      const entryMenuId=String(e.menuItem==null?'':e.menuItem);
      const sameMenuItem=id&&entryMenuId&&entryMenuId===id;
      const compositeForItem=k===baseName||k.indexOf(baseName+' (')===0;
      if(sameMenuItem||compositeForItem)total+=Number(e.quantity);
    });
    return total;
  }
  function openCustomize(item,r){
    registerCustomization(item,r); // guarantee data is present before opening
    const id=itemId(item);
    if(typeof window.ewOpenCustomize==='function'){
      window.ewOpenCustomize(id);
      return true;
    }
    // Shared sheet not present on this page: never silently add the base item.
    // Send the customer to the full restaurant page, which owns the sheet.
    const resId=restaurantId(r);
    if(resId)window.location.href=`restaurant.html?id=${encodeURIComponent(resId)}`;
    return false;
  }

  function formatCount(value){
    if(value==null || value==='') return '';
    const n=Number(String(value).replace(/,/g,''));
    if(!Number.isFinite(n)) return String(value);
    if(n>=1000000) return `${(n/1000000).toFixed(1).replace(/\.0$/,'')}m`;
    if(n>=1000) return `${(n/1000).toFixed(1).replace(/\.0$/,'')}k`;
    return String(Math.round(n));
  }

  // Fallback mountain shows ONLY when there is no image or the image fails.
  // The CSS pins both layers to the same box and makes the HTML `hidden`
  // attribute authoritative, so a valid (even transparent) image never
  // reveals the fallback beneath or beside it.
  const FALLBACK_SVG='<svg viewBox="0 0 24 24"><path d="M4 18.5h16M6 16l3.2-5 3.2 3 2.8-5 3.8 7"/></svg>';
  function imageMarkup(item){
    if(!item.image){
      return `<div class="u99-image-fallback" aria-hidden="true">${FALLBACK_SVG}</div>`;
    }
    const onerr="this.hidden=true;var f=this.parentNode&&this.parentNode.querySelector('.u99-image-fallback');if(f)f.hidden=false;";
    return `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" decoding="async" onerror="${onerr}"><div class="u99-image-fallback" hidden aria-hidden="true">${FALLBACK_SVG}</div>`;
  }

  function addControl(item,r){
    if(item.inStock===false)return '<button type="button" class="u99-add u99-unavailable" disabled>Unavailable</button>';
    // Customized items: single ADD (+) that opens the shared sheet, with a
    // count badge for however many customized variants are already in cart.
    if(isCustomisable(item)){
      registerCustomization(item,r);
      const cq=getCustomizedQuantity(item);
      return `<button type="button" class="u99-add u99-add-cust${cq>0?' has-qty':''}" data-action="customize" aria-label="Customise ${esc(item.name)}${cq>0?', '+cq+' in cart':''}">+${cq>0?`<span class="u99-cust-qty" aria-hidden="true">${cq}</span>`:''}</button>`;
    }
    const q=getQuantity(item,r);
    if(q>0)return `<div class="u99-stepper"><button type="button" data-action="minus" aria-label="Remove one">−</button><span>${q}</span><button type="button" data-action="plus" aria-label="Add one">+</button></div>`;
    return `<button type="button" class="u99-add" data-action="add" aria-label="Add ${esc(item.name)}">+</button>`;
  }

  function itemMarkup(item,r){
    const price=num(item.price);
    const original=item.originalPrice!=null&&num(item.originalPrice)>price?num(item.originalPrice):null;
    const discount=item.discountPercent!=null&&num(item.discountPercent)>0
      ? Math.round(num(item.discountPercent))
      : (original?Math.round((1-price/original)*100):null);
    const dietary=item.isVeg
      ? '<span class="u99-dietary" aria-label="Vegetarian"></span>'
      : '<span class="u99-dietary u99-nonveg" aria-label="Non-vegetarian"></span>';
    const popular=(item.isBestseller||item.isRecommended)?'<span class="u99-popular">Popular</span>':'';

    return `<article class="u99-item" data-item-id="${esc(item.id||item._id||'')}">
      <div class="u99-item-image">
        ${imageMarkup(item)}
        ${popular}
        <div class="u99-item-action">${addControl(item,r)}</div>
      </div>
      <div class="u99-item-name">${dietary}<span>${esc(item.name||'Item')}</span></div>
      <div class="u99-price-row">
        <strong>₹${price}</strong>
        ${original!=null?`<span class="u99-old-price">₹${original}</span>`:''}
        ${discount?`<span class="u99-off">${discount}% OFF</span>`:''}
      </div>
    </article>`;
  }

  function restaurantOffer(r){
    // Only use an explicit restaurant-level offer/discount.
    // Never turn the largest individual item discount into the restaurant headline.
    const raw=String(r.offer||'').trim();
    if(raw){
      const m=raw.match(/(\d+(?:\.\d+)?)\s*%/);
      if(m)return `${Math.round(Number(m[1]))}% LOWER PRICES`;
      if(/lower|off|deal|discount/i.test(raw))return raw.toUpperCase();
    }
    if(r.discountPercent!=null && num(r.discountPercent)>0){
      return `${Math.round(num(r.discountPercent))}% LOWER PRICES`;
    }
    return 'LOWER PRICES';
  }

  function ratingMarkup(r){
    const rating=num(r.rating);
    const count=formatCount(r.ratingCount);
    return `<span class="u99-rating">${icon.ratingBadge}<b>${rating?rating.toFixed(1):'—'}</b>${count?`<span class="u99-rating-count">(${esc(count)})</span>`:''}</span>`;
  }

  function freeDeliveryMarkup(r){
    if(r.freeDeliveryAbove==null)return '';
    return `<div class="u99-free-row"><span class="u99-free-icon" aria-hidden="true">${icon.offerSeal}</span><span class="u99-free-text">Free delivery above ₹${num(r.freeDeliveryAbove)}</span><button class="u99-info" data-action="info" aria-label="Free delivery information">${icon.info}</button></div>`;
  }

  function cardMarkup(r,menu){
    const cuisine=String(r.cuisine||'').trim();
    const delivery=String(r.deliveryTime||'').trim();

    return `<article class="u99-restaurant-card">
      <button class="u99-restaurant-head" type="button" data-action="restaurant" aria-label="Open ${esc(r.name||'restaurant')}">
        <div class="u99-card-copy">
          <div class="u99-discount-line">${restaurantOffer(r)}</div>
          <h2 class="u99-restaurant-name">${esc(r.name||'Restaurant')}</h2>
          <div class="u99-meta">
            ${ratingMarkup(r)}
            ${delivery?`<span class="u99-sep">•</span><span class="u99-delivery">${icon.clock}${esc(delivery)}</span>`:''}
            ${cuisine?`<span class="u99-sep">•</span><span class="u99-cuisine">${esc(cuisine)}</span>`:''}
          </div>
          ${freeDeliveryMarkup(r)}
        </div>
      </button>
      <div class="u99-carousel-wrap">
        <div class="u99-carousel" tabindex="0" aria-label="${esc(r.name||'Restaurant')} menu">${menu.map(i=>itemMarkup(i,r)).join('')}</div>
      </div>
    </article>`;
  }

  // host -> restaurant object, so a rebuilt card (new inner DOM) still resolves
  // its data and a delegated listener bound once keeps working.
  const hostData=new WeakMap();

  function findItem(r,itemId){
    return (r.menu||[]).find(x=>String(x.id||x._id||'')===String(itemId));
  }

  function bindCard(host,r){
    hostData.set(host,r);
    // Delegated click — survives partial re-renders of the action buttons, so
    // the carousel and images are never rebuilt just to update a + / stepper.
    if(!host.__u99click){
      host.__u99click=true;
      host.addEventListener('click',e=>{
        const rr=hostData.get(host); if(!rr)return;
        const button=e.target.closest('[data-action]');
        if(!button||!host.contains(button))return;
        const action=button.dataset.action;
        const id=String(rr.id||rr._id||'');
        if(action==='add'||action==='plus'||action==='minus'){
          e.stopPropagation();
          const item=findItem(rr,button.closest('.u99-item')?.dataset.itemId);
          if(item)changeCart(item,rr,action==='minus'?-1:1);
        } else if(action==='customize'){
          e.stopPropagation();
          const item=findItem(rr,button.closest('.u99-item')?.dataset.itemId);
          if(item)openCustomize(item,rr);
        } else if(action==='restaurant'||action==='full-menu'){
          e.stopPropagation();
          if(id)window.location.href=`restaurant.html?id=${encodeURIComponent(id)}`;
        } else if(action==='info'){
          e.stopPropagation();
          if(typeof window.showToast==='function')window.showToast(`Free delivery above ₹${num(rr.freeDeliveryAbove)}`);
        }
      });
    }
    bindWheel(host);
  }

  function bindWheel(host){
    const carousel=host.querySelector('.u99-carousel');
    if(carousel && !carousel.__u99wheel){
      carousel.__u99wheel=true;
      carousel.addEventListener('wheel',e=>{
        if(Math.abs(e.deltaY)>Math.abs(e.deltaX))carousel.scrollLeft+=e.deltaY;
      },{passive:true});
    }
  }

  function sortedMenu(r){
    // Always lowest price -> highest, then name; API order never wins.
    return Array.isArray(r.menu)
      ? [...r.menu].filter(i=>i && num(i.price)>0).sort((a,b)=>num(a.price)-num(b.price)||String(a.name).localeCompare(String(b.name)))
      : [];
  }

  // Lightweight update: refresh ONLY the +/stepper/customize controls in place.
  // Keeps carousel scroll position and loaded images untouched.
  function syncCard(host,r){
    const menu=sortedMenu(r);
    host.querySelectorAll('.u99-item').forEach(el=>{
      const itemId=el.dataset.itemId;
      const item=menu.find(x=>String(x.id||x._id||'')===String(itemId))||findItem(r,itemId);
      if(!item)return;
      const action=el.querySelector('.u99-item-action');
      if(action)action.innerHTML=addControl(item,r);
    });
  }

  function syncAllCards(){
    document.querySelectorAll('[data-under99-restaurant]').forEach(host=>{
      const r=hostData.get(host);
      if(r)syncCard(host,r);
    });
  }

  // The shared customization sheet (restaurant.html) writes to the cart and
  // calls window.updateGlobalCart() but doesn't know about our cards. Wrap it
  // once so any confirmed customized add re-syncs our + badges.
  function hookGlobalCart(){
    if(window.__u99CartHooked)return;
    window.__u99CartHooked=true;
    const prev=window.updateGlobalCart;
    window.updateGlobalCart=function(){
      const ret=(typeof prev==='function')?prev.apply(this,arguments):undefined;
      try{syncAllCards();}catch(_){}
      return ret;
    };
  }

  function refreshCard(host,r){
    const menu=sortedMenu(r);
    host.innerHTML=cardMarkup(r,menu);
    menu.forEach(i=>{ if(isCustomisable(i))registerCustomization(i,r); });
    bindCard(host,r);
  }

  function createRestaurantCard(r){
    hookGlobalCart();
    const host=document.createElement('div');
    host.className='u99-card-host';
    host.dataset.under99Restaurant=restaurantId(r);
    const menu=sortedMenu(r);
    host.innerHTML=cardMarkup(r,menu);
    menu.forEach(i=>{ if(isCustomisable(i))registerCustomization(i,r); });
    bindCard(host,r);
    return host;
  }

  function injectStyles(){
    if(document.getElementById('under99-card-styles'))return;
    const s=document.createElement('style');
    s.id='under99-card-styles';
    s.textContent=`
      .u99-card-host{display:block;min-width:0}
      .u99-restaurant-card{
        background:#fff;
        border:1px solid #E7E9ED;
        border-radius:24px;
        padding:16px 16px 15px;
        box-shadow:0 2px 10px rgba(16,24,40,.04);
        overflow:hidden;
      }
      .u99-restaurant-head{
        position:relative;width:100%;padding:0;border:0;background:transparent;
        text-align:left;color:#101828;display:block;
      }
      .u99-card-copy{min-width:0}
      .u99-discount-line{
        color:#EC168C;font-size:12px;line-height:1.05;font-weight:700;
        letter-spacing:.3px;margin:0 0 4px;text-transform:uppercase;
      }
      .u99-restaurant-name{
        margin:0 0 5px;font-size:21px;line-height:1.08;font-weight:800;
        letter-spacing:-.55px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .u99-meta{
        display:flex;align-items:center;flex-wrap:nowrap;gap:5px;color:#747B87;
        font-size:12px;font-weight:600;line-height:1.25;min-width:0;overflow:hidden;
      }
      .u99-rating{display:inline-flex;align-items:center;gap:5px;color:#344054;white-space:nowrap;flex:0 0 auto}
      .u99-rating .u99-rating-badge{width:16px;height:16px;flex:0 0 16px;display:block}
      .u99-rating b{font-weight:750}
      .u99-rating-count{color:#747B87;font-weight:500}
      .u99-sep{color:#C9CED6;flex:0 0 auto}
      .u99-delivery{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex:0 0 auto}
      .u99-delivery svg{width:16px;height:16px;flex:0 0 16px;color:#747B87}
      .u99-cuisine{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
      .u99-free-row{
        margin-top:6px;display:flex;align-items:center;gap:6px;min-width:0;
        font-size:12.5px;font-weight:650;color:#26334A;line-height:1.2;white-space:nowrap;
      }
      .u99-free-icon{
        width:18px;height:18px;flex:0 0 18px;display:grid;place-items:center;
      }
      .u99-free-icon .u99-seal{width:18px;height:18px;display:block}
      .u99-free-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .u99-info{
        width:18px;height:18px;margin-left:1px;padding:0;border:0;background:transparent;color:#8791A1;
        display:grid;place-items:center;flex:0 0 18px;
      }
      .u99-info svg{width:15px;height:15px}

      .u99-carousel-wrap{margin-top:10px}
      .u99-carousel{
        display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;
        padding:0 0 3px;scrollbar-width:none;-webkit-overflow-scrolling:touch;
      }
      .u99-carousel::-webkit-scrollbar{display:none}

      /* Keep Eatswada's own wider/taller tile proportion. The benchmark's tile dimensions are NOT copied. */
      .u99-item{
        flex:0 0 calc((100% - 20px)/3);
        width:calc((100% - 20px)/3);
        min-width:0;scroll-snap-align:start;
      }
      /* Same tile proportion (aspect-ratio 1.46/1) and object-fit as before —
         only the layer stacking is fixed. Image and fallback are pinned to the
         SAME box so a valid/transparent image never leaves a grey strip. */
      .u99-item-image{
        position:relative;width:100%;aspect-ratio:1.46/1;border-radius:12px;
        overflow:visible;background:#F1F3F6;
      }
      .u99-item-image img,.u99-image-fallback{
        position:absolute;inset:0;width:100%;height:100%;border-radius:12px;
        object-fit:cover;display:block;
      }
      /* Make the HTML hidden attribute authoritative — never let the display
         rules below override it. This is the actual grey-mountain fix. */
      .u99-item-image img[hidden],.u99-image-fallback[hidden]{display:none!important}
      .u99-image-fallback{display:grid;place-items:center;color:#C1C7D0;background:#F1F3F6}
      .u99-image-fallback svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
      .u99-popular{
        position:absolute;left:6px;top:6px;z-index:2;background:#fff;color:#16865A;
        border-radius:999px;padding:4px 7px;font-size:9px;line-height:1;font-weight:800;
        box-shadow:0 2px 6px rgba(16,24,40,.08);white-space:nowrap;
      }
      .u99-item-action{position:absolute;right:3px;bottom:-9px;z-index:4}
      .u99-add{
        width:36px;height:36px;border-radius:50%;border:2px solid #EC168C;
        background:#fff;color:#EC168C;display:grid;place-items:center;
        box-shadow:0 2px 6px rgba(16,24,40,.09);font-size:22px;line-height:1;
        font-weight:500;padding:0;
      }
      .u99-add:active{transform:scale(.94)}
      .u99-add-cust{position:relative}
      .u99-cust-qty{
        position:absolute;top:-6px;right:-6px;min-width:17px;height:17px;padding:0 4px;
        border-radius:999px;background:#159A62;color:#fff;font-size:9px;font-weight:800;
        line-height:1;display:grid;place-items:center;box-shadow:0 1px 3px rgba(16,24,40,.22);
      }
      .u99-unavailable{font-size:7px;width:54px;height:30px;border-color:#DFE3E9;color:#8D96A5}
      .u99-stepper{
        height:32px;min-width:72px;border:2px solid #EC168C;border-radius:10px;background:#fff;
        display:flex;align-items:center;justify-content:space-between;
        box-shadow:0 2px 7px rgba(16,24,40,.10);padding:0 2px;
      }
      .u99-stepper button{
        width:23px;height:27px;border:0;background:transparent;color:#EC168C;font-size:16px;
        font-weight:800;display:grid;place-items:center;padding:0;
      }
      .u99-stepper span{font-size:10px;font-weight:800;color:#101828}

      .u99-item-name{
        margin:8px 1px 0;min-height:31px;max-height:31px;display:flex;align-items:flex-start;gap:4px;
        color:#101828;font-size:11.5px;line-height:1.32;font-weight:650;overflow:hidden;
      }
      .u99-item-name>span:last-child{
        min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      .u99-dietary{
        width:15px;height:15px;flex:0 0 15px;margin-top:0;border:1.5px solid #16885D;
        border-radius:4px;display:grid;place-items:center;
      }
      .u99-dietary:after{content:"";width:5px;height:5px;border-radius:50%;background:#16885D}
      .u99-dietary.u99-nonveg{border-color:#E5264F}
      .u99-dietary.u99-nonveg:after{
        width:0;height:0;border-radius:0;background:transparent;
        border-left:3px solid transparent;border-right:3px solid transparent;border-bottom:5px solid #E5264F;
      }
      .u99-price-row{
        display:flex;align-items:center;flex-wrap:nowrap;gap:4px;margin:7px 1px 0;min-height:21px;overflow:hidden;
      }
      .u99-price-row strong{font-size:16px;line-height:1;font-weight:800;color:#101828;flex:0 0 auto}
      .u99-old-price{font-size:9px;color:#8992A0;text-decoration:line-through;flex:0 0 auto}
      .u99-off{
        background:#FFF0F8;color:#EC168C;padding:5px 6px;border-radius:999px;
        font-size:7.5px;line-height:1;font-weight:800;white-space:nowrap;flex:0 0 auto;
      }

      @media(max-width:430px){
        .u99-restaurant-card{padding:15px 14px 14px;border-radius:23px}
        .u99-discount-line{font-size:12px}
        .u99-restaurant-name{font-size:20px;margin-bottom:5px}
        .u99-meta{font-size:11.5px;gap:4px}
        .u99-free-row{font-size:12px}
        .u99-carousel-wrap{margin-top:9px}
        .u99-carousel{gap:8px}
        .u99-item{flex-basis:calc((100% - 16px)/3);width:calc((100% - 16px)/3)}
        .u99-item-image{border-radius:11px}
        .u99-item-image img,.u99-image-fallback{border-radius:11px}
        .u99-add{width:36px;height:36px;font-size:22px}
        .u99-item-name{font-size:11px;min-height:30px;max-height:30px}
        .u99-price-row{gap:3px}
        .u99-price-row strong{font-size:15px}
        .u99-old-price{font-size:8.5px}
        .u99-off{font-size:7px;padding:4.5px 5px}
      }
      @media(max-width:370px){
        .u99-restaurant-card{padding:14px 12px 13px}
        .u99-restaurant-name{font-size:19px}
        .u99-meta{font-size:10.5px}
        .u99-free-row{font-size:11px}
        .u99-item-name{font-size:10.5px}
        .u99-price-row strong{font-size:14px}
      }
    `;
    document.head.appendChild(s);
  }

  injectStyles();
  window.Eatswada99Card={createRestaurantCard,refreshCard,changeCart};
})();