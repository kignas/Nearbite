(function () {
  'use strict';
  const API_BASE = String(window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://eatswada.onrender.com/api').replace(/\/$/, '');
  const header = document.getElementById('home-header');
  const carousel = document.getElementById('banner-carousel');
  const art = document.getElementById('header-art');
  if (!header || !carousel || !art) return;

  let headers = [];
  let active = 0;
  let touchStartX = 0;
  let autoTimer = null;
  let autoEnabled = false;

  const safeUrl = v => { v = String(v || '').trim(); return (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\//i.test(v) ? v : ''; };
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const theme = v => ['anime','pink','lavender','magenta'].includes(v) ? v : 'anime';

  function render() {
    if (!headers.length) {
      header.dataset.theme = 'anime';
      art.style.backgroundImage = '';
      carousel.innerHTML = `<article class="banner-slide is-active"><div class="banner-copy"><h2 class="banner-title">Good Food.<br><span style="color:#d20a61">Closer to Home.</span></h2><p class="banner-subtitle">Discover great food around Maynaguri.</p><a class="banner-cta" href="restaurants.html">Order Now <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
      return;
    }
    active = (active + headers.length) % headers.length;
    const b = headers[active] || {};
    const t = theme(b.headerTheme);
    header.dataset.theme = t;
    header.dataset.headerIndex = String(active);
    const image = b.mobileImage || b.image || '';
    art.style.backgroundImage = image ? `url("${String(image).replace(/"/g, '%22')}")` : '';
    art.style.backgroundColor = t === 'anime' ? '#fff' : (b.background || 'transparent');

    const title = b.title || 'Good Food. Closer to Home.';
    const subtitle = b.subtitle || 'Discover great food around Maynaguri.';
    const url = safeUrl(b.ctaUrl);
    const cta = b.ctaText || 'Order Now';
    const titleHtml = t === 'anime' && !b.title ? 'Good Food.<br><span style="color:#d20a61">Closer to Home.</span>' : esc(title).replace(/\n/g,'<br>');

    carousel.innerHTML = `<article class="banner-slide is-active ${b.textColor === 'dark' || ['anime','pink','lavender'].includes(t) ? 'text-dark' : ''}">
      <div class="banner-copy">
        ${b.badgeText ? `<span class="banner-badge">${esc(b.badgeText)}</span>` : ''}
        <h2 class="banner-title">${titleHtml}</h2>
        ${subtitle ? `<p class="banner-subtitle">${esc(subtitle)}</p>` : ''}
        ${b.offerText ? `<div class="banner-offer">${esc(b.offerText)}</div>` : ''}
        ${url && cta ? `<a class="banner-cta" href="${esc(url)}">${esc(cta)} <i class="fa-solid fa-arrow-right"></i></a>` : ''}
      </div>
    </article>
    ${headers.length > 1 ? `<div class="banner-controls" role="tablist">${headers.map((_,i)=>`<button type="button" class="banner-dot ${i===active?'is-active':''}" data-banner-index="${i}" aria-label="Show header ${i+1}"></button>`).join('')}</div>` : ''}`;
    carousel.querySelectorAll('.banner-dot').forEach(btn => btn.addEventListener('click', () => go(Number(btn.dataset.bannerIndex))));
  }

  function go(next) {
    if (headers.length < 2) return;
    const old = active;
    active = (next + headers.length) % headers.length;
    const dir = active > old || (old === headers.length - 1 && active === 0) ? 'next' : 'prev';
    header.classList.remove('theme-slide-next','theme-slide-prev');
    void header.offsetWidth;
    header.classList.add(dir === 'next' ? 'theme-slide-next' : 'theme-slide-prev');
    render();
  }

  function onTouchStart(e) { touchStartX = e.changedTouches[0]?.clientX || 0; }
  function onTouchEnd(e) {
    const end = e.changedTouches[0]?.clientX || 0;
    const delta = end - touchStartX;
    if (Math.abs(delta) >= 55 && headers.length > 1) go(active + (delta < 0 ? 1 : -1));
  }
  header.addEventListener('touchstart', onTouchStart, {passive:true});
  header.addEventListener('touchend', onTouchEnd, {passive:true});

  async function load() {
    try {
      const r = await fetch(`${API_BASE}/home-banners`, {headers:{Accept:'application/json'}, cache:'no-store'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      headers = (Array.isArray(j?.data) ? j.data : []).filter(b => b && b.active !== false).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0));
      render();
      if (autoEnabled && headers.length > 1) {
        clearInterval(autoTimer);
        autoTimer = setInterval(()=>go(active+1), 5000);
      }
    } catch (e) {
      console.warn('[Eatswada] Header feed unavailable:', e.message);
      headers = [];
      render();
    }
  }
  load();
})();
