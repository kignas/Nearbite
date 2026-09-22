
/* Eatswada shared contextual search
   Home -> global search page
   99 Store -> local 99 Store item search
   Restaurant -> current restaurant menu search
*/
(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  const is99 = /\/under99\.html$/.test(path) || path.endsWith('/under99');
  const isRestaurant = /\/restaurant\.html$/.test(path) || path.endsWith('/restaurant');
  const isHome = /\/index\.html$/.test(path) || path.endsWith('/') || path === '';

  function context(){
    if(is99) return {key:'under99',label:'Search 99 Store',placeholder:'Search 99 Store dishes'};
    if(isRestaurant) return {key:'restaurant',label:'Search this restaurant',placeholder:'Search dishes in this menu'};
    return {key:'home',label:'Search Eatswada',placeholder:'Search dishes, restaurants & cuisines'};
  }

  function build(){
    if(document.getElementById('ew-search-sheet')) return;
    const c=context();
    const bd=document.createElement('div');
    bd.className='ew-search-backdrop';
    bd.id='ew-search-backdrop';
    const sh=document.createElement('section');
    sh.className='ew-search-sheet';
    sh.id='ew-search-sheet';
    sh.setAttribute('role','dialog');
    sh.setAttribute('aria-modal','true');
    sh.setAttribute('aria-label',c.label);
    sh.innerHTML=
      '<div class="ew-search-grabber" aria-hidden="true"></div>'+
      '<form class="ew-search-form" id="ew-search-form">'+
      '<span class="ew-search-icon" aria-hidden="true">⌕</span>'+
      '<input class="ew-search-input" id="ew-search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="'+esc(c.placeholder)+'">'+
      '<button class="ew-search-close" id="ew-search-close" type="button" aria-label="Close search">×</button>'+
      '</form>'+
      '<div class="ew-search-context">'+esc(c.label)+'</div>'+
      '<div class="ew-search-hints">'+
      '<button class="ew-search-hint" type="button" data-q="Biryani">Biryani</button>'+
      '<button class="ew-search-hint" type="button" data-q="Momos">Momos</button>'+
      '<button class="ew-search-hint" type="button" data-q="Pizza">Pizza</button>'+
      '<button class="ew-search-hint" type="button" data-q="Rolls">Rolls</button>'+
      '</div>';
    document.body.append(bd,sh);
    bd.addEventListener('click',close);
    sh.querySelector('#ew-search-close').addEventListener('click',close);
    sh.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.q)));
    sh.querySelector('#ew-search-form').addEventListener('submit',e=>{e.preventDefault();submit(sh.querySelector('#ew-search-input').value)});
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function open(value=''){
    build();
    const sh=document.getElementById('ew-search-sheet'),bd=document.getElementById('ew-search-backdrop'),inp=document.getElementById('ew-search-input');
    if(value) inp.value=value;
    bd.classList.add('is-open'); sh.classList.add('is-open');
    document.body.classList.add('ew-search-open');
    requestAnimationFrame(()=>inp.focus({preventScroll:true}));
  }
  function close(){
    document.getElementById('ew-search-sheet')?.classList.remove('is-open');
    document.getElementById('ew-search-backdrop')?.classList.remove('is-open');
    document.body.classList.remove('ew-search-open');
  }

  function submit(raw){
    const q=String(raw||'').trim();
    if(!q) return;
    const c=context();
    if(c.key==='home'){
      location.href='search.html?q='+encodeURIComponent(q);
      return;
    }
    if(c.key==='under99'){
      const S=window.Eatswada99State;
      if(!S || !window.Eatswada99Products){
        location.href='under99.html?q='+encodeURIComponent(q); return;
      }
      S.searchQuery=q;
      close();
      document.dispatchEvent(new Event('eatswada99:filters-changed'));
      return;
    }
    // Restaurant menu already has a local, restaurant-scoped search implementation.
    const input=document.getElementById('menu-search-input');
    if(typeof window.openMenuSearch==='function') window.openMenuSearch();
    if(input){
      input.value=q;
      if(typeof window.onMenuSearchInput==='function') window.onMenuSearchInput();
      else input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    close();
  }

  // Expose one API for existing headers/buttons to open.
  window.EatswadaSearch={open,close,submit,context};

  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-ew-search], .u99-search-btn, #header-search-btn, .search-box');
    if(trigger){
      // Let explicit navigation links on search.html keep their normal behavior.
      if(trigger.tagName==='A' && /search\.html/.test(trigger.getAttribute('href')||'') && !isHome && !is99 && !isRestaurant) return;
      e.preventDefault(); open();
    }
  },true);

  // Pull-down-from-top gesture: only begins at the very top to avoid stealing
  // normal vertical scrolling inside pages.
  let sy=0,sx=0,tracking=false;
  document.addEventListener('touchstart',e=>{
    if(window.scrollY>2 || e.touches.length!==1) return;
    sy=e.touches[0].clientY; sx=e.touches[0].clientX; tracking=true;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!tracking) return;
    const y=e.touches[0].clientY,x=e.touches[0].clientX;
    if(y-sy>42 && Math.abs(y-sy)>Math.abs(x-sx)*1.2){tracking=false;open();}
  },{passive:true});
  document.addEventListener('touchend',()=>tracking=false,{passive:true});

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') close();
    if(e.key==='/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();open();}
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build,{once:true});
  else build();
})();
