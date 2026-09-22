/* Eatswada — shared, context-aware search overlay.
   Search never navigates away on submit/Enter. search.html remains only as a
   legacy/deep-link surface; normal search results stay inside this overlay. */
(() => {
  'use strict';
  const state = { open:false, context:'home', restaurantId:'', restaurantName:'', timer:null, request:0, loaded:{} };
  const root = () => document.getElementById('ew-search-root');
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = v => { const s=String(v||'').trim(); return /^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('./') || s.startsWith('../') ? s : ''; };
  const norm = v => String(v ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const api = () => window.API;

  function detectContext() {
    const path = location.pathname.toLowerCase();
    if (path.endsWith('/under99.html') || path.endsWith('/under99')) return { context:'under99' };
    if (path.endsWith('/restaurant.html') || path.endsWith('/restaurant')) {
      return { context:'restaurant', restaurantId:new URLSearchParams(location.search).get('id') || '' };
    }
    return { context:'home' };
  }

  function mount(){
    if (root()) return;
    const el=document.createElement('div');
    el.id='ew-search-root'; el.className='ew-search-root';
    el.innerHTML=`
      <div class="ew-search-backdrop" data-ew-search-close></div>
      <section class="ew-search-panel" role="dialog" aria-modal="true" aria-labelledby="ew-search-title">
        <div class="ew-search-grab" aria-hidden="true"></div>
        <div class="ew-search-top">
          <button class="ew-search-back" type="button" aria-label="Close search" data-ew-search-close><i class="fa-solid fa-arrow-left"></i></button>
          <div class="ew-search-field">
            <i class="fa-solid fa-magnifying-glass ew-search-icon" aria-hidden="true"></i>
            <input id="ew-search-input" class="ew-search-input" type="search" inputmode="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Search dishes & restaurants" aria-label="Search dishes and restaurants">
            <button id="ew-search-clear" class="ew-search-clear" type="button" aria-label="Clear search" hidden><i class="fa-solid fa-xmark"></i></button>
            <span class="ew-search-divider" aria-hidden="true"></span>
            <button class="ew-search-mic" type="button" aria-label="Voice search"><i class="fa-solid fa-microphone"></i></button>
          </div>
        </div>
        <div id="ew-search-context" class="ew-search-context"></div>
        <div id="ew-search-results" class="ew-search-results"></div>
      </section>`;
    document.body.appendChild(el);
    $('ew-search-input').addEventListener('input', onInput);
    $('ew-search-input').addEventListener('keydown', e => {
      if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); runSearch(true); }
      if(e.key==='Escape'){ e.preventDefault(); close(); }
    });
    $('ew-search-clear').addEventListener('click',()=>{ $('ew-search-input').value=''; onInput(); $('ew-search-input').focus(); });
    el.querySelectorAll('[data-ew-search-close]').forEach(x=>x.addEventListener('click',close));
  }

  function setContext(info){
    state.context=info?.context||'home'; state.restaurantId=String(info?.restaurantId||'');
    const labels={home:'Search Eatswada',under99:'Search 99 Store',restaurant:'Search this restaurant'};
    $('ew-search-context').textContent=labels[state.context]||labels.home;
  }

  function open(options={}){
    mount();
    const detected=detectContext();
    setContext({...detected,...options});
    state.open=true; document.body.classList.add('ew-search-lock'); root().classList.add('is-open');
    const input=$('ew-search-input'); input.value=String(options.query||'');
    updateClear(); renderInitial();
    requestAnimationFrame(()=>{ input.focus({preventScroll:true}); input.setSelectionRange(input.value.length,input.value.length); });
  }

  function close(){ if(!root()) return; state.open=false; root().classList.remove('is-open'); document.body.classList.remove('ew-search-lock'); if(state.timer) clearTimeout(state.timer); }

  function updateClear(){ const v=$('ew-search-input').value.trim(); $('ew-search-clear').hidden=!v; }

  function renderInitial(){
    const chips=state.context==='under99'?['Biryani','Momos','Rolls','Pizza']:state.context==='restaurant'?['Biryani','Momos','Rolls','Pizza']:['Biryani','Momos','Pizza','Rolls'];
    $('ew-search-results').innerHTML=`<div class="ew-search-chips">${chips.map(q=>`<button class="ew-search-chip" type="button" data-ew-query="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
    $('ew-search-results').querySelectorAll('[data-ew-query]').forEach(b=>b.addEventListener('click',()=>{ $('ew-search-input').value=b.dataset.ewQuery||''; onInput(); }));
  }

  function onInput(){ updateClear(); const q=$('ew-search-input').value.trim(); if(state.timer) clearTimeout(state.timer); if(!q){renderInitial();return;} state.timer=setTimeout(()=>runSearch(false),180); }

  async function runSearch(fromEnter){
    const q=$('ew-search-input').value.trim(); if(!q){renderInitial();return;}
    const token=++state.request; renderLoading();
    try{
      const result=await search(q);
      if(token!==state.request)return;
      renderResults(q,result);
    }catch(err){
      if(token!==state.request)return;
      console.warn('[Eatswada Search]',err);
      renderError();
    }
  }

  async function getRestaurants(){
    const key='ew_search_restaurants'; const now=Date.now();
    try{const cached=JSON.parse(sessionStorage.getItem(key)||'null'); if(cached&&Array.isArray(cached.data)&&now-cached.at<5*60*1000)return cached.data;}catch{}
    const data=await api().getList(api().routes.restaurants);
    try{sessionStorage.setItem(key,JSON.stringify({at:now,data}));}catch{}
    return data;
  }

  async function getUnder99(){
    const key='ew_search_under99'; const now=Date.now();
    try{const cached=JSON.parse(sessionStorage.getItem(key)||'null'); if(cached&&Array.isArray(cached.data)&&now-cached.at<5*60*1000)return cached.data;}catch{}
    const raw=await api().getList(api().routes.under99);
    try{sessionStorage.setItem(key,JSON.stringify({at:now,data:raw}));}catch{}
    return raw;
  }

  function menuItems(raw){
    if(Array.isArray(raw)) return raw.flatMap(x=>Array.isArray(x?.items)?x.items:[x]);
    if(raw&&Array.isArray(raw.items)) return raw.items;
    return [];
  }

  async function getRestaurantScope(id){
    if(!id) throw new Error('Missing restaurant id');
    const [res,menuPayload]=await Promise.all([api().getObject(api().routes.restaurant(id)),api().request(api().routes.restaurantMenu(id))]);
    const payload=api().unwrap(menuPayload);
    const items=[];
    if(Array.isArray(payload)) payload.forEach(g=>{if(Array.isArray(g?.items))items.push(...g.items); else items.push(g);});
    else if(Array.isArray(payload?.items)) items.push(...payload.items);
    return {restaurant:res,items};
  }

  async function search(q){
    const nq=norm(q);
    if(state.context==='under99'){
      const rows=await getUnder99(); const dishes=[];
      rows.forEach(raw=>{const r=raw?.restaurant&&typeof raw.restaurant==='object'?raw.restaurant:raw; const rid=String(r?.id||r?._id||''); const rn=r?.name||'Restaurant'; const items=Array.isArray(raw?.menu)?raw.menu:(Array.isArray(r?.menu)?r.menu:[]); items.forEach(i=>{if(norm(i?.name).includes(nq))dishes.push({type:'dish',id:String(i?.id||i?._id||''),name:i?.name||'Item',price:i?.price,image:i?.image,restaurantId:rid,restaurantName:rn,isVeg:i?.isVeg});});});
      return {dishes:dishes.slice(0,10),restaurants:[]};
    }
    if(state.context==='restaurant'){
      const scoped=await getRestaurantScope(state.restaurantId); state.restaurantName=scoped.restaurant?.name||'';
      const dishes=scoped.items.filter(i=>norm(i?.name).includes(nq)).slice(0,12).map(i=>({type:'dish',id:String(i?.id||i?._id||''),name:i?.name||'Item',price:i?.price,image:i?.image,isVeg:i?.isVeg,restaurantId:state.restaurantId,restaurantName:state.restaurantName}));
      return {dishes,restaurants:[]};
    }
    const rows=await getRestaurants(); const dishes=[],restaurants=[];
    rows.forEach(raw=>{
      const r=raw?.restaurant&&typeof raw.restaurant==='object'?raw.restaurant:raw; const rid=String(r?.id||r?._id||''); const rn=r?.name||'Restaurant'; const cuisine=Array.isArray(r?.cuisine)?r.cuisine.join(', '):String(r?.cuisine||'');
      const rText=norm(`${rn} ${cuisine}`); if(rText.includes(nq))restaurants.push({type:'restaurant',id:rid,name:rn,image:r?.image||r?.img,rating:r?.rating,cuisine});
      const items=Array.isArray(raw?.menu)?raw.menu:(Array.isArray(r?.menu)?r.menu:[]);
      items.forEach(i=>{if(norm(`${i?.name||''} ${i?.category||''}`).includes(nq))dishes.push({type:'dish',id:String(i?.id||i?._id||''),name:i?.name||'Item',price:i?.price,image:i?.image,isVeg:i?.isVeg,restaurantId:rid,restaurantName:rn});});
    });
    return {dishes:dishes.slice(0,8),restaurants:restaurants.slice(0,6)};
  }

  function renderLoading(){ $('ew-search-results').innerHTML='<div class="ew-search-loading"><div class="ew-search-skeleton"></div><div class="ew-search-skeleton"></div><div class="ew-search-skeleton"></div></div>'; }
  function renderError(){ $('ew-search-results').innerHTML='<div class="ew-search-empty"><div class="ew-search-empty-icon"><i class="fa-solid fa-wifi"></i></div><strong>Search is temporarily unavailable</strong><span>Please check your connection and try again.</span></div>'; }

  function renderResults(q,data){
    const sections=[];
    if(data.dishes?.length) sections.push(`<section class="ew-search-section"><h3 class="ew-search-section-title"><span>${state.context==='under99'?'99 Store dishes':'Dishes'}</span></h3>${data.dishes.map(d=>dishHtml(d)).join('')}</section>`);
    if(data.restaurants?.length) sections.push(`<section class="ew-search-section"><h3 class="ew-search-section-title"><span>Restaurants</span></h3>${data.restaurants.map(r=>restaurantHtml(r)).join('')}</section>`);
    $('ew-search-results').innerHTML=sections.length?sections.join(''):`<div class="ew-search-empty"><div class="ew-search-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div><strong>No results for “${esc(q)}”</strong><span>Try another dish, restaurant or cuisine.</span></div>`;
    $('ew-search-results').querySelectorAll('[data-ew-open]').forEach(el=>el.addEventListener('click',()=>{ const type=el.dataset.type,id=el.dataset.id,rid=el.dataset.rid; if(type==='restaurant'&&id)location.href='restaurant.html?id='+encodeURIComponent(id); else if(type==='dish'&&rid)location.href='restaurant.html?id='+encodeURIComponent(rid); }));
  }

  function dishHtml(d){
    const img=safeUrl(d.image); const veg=d.isVeg===true?'<span class="ew-search-veg"><span></span></span>':'';
    return `<button class="ew-search-result" type="button" data-ew-open data-type="dish" data-id="${esc(d.id)}" data-rid="${esc(d.restaurantId)}"><img class="ew-search-thumb ew-search-thumb--dish" src="${esc(img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="ew-search-result-main"><span class="ew-search-result-name">${veg}${esc(d.name)}</span><span class="ew-search-result-sub">${esc(d.restaurantName||'Dish')}</span></div>${d.price!=null?`<span class="ew-search-price">₹${esc(d.price)}</span>`:''}</button>`;
  }
  function restaurantHtml(r){
    const img=safeUrl(r.image); return `<button class="ew-search-result" type="button" data-ew-open data-type="restaurant" data-id="${esc(r.id)}"><img class="ew-search-thumb" src="${esc(img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="ew-search-result-main"><span class="ew-search-result-name">${esc(r.name)}</span><span class="ew-search-result-sub">${esc(r.cuisine||'Restaurant')}</span></div>${r.rating?`<span class="ew-search-price">★ ${esc(r.rating)}</span>`:''}</button>`;
  }

  function wireTriggers(){
    document.querySelectorAll('a[href="search.html"], [data-ew-search]').forEach(el=>{
      el.addEventListener('click',e=>{e.preventDefault();open();});
    });
    if(typeof window.openMenuSearch==='function' && !window.openMenuSearch.__ewWrapped){
      const old=window.openMenuSearch;
      const wrapped=function(){open({context:'restaurant',restaurantId:new URLSearchParams(location.search).get('id')||''});};
      wrapped.__ewWrapped=true; wrapped.__old=old; window.openMenuSearch=wrapped;
    }
  }

  let touchStartY=0,touchStartX=0;
  function swipeHandler(e){
    if(state.open)return; const t=e.touches?.[0]; if(!t)return; touchStartY=t.clientY; touchStartX=t.clientX;
  }
  function swipeEnd(e){
    if(state.open)return; const t=e.changedTouches?.[0]; if(!t)return; const dy=t.clientY-touchStartY,dx=t.clientX-touchStartX;
    if(touchStartY<=28 && dy>52 && Math.abs(dy)>Math.abs(dx)*1.35){e.preventDefault();open();}
  }

  function init(){
    mount(); wireTriggers(); document.addEventListener('touchstart',swipeHandler,{passive:true}); document.addEventListener('touchend',swipeEnd,{passive:false});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)close();});
  }
  window.EatswadaSearch={open,close,search};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
