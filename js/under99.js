document.addEventListener('DOMContentLoaded',()=>{
  const S=window.Eatswada99State;
  const skeleton=document.getElementById('u99-skeleton');
  document.addEventListener('eatswada99:data-ready',()=>{
    skeleton?.classList.add('u99-hidden');
  });
  document.getElementById('u99-sort')?.addEventListener('click',()=>{
    const next=S.sortMode==='default'?'rating':S.sortMode==='rating'?'price':'default';
    S.sortMode=next;
    const el=document.getElementById('u99-sort-label');
    if(el)el.textContent=next==='default'?'Sort':next==='rating'?'Top rated':'Price';
    window.Eatswada99Products?.render();
  });
  window.Eatswada99.loadHero();
  window.Eatswada99.load();
});

window.showToast=(message)=>{
  const t=document.getElementById('u99-toast'); if(!t)return;
  t.textContent=message;t.classList.add('show');
  clearTimeout(window.__u99Toast);window.__u99Toast=setTimeout(()=>t.classList.remove('show'),1600);
};
