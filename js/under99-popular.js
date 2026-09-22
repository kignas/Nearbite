(() => {
  const S=window.Eatswada99State,E=window.Eatswada99,esc=E.esc;
  function getPairs(){
    const seen=new Set(),pairs=[];
    S.restaurants.forEach(r=>r.menu.filter(x=>x.price<=99&&x.inStock).forEach(item=>{
      const key=`${r.id}|${item.id}`;if(seen.has(key))return;seen.add(key);pairs.push({item,r});
    }));
    return pairs.sort((a,b)=>(b.item.isBestseller?1:0)-(a.item.isBestseller?1:0)||(b.item.isRecommended?1:0)-(a.item.isRecommended?1:0)||a.item.price-b.item.price).slice(0,12);
  }
  function render(){
    const rail=document.getElementById('u99-popular-rail');if(!rail)return;
    rail.innerHTML=getPairs().map(({item,r})=>`<article class="u99-pop-card"><div class="u99-pop-image"><img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" decoding="async">${E.renderAddControl(item,r)}</div><div class="u99-pop-name">${esc(item.name)}</div><div class="u99-pop-meta"><span class="u99-pop-price">₹${Math.round(item.price)}</span>${r.rating?`<span class="u99-pop-rating">★ ${esc(r.rating)}</span>`:''}</div><div class="u99-pop-restaurant">${esc(r.name)}</div></article>`).join('');
  }
  document.addEventListener('eatswada99:data-ready',render);
})();
