document.addEventListener('DOMContentLoaded',()=>{
  const S=window.Eatswada99State,skeleton=document.getElementById('u99-skeleton');
  document.addEventListener('eatswada99:data-ready',()=>skeleton?.classList.add('u99-hidden'));
  const backdrop=document.getElementById('u99-sort-backdrop');
  const syncSort=()=>{document.querySelectorAll('.u99-sort-option').forEach(x=>x.classList.toggle('selected',x.dataset.sortOption===S.sortMode));};
  document.getElementById('u99-sort')?.addEventListener('click',()=>{syncSort();backdrop?.classList.add('open');document.body.classList.add('u99-modal-open')});
  document.addEventListener('click',e=>{if(e.target.closest('[data-sort-action="close"]')||e.target===backdrop){backdrop?.classList.remove('open');document.body.classList.remove('u99-modal-open')}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){backdrop?.classList.remove('open');document.body.classList.remove('u99-modal-open')}});
  window.Eatswada99.loadHero();window.Eatswada99.load();
});
window.showToast=(message)=>{const t=document.getElementById('u99-toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(window.__u99Toast);window.__u99Toast=setTimeout(()=>t.classList.remove('show'),1600)};
