(() => {
  const S=window.Eatswada99State, esc=window.Eatswada99.esc;
  function getItems(){
    const seen=new Set(),items=[];
    S.restaurants.forEach(r=>r.menu.filter(x=>x.price<=99).forEach(item=>{
      const key=String(item.id||`${r.id}|${item.name}`);
      if(!seen.has(key)){seen.add(key);items.push({...item,resId:r.id,resName:r.name,rating:r.rating,ratingCount:r.ratingCount})}
    }));
    return items.sort((a,b)=>(b.isBestseller?1:0)-(a.isBestseller?1:0)||a.price-b.price).slice(0,12);
  }
  function render(){
    const rail=document.getElementById('u99-popular-rail');if(!rail)return;
    rail.innerHTML=getItems().map(item=>`
      <article class="u99-pop-card">
        <div class="u99-pop-image">
          <img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">
          <button class="u99-pop-add" data-pop-add="${esc(item.id)}" aria-label="Add ${esc(item.name)}">+</button>
        </div>
        <div class="u99-pop-name">${esc(item.name)}</div>
        <span class="u99-pop-price">₹${Math.round(item.price)}</span>
        <div class="u99-pop-rating">★ ${item.rating?esc(item.rating):'4.2'}${item.ratingCount?' ('+esc(item.ratingCount)+')':''}</div>
      </article>`).join('');
  }
  document.addEventListener('eatswada99:data-ready',render);
})();
