(() => {
  const S=window.Eatswada99State, E=window.Eatswada99, esc=window.Eatswada99.esc;

  // One entry per real menu item, de-duplicated by (restaurantId | menuItemId)
  // — NEVER by name, so two restaurants' "Samosa" both remain.
  function getPairs(){
    const seen=new Set(), pairs=[];
    S.restaurants.forEach(r=>r.menu.filter(x=>x.price<=99).forEach(item=>{
      const key=`${r.id}|${item.id||item._id}`;
      if(seen.has(key))return; seen.add(key);
      pairs.push({item,r});
    }));
    return pairs
      .sort((a,b)=>(b.item.isBestseller?1:0)-(a.item.isBestseller?1:0)||a.item.price-b.item.price)
      .slice(0,12);
  }

  function render(){
    const rail=document.getElementById('u99-popular-rail');if(!rail)return;
    // image, name, price, rating AND the add control all come from the SAME
    // {item,r} pair — no cross-wiring between different source items.
    rail.innerHTML=getPairs().map(({item,r})=>`
      <article class="u99-pop-card">
        <div class="u99-pop-image">
          <img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">
          ${E.renderAddControl(item,r)}
        </div>
        <div class="u99-pop-name">${esc(item.name)}</div>
        <span class="u99-pop-price">₹${Math.round(item.price)}</span>
        <div class="u99-pop-rating">★ ${r.rating?esc(r.rating):'4.2'}${r.ratingCount?' ('+esc(r.ratingCount)+')':''}</div>
      </article>`).join('');
  }

  document.addEventListener('eatswada99:data-ready',render);
})();
