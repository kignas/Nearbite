/* Eatswada 99 Store — isolated restaurant card component */
(() => {
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = (v, fallback=0) => { const n=Number(v); return Number.isFinite(n)?n:fallback; };
  const CART_KEY='nearbite_cart';

  function getCart(){ try{return JSON.parse(localStorage.getItem(CART_KEY))||{};}catch(_){return{};} }
  function saveCart(c){localStorage.setItem(CART_KEY,JSON.stringify(c));}
  function cartKey(item,r){return String(item.id||item._id||`${r.id||'restaurant'}|${item.name}`);}
  function getQuantity(item,r){
    const c=getCart(),k=cartKey(item,r);
    if(c[k]) return Number(c[k].quantity||0);
    if(c[item.name] && !c[item.name].resId) return Number(c[item.name].quantity||0);
    return 0;
  }
  function changeCart(item,r,delta){
    if(item?.inStock===false && delta>0)return;
    const c=getCart(),k=cartKey(item,r);
    const existing=c[k]||{quantity:0,price:num(item.price),originalPrice:item.originalPrice??null,resId:String(r.id||''),menuItem:String(item.id||item._id||''),image:item.image||'',name:item.name||'Item',isVeg:Boolean(item.isVeg)};
    existing.quantity=Number(existing.quantity||0)+delta;
    if(existing.quantity<=0) delete c[k]; else c[k]=existing;
    saveCart(c);
    document.dispatchEvent(new CustomEvent('eatswada:cart-updated',{detail:{item,restaurant:r}}));
    if(typeof window.updateGlobalCart==='function')window.updateGlobalCart();
    const host=document.querySelector(`[data-under99-restaurant="${CSS.escape(String(r.id||r._id||''))}"]`);
    if(host)refreshCard(host,r);
  }

  const icon={
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.75 5.58 6.16.9-4.46 4.34 1.05 6.13L12 17.06 6.5 19.95l1.05-6.13L3.09 9.48l6.16-.9L12 3Z" fill="currentColor" stroke="none"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.7v5.2M12 7.5h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function stamp(){
    return `<svg class="u99-stamp-svg" viewBox="0 0 108 108" aria-hidden="true">
      <defs>
        <path id="u99stampPath" d="M54 8a46 46 0 1 1 0 92 46 46 0 0 1 0-92Z"/>
      </defs>
      <circle cx="54" cy="54" r="47" fill="#fff" stroke="#ef9bca" stroke-width="2"/>
      <text class="u99-stamp-ring"><textPath href="#u99stampPath" startOffset="2%">EVERYDAY • LOWEST PRICE • EVERYDAY •</textPath></text>
      <path d="M17 46 87 30l6 23-70 16Z" fill="#ec168c"/>
      <text x="54" y="55" class="u99-stamp-main" transform="rotate(-10 54 55)">LOWEST PRICE</text>
    </svg>`;
  }

  function imageMarkup(item){
    if(!item.image)return '<div class="u99-image-fallback" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18.5h16M6 16l3.2-5 3.2 3 2.8-5 3.8 7"/></svg></div>';
    return `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><div class="u99-image-fallback" hidden aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18.5h16M6 16l3.2-5 3.2 3 2.8-5 3.8 7"/></svg></div>`;
  }
  function addControl(item,r){
    const q=getQuantity(item,r);
    if(q>0)return `<div class="u99-stepper"><button type="button" data-action="minus" aria-label="Remove one">−</button><span>${q}</span><button type="button" data-action="plus" aria-label="Add one">+</button></div>`;
    if(item.inStock===false)return '<button type="button" class="u99-add u99-unavailable" disabled>Unavailable</button>';
    return `<button type="button" class="u99-add" data-action="add" aria-label="Add ${esc(item.name)}">+</button>`;
  }
  function itemMarkup(item,r){
    const price=num(item.price);
    const original=item.originalPrice!=null&&num(item.originalPrice)>price?num(item.originalPrice):null;
    const discount=item.discountPercent!=null&&num(item.discountPercent)>0?Math.round(num(item.discountPercent)):(original?Math.round((1-price/original)*100):null);
    const dietary=item.isVeg?'<span class="u99-dietary" aria-label="Vegetarian"></span>':'<span class="u99-dietary u99-nonveg" aria-label="Non-vegetarian"></span>';
    const popular=(item.isBestseller||item.isRecommended)?'<span class="u99-popular">Popular</span>':'';
    return `<article class="u99-item" data-item-id="${esc(item.id||item._id||'')}">
      <div class="u99-item-image">${imageMarkup(item)}${popular}<div class="u99-item-action">${addControl(item,r)}</div></div>
      <div class="u99-item-name">${dietary}<span>${esc(item.name||'Item')}</span></div>
      <div class="u99-price-row"><strong>₹${price}</strong>${original!=null?`<span class="u99-old-price">₹${original}</span>`:''}${discount?`<span class="u99-off">${discount}% OFF</span>`:''}</div>
    </article>`;
  }
  function restaurantOffer(r,menu){
    const m=String(r.offer||'').match(/(\d+(?:\.\d+)?)\s*%/);
    if(m)return `${Math.round(Number(m[1]))}% LOWER PRICES`;
    const discounts=menu.map(i=>num(i.discountPercent)).filter(Boolean);
    return discounts.length?`${Math.max(...discounts)}% LOWER PRICES`:'LOWER PRICES';
  }
  function ratingMarkup(r){
    const rating=num(r.rating); const count=r.ratingCount==null?'':`<span class="u99-rating-count">(${esc(r.ratingCount)})</span>`;
    return `<span class="u99-rating">${icon.star}<b>${rating?rating.toFixed(1):'—'}</b>${count}</span>`;
  }
  function freeDeliveryMarkup(r){
    if(r.freeDeliveryAbove==null)return '';
    return `<div class="u99-free-row"><span class="u99-free-icon">%</span><span>Free delivery above ₹${num(r.freeDeliveryAbove)}</span><button class="u99-info" data-action="info" aria-label="Free delivery information">${icon.info}</button></div>`;
  }
  function cardMarkup(r,menu){
    const cuisine=String(r.cuisine||'').trim();
    const delivery=String(r.deliveryTime||'').trim();
    return `<article class="u99-restaurant-card">
      <button class="u99-restaurant-head" type="button" data-action="restaurant" aria-label="Open ${esc(r.name||'restaurant')}">
        <div class="u99-card-copy">
          <div class="u99-discount-line">${restaurantOffer(r,menu)}</div>
          <h2 class="u99-restaurant-name">${esc(r.name||'Restaurant')}</h2>
          <div class="u99-meta">${ratingMarkup(r)}${delivery?`<span class="u99-sep">•</span><span class="u99-delivery">${icon.clock}${esc(delivery)}</span>`:''}${cuisine?`<span class="u99-sep">•</span><span class="u99-cuisine">${esc(cuisine)}</span>`:''}</div>
          ${freeDeliveryMarkup(r)}
        </div>
        <span class="u99-stamp">${stamp()}</span>
      </button>
      <div class="u99-carousel-wrap">
        <div class="u99-carousel" tabindex="0" aria-label="${esc(r.name||'Restaurant')} complete menu">${menu.map(i=>itemMarkup(i,r)).join('')}</div>
      </div>
    </article>`;
  }
  function bindCard(host,r){
    const id=String(r.id||r._id||'');
    host.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',e=>{
      const action=button.dataset.action;
      if(['add','plus','minus'].includes(action)){
        e.stopPropagation(); const itemEl=button.closest('.u99-item'); const itemId=itemEl?.dataset.itemId;
        const item=(r.menu||[]).find(x=>String(x.id||x._id||'')===String(itemId)); if(item)changeCart(item,r,action==='minus'?-1:1);
      } else if(action==='restaurant'||action==='full-menu'){
        e.stopPropagation(); if(id)window.location.href=`restaurant.html?id=${encodeURIComponent(id)}`;
      } else if(action==='info'){
        e.stopPropagation(); if(typeof window.showToast==='function')window.showToast(`Free delivery above ₹${num(r.freeDeliveryAbove)}`);
      }
    }));
    const carousel=host.querySelector('.u99-carousel');
    if(carousel)carousel.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX))carousel.scrollLeft+=e.deltaY},{passive:true});
  }
  function refreshCard(host,r){const menu=Array.isArray(r.menu)?[...r.menu].sort((a,b)=>num(a.price)-num(b.price)||String(a.name).localeCompare(String(b.name))):[];host.innerHTML=cardMarkup(r,menu);bindCard(host,r);}
  function createRestaurantCard(r){const host=document.createElement('div');host.className='u99-card-host';host.dataset.under99Restaurant=String(r.id||r._id||'');const menu=Array.isArray(r.menu)?[...r.menu].sort((a,b)=>num(a.price)-num(b.price)||String(a.name).localeCompare(String(b.name))):[];host.innerHTML=cardMarkup(r,menu);bindCard(host,r);return host;}

  function injectStyles(){
    if(document.getElementById('under99-card-styles'))return;
    const s=document.createElement('style');s.id='under99-card-styles';s.textContent=`
      .u99-card-host{display:block}
      .u99-restaurant-card{
        background:#fff;border:1px solid #E7E9ED;border-radius:28px;
        padding:20px;box-shadow:0 1px 2px rgba(16,24,40,.025),0 5px 18px rgba(16,24,40,.035);
        overflow:hidden
      }
      .u99-restaurant-head{
        position:relative;width:100%;padding:0 78px 0 0;border:0;background:transparent;
        text-align:left;color:#101828;display:block
      }
      .u99-card-copy{min-width:0}
      .u99-discount-line{
        color:#EC168C;font-size:15px;line-height:1.1;font-weight:800;
        letter-spacing:-.2px;margin:0 0 7px
      }
      .u99-restaurant-name{
        margin:0 0 9px;font-size:22px;line-height:1.1;font-weight:800;
        letter-spacing:-.65px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis
      }
      .u99-meta{
        display:flex;align-items:center;flex-wrap:nowrap;gap:7px;color:#747B87;
        font-size:12px;font-weight:600;line-height:1.35;min-width:0
      }
      .u99-rating{display:inline-flex;align-items:center;gap:5px;color:#344054;white-space:nowrap}
      .u99-rating svg{width:17px;height:17px;color:#F5B51B;flex:0 0 17px}
      .u99-rating b{font-weight:700}
      .u99-rating-count{color:#747B87;font-weight:500}
      .u99-sep{color:#C9CED6}
      .u99-delivery{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
      .u99-delivery svg{width:17px;height:17px;flex:0 0 17px;color:#747B87}
      .u99-cuisine{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .u99-free-row{
        margin-top:9px;display:flex;align-items:center;gap:7px;font-size:12px;
        font-weight:600;color:#26334A
      }
      .u99-free-icon{
        width:22px;height:22px;border-radius:6px;background:#159A62;color:#fff;
        display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 22px
      }
      .u99-info{
        width:19px;height:19px;padding:0;border:0;background:transparent;color:#8791A1;
        display:grid;place-items:center
      }
      .u99-info svg{width:17px;height:17px}

      .u99-stamp{
        position:absolute;right:-2px;top:-3px;width:82px;height:82px;
        display:block;pointer-events:none
      }
      .u99-stamp-svg{width:100%;height:100%;display:block}
      .u99-stamp-ring{
        font-size:6.8px;font-weight:800;fill:#EC78B7;letter-spacing:1px
      }
      .u99-stamp-main{
        font-size:8.5px;font-weight:900;fill:#fff;letter-spacing:.05px
      }

      .u99-carousel-wrap{margin-top:15px}
      .u99-carousel{
        display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;
        padding:0 0 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch
      }
      .u99-carousel::-webkit-scrollbar{display:none}
      /* Exactly three compact tiles in the available card width. Extra menu items remain swipeable. */
      .u99-item{
        flex:0 0 calc((100% - 24px)/3);width:calc((100% - 24px)/3);
        min-width:0;scroll-snap-align:start
      }
      .u99-item-image{
        position:relative;width:100%;aspect-ratio:1.42/1;border-radius:14px;
        overflow:visible;background:#F1F3F6
      }
      .u99-item-image img,.u99-image-fallback{
        width:100%;height:100%;border-radius:14px;object-fit:cover;display:block;overflow:hidden
      }
      .u99-image-fallback{display:grid;place-items:center;color:#C1C7D0;background:#F1F3F6}
      .u99-image-fallback svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
      .u99-popular{
        position:absolute;left:7px;top:7px;z-index:2;background:#fff;color:#16865A;
        border-radius:999px;padding:5px 8px;font-size:9px;line-height:1;font-weight:800;
        box-shadow:0 2px 7px rgba(16,24,40,.08)
      }
      .u99-item-action{
        position:absolute;right:4px;bottom:-10px;z-index:4
      }
      .u99-add{
        width:42px;height:42px;border-radius:50%;border:2px solid #EC168C;
        background:#fff;color:#EC168C;display:grid;place-items:center;
        box-shadow:0 2px 8px rgba(16,24,40,.10);font-size:26px;line-height:1;
        font-weight:500;padding:0
      }
      .u99-add:active{transform:scale(.94)}
      .u99-unavailable{font-size:8px;width:58px;height:32px;border-color:#DFE3E9;color:#8D96A5}
      .u99-stepper{
        height:34px;min-width:76px;border:2px solid #EC168C;border-radius:11px;background:#fff;
        display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(16,24,40,.10);padding:0 2px
      }
      .u99-stepper button{
        width:25px;height:28px;border:0;background:transparent;color:#EC168C;font-size:17px;
        font-weight:800;display:grid;place-items:center;padding:0
      }
      .u99-stepper span{font-size:11px;font-weight:800;color:#101828}
      .u99-item-name{
        margin:10px 1px 0;min-height:36px;display:flex;align-items:flex-start;gap:5px;
        color:#101828;font-size:11.5px;line-height:1.3;font-weight:600
      }
      .u99-item-name>span:last-child{min-width:0}
      .u99-dietary{
        width:16px;height:16px;flex:0 0 16px;margin-top:0;border:1.6px solid #16885D;
        border-radius:4px;display:grid;place-items:center
      }
      .u99-dietary:after{content:"";width:6px;height:6px;border-radius:50%;background:#16885D}
      .u99-dietary.u99-nonveg{border-color:#E5264F}
      .u99-dietary.u99-nonveg:after{
        width:0;height:0;border-radius:0;background:transparent;
        border-left:3.5px solid transparent;border-right:3.5px solid transparent;
        border-bottom:6px solid #E5264F
      }
      .u99-price-row{
        display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:7px 1px 0;min-height:24px
      }
      .u99-price-row strong{font-size:16px;line-height:1;font-weight:800;color:#101828}
      .u99-old-price{font-size:10px;color:#8992A0;text-decoration:line-through}
      .u99-off{
        background:#FFF0F8;color:#EC168C;padding:6px 7px;border-radius:999px;
        font-size:8.5px;line-height:1;font-weight:800;white-space:nowrap
      }
      .u99-full-menu{display:none!important}

      @media(max-width:430px){
        .u99-restaurant-card{padding:18px;border-radius:26px}
        .u99-restaurant-head{padding-right:74px}
        .u99-discount-line{font-size:14px}
        .u99-restaurant-name{font-size:21px}
        .u99-meta{font-size:11px;gap:5px}
        .u99-stamp{width:76px;height:76px;right:-2px}
        .u99-carousel-wrap{margin-top:14px}
        .u99-carousel{gap:10px}
        .u99-item{flex-basis:calc((100% - 20px)/3);width:calc((100% - 20px)/3)}
        .u99-add{width:40px;height:40px;font-size:25px}
        .u99-item-name{font-size:11px}
        .u99-price-row strong{font-size:15px}
        .u99-off{font-size:8px;padding:5px 6px}
      }
      @media(max-width:370px){
        .u99-restaurant-card{padding:16px}
        .u99-restaurant-name{font-size:20px}
        .u99-meta{font-size:10.5px}
        .u99-free-row{font-size:11px}
        .u99-item-name{font-size:10.5px}
        .u99-price-row strong{font-size:14px}
      }
    `;document.head.appendChild(s);
  }
  injectStyles();
  window.Eatswada99Card={createRestaurantCard,refreshCard,changeCart};
})();
