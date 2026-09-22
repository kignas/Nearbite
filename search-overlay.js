/* EATSWADA — SHARED PRODUCTION SEARCH OVERLAY
   Contexts:
   - home       -> dish results across visible restaurants
   - under99    -> only <= ₹99 dishes
   - restaurant -> only dishes belonging to the current restaurant

   This intentionally does NOT navigate to search.html or create a separate
   search-results page. Pressing Enter simply keeps the overlay open and
   refreshes the inline results.
*/
(function(){
  'use strict';
  if(window.__EWSHARED_SEARCH__) return;
  window.__EWSHARED_SEARCH__=true;

  const API='https://eatswada.onrender.com/api';
  const MIN=2;
  let root=null,input=null,body=null,contextLabel=null,clearBtn=null;
  let context='home',restaurantId='';
  let debounceTimer=0,requestSeq=0,aborter=null;

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const icon=(name,size=20)=>{
    const common=`width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
    if(name==='back') return `<svg ${common}><path d="M15 18l-6-6 6-6"/></svg>`;
    if(name==='search') return `<svg ${common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`;
    if(name==='x') return `<svg ${common}><path d="M6 6l12 12M18 6 6 18"/></svg>`;
    if(name==='mic') return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><linearGradient id="ewMicGradient" x1="4" y1="4" x2="20" y2="20"><stop offset="0" stop-color="#d9096e"/><stop offset="1" stop-color="#ff4d5f"/></linearGradient></defs><rect x="8" y="3" width="8" height="13" rx="4" stroke="url(#ewMicGradient)" stroke-width="2.2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" stroke="url(#ewMicGradient)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `<svg ${common}><path d="m9 18 6-6-6-6"/></svg>`;
  };

  function detectContext(){
    const path=location.pathname.toLowerCase();
    if(path.endsWith('/under99.html') || path.endsWith('/under99')) return {scope:'under99',restaurantId:''};
    const params=new URLSearchParams(location.search);
    const id=params.get('restaurantId')||params.get('restaurant')||params.get('id')||'';
    if(path.includes('restaurant') && id) return {scope:'restaurant',restaurantId:id};
    return {scope:'home',restaurantId:''};
  }

  function contextText(){
    if(context==='under99') return 'Search 99 Store';
    if(context==='restaurant') return 'Search this restaurant';
    return 'Search Eatswada';
  }

  function ensureStyles(){
    if(document.getElementById('ew-search-overlay-css')) return;
    const link=document.createElement('link');link.id='ew-search-overlay-css';link.rel='stylesheet';link.href='search-overlay.css?v=20260922-2';document.head.appendChild(link);
  }

  function build(){
    if(document.getElementById('ew-search-root')) return document.getElementById('ew-search-root');
    const el=document.createElement('div');
    el.id='ew-search-root';el.className='ew-search-root';el.setAttribute('aria-hidden','true');
    el.innerHTML=`<div class="ew-search-scrim" data-search-close></div>
      <section class="ew-search-sheet" role="dialog" aria-modal="true" aria-label="Search">
        <div class="ew-search-handle" aria-hidden="true"></div>
        <div class="ew-search-head">
          <button class="ew-search-back" type="button" data-search-close aria-label="Close search">${icon('back',24)}</button>
          <div class="ew-search-input-wrap">
            <span class="ew-search-icon">${icon('search',20)}</span>
            <input class="ew-search-input" id="ew-search-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Try 'Sweets'" enterkeyhint="search" />
            <button class="ew-search-clear" type="button" id="ew-search-clear" aria-label="Clear search" hidden>${icon('x',20)}</button>
            <span class="ew-search-divider" aria-hidden="true"></span>
            <button class="ew-search-mic" type="button" id="ew-search-mic" aria-label="Voice search">${icon('mic',22)}</button>
          </div>
        </div>
        <div class="ew-search-context" id="ew-search-context"></div>
        <div class="ew-search-body" id="ew-search-body"></div>
      </section>`;
    document.body.appendChild(el);
    return el;
  }

  function refs(){
    root=build();input=root.querySelector('#ew-search-input');body=root.querySelector('#ew-search-body');contextLabel=root.querySelector('#ew-search-context');clearBtn=root.querySelector('#ew-search-clear');
  }

  function open(prefill=''){
    ensureStyles(); refs();
    const c=detectContext();context=c.scope;restaurantId=c.restaurantId;
    if(contextLabel) contextLabel.textContent=contextText();
    root.classList.add('is-open');root.setAttribute('aria-hidden','false');document.body.classList.add('ew-search-open');
    input.value=prefill||'';
    updateClearButton();
    if(!prefill) renderIdle(); else scheduleSearch(true);
    requestAnimationFrame(()=>input.focus({preventScroll:true}));
  }

  function close(){
    if(!root) return;
    clearTimeout(debounceTimer);if(aborter) aborter.abort();aborter=null;
    root.classList.remove('is-open');root.setAttribute('aria-hidden','true');document.body.classList.remove('ew-search-open');
  }

  function renderIdle(){ body.innerHTML=''; updateClearButton(); }
  function updateClearButton(){ if(!clearBtn) return; clearBtn.hidden=!input.value.trim(); }
  function renderSkeleton(){body.innerHTML='<div class="ew-search-list">'+Array.from({length:5},()=>'<div class="ew-search-skeleton" aria-hidden="true"></div>').join('')+'</div>';}
  function renderState(title,sub){body.innerHTML=`<div class="ew-search-state"><p class="ew-search-state-title">${esc(title)}</p><p class="ew-search-state-sub">${esc(sub)}</p></div>`;}

  async function search(q){
    const seq=++requestSeq;
    if(aborter) aborter.abort();
    aborter=new AbortController();
    renderSkeleton();
    const params=new URLSearchParams({q,scope:context});
    if(context==='restaurant') params.set('restaurantId',restaurantId);
    try{
      const res=await fetch(`${API}/restaurants/search?${params.toString()}`,{signal:aborter.signal,headers:{Accept:'application/json'}});
      const json=await res.json().catch(()=>null);
      if(seq!==requestSeq) return;
      if(!res.ok || !json?.success) throw new Error(json?.message||'Search failed');
      const items=Array.isArray(json?.data?.menuItems)?json.data.menuItems:[];
      renderResults(items,q);
    }catch(err){
      if(err?.name==='AbortError') return;
      renderState('Search is temporarily unavailable','Please check your connection and try again.');
    }
  }

  function scheduleSearch(immediate=false){
    const q=input.value.trim();
    clearTimeout(debounceTimer);
    if(q.length<MIN){renderIdle();return;}
    if(immediate) return search(q);
    debounceTimer=setTimeout(()=>search(q),260);
  }

  function renderResults(items,q){
    if(!items.length){renderState(`No dishes found for “${q}”`,'Try another dish or a different spelling.');return;}
    body.innerHTML='<div class="ew-search-list">'+items.map((item,i)=>{
      const restaurant=item.restaurant||{};
      const image=item.image||item.imageUrl||restaurant.image||restaurant.imageUrl||'';
      return `<button class="ew-search-result" type="button" data-result-index="${i}">
        ${image?`<img class="ew-search-thumb" src="${esc(image)}" alt="" loading="lazy" decoding="async">`:`<span class="ew-search-thumb" aria-hidden="true"></span>`}
        <span class="ew-search-copy"><span class="ew-search-name">${esc(item.name||'Dish')}</span><span class="ew-search-meta">Dish</span></span>
      </button>`;
    }).join('')+`</div>`;
    body.querySelectorAll('[data-result-index]').forEach((btn)=>btn.addEventListener('click',()=>openResult(items[Number(btn.dataset.resultIndex)])));
  }

  function openResult(item){
    const rid=item?.restaurantId||item?.restaurant?.id;
    const iid=item?.id||item?._id;
    if(!rid) return;
    close();
    // The restaurant page can consume focusItem later to scroll/highlight the exact item.
    // No item is added to cart merely by selecting a search result.
    const qs=new URLSearchParams({id:String(rid)});
    if(iid) qs.set('focusItem',String(iid));
    location.href=`restaurant.html?${qs.toString()}`;
  }


  function bind(){
    document.addEventListener('click',(e)=>{
      const trigger=e.target.closest('a[href="search.html"],a[href$="/search.html"],.search-box[data-search-trigger],.u99-search-btn');
      if(!trigger) return;
      e.preventDefault();e.stopPropagation();open();
    },true);
    document.addEventListener('click',(e)=>{
      const closeBtn=e.target.closest('[data-search-close]');if(closeBtn){e.preventDefault();close();}
    });
    document.addEventListener('input',(e)=>{if(e.target!==input) return; updateClearButton(); scheduleSearch(false);});
    document.addEventListener('click',(e)=>{if(e.target.closest('#ew-search-clear')){e.preventDefault(); input.value=''; updateClearButton(); renderIdle(); input.focus({preventScroll:true});}});
    document.addEventListener('keydown',(e)=>{
      if(e.target!==input) return;
      if(e.key==='Enter'){e.preventDefault();scheduleSearch(true);}
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    document.addEventListener('click',(e)=>{
      if(e.target.closest('#ew-search-mic')) startVoice();
    });
  }

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){input.focus();return;}
    const recognition=new SR();recognition.lang='en-IN';recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onresult=e=>{input.value=e.results?.[0]?.[0]?.transcript||'';scheduleSearch(true);};
    try{recognition.start();}catch(_){input.focus();}
  }

  ensureStyles();bind();
  window.openEatswadaSearch=open;
  window.closeEatswadaSearch=close;
})();
