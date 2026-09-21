(() => {
  const S=window.Eatswada99State, Q=window.Eatswada99.qs;
  let draft=null;
  function open(){
    draft={discountOnly:S.discountOnly,foodType:S.foodType,priceRanges:[...S.priceRanges],deliveryLimit:S.deliveryLimit};
    document.getElementById('u99-filter-backdrop')?.classList.add('open');
    document.body.classList.add('u99-modal-open');
    sync();
  }
  function close(){document.getElementById('u99-filter-backdrop')?.classList.remove('open');document.body.classList.remove('u99-modal-open')}
  function sync(){
    document.querySelectorAll('[data-filter-choice]').forEach(b=>{
      const type=b.dataset.filterChoice,value=b.dataset.value;
      let on=false;
      if(type==='food')on=draft.foodType===value;
      if(type==='delivery')on=String(draft.deliveryLimit)===value;
      if(type==='discount')on=draft.discountOnly===true;
      b.classList.toggle('selected',on);
    });
  }
  function apply(){
    S.discountOnly=draft.discountOnly;S.foodType=draft.foodType;S.priceRanges=[...draft.priceRanges];S.deliveryLimit=draft.deliveryLimit;
    close();document.dispatchEvent(new Event('eatswada99:filters-changed'));
  }
  function clear(){draft={discountOnly:true,foodType:'all',priceRanges:[],deliveryLimit:null};sync()}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-filter-action]');
    if(!b)return;
    const action=b.dataset.filterAction;
    if(action==='open')open();
    if(action==='close')close();
    if(action==='apply')apply();
    if(action==='clear')clear();
    if(action==='discount'){S.discountOnly=!S.discountOnly;document.dispatchEvent(new Event('eatswada99:filters-changed'))}
    const choice=e.target.closest('[data-filter-choice]');
    if(choice&&draft){
      const t=choice.dataset.filterChoice,v=choice.dataset.value;
      if(t==='food')draft.foodType=v;
      if(t==='delivery')draft.deliveryLimit=Number(v);
      if(t==='discount')draft.discountOnly=!draft.discountOnly;
      sync();
    }
  });
  document.addEventListener('click',e=>{if(e.target.id==='u99-filter-backdrop')close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
