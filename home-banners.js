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

  const safeUrl = (value) => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.startsWith('/') && !v.startsWith('//')) return v;
    if (/^https:\/\//i.test(v)) return v;
    return '';
  };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const theme = (value) => ['anime','pink','lavender','magenta'].includes(value) ? value : 'anime';

  function render() {
    if (!headers.length) {
      header.dataset.theme = 'anime';
      art.style.backgroundImage = '';
      carousel.innerHTML = `<div class="banner-slide is-active"><div class="banner-copy"><h2 class="banner-title">Good food.<br>Close to home.</h2><p class="banner-subtitle">Discover restaurants and dishes around Maynaguri.</p></div></div>`;
      return;
    }
    active = Math.max(0, Math.min(active, headers.length - 1));
    const b = headers[active];
    const t = theme(b.headerTheme);
    header.dataset.theme = t;
    header.dataset.headerIndex = String(active);

    const image = b.mobileImage || b.image || '';
    art.style.backgroundImage = image ? `url("${String(image).replace(/"/g, '%22')}")` : '';
    art.style.backgroundColor = t === 'anime' ? '#fff' : (b.background || 'transparent');

    const url = safeUrl(b.ctaUrl);
    carousel.innerHTML = `
      <article class="banner-slide is-active ${b.textColor === 'dark' || t === 'anime' || t === 'pink' || t === 'lavender' ? 'text-dark' : ''}">
        <div class="banner-copy">
          ${b.badgeText ? `<span class="banner-badge">${esc(b.badgeText)}</span>` : ''}
          <h2 class="banner-title">${esc(b.title || 'Good food. Close to home.')}</h2>
          ${b.subtitle ? `<p class="banner-subtitle">${esc(b.subtitle)}</p>` : ''}
          ${b.offerText ? `<div class="banner-offer">${esc(b.offerText)}</div>` : ''}
          ${url && b.ctaText ? `<a class="banner-cta" href="${esc(url)}">${esc(b.ctaText)} <i class="fa-solid fa-arrow-right"></i></a>` : ''}
        </div>
      </article>
      ${headers.length > 1 ? `<div class="banner-controls" role="tablist" aria-label="Homepage headers">${headers.map((_, i) => `<button type="button" class="banner-dot ${i === active ? 'is-active' : ''}" data-banner-index="${i}" aria-label="Show header ${i + 1}" aria-selected="${i === active}"></button>`).join('')}</div>` : ''}`;

    carousel.querySelectorAll('.banner-dot').forEach(btn => btn.addEventListener('click', () => go(Number(btn.dataset.bannerIndex))));
  }

  function go(next) {
    if (headers.length < 2) return;
    const old = active;
    active = (next + headers.length) % headers.length;
    const direction = active > old || (old === headers.length - 1 && active === 0) ? 'next' : 'prev';
    header.classList.remove('theme-slide-next', 'theme-slide-prev');
    void header.offsetWidth;
    header.classList.add(direction === 'next' ? 'theme-slide-next' : 'theme-slide-prev');
    render();
  }

  function onTouchStart(e) { touchStartX = e.changedTouches[0]?.clientX || 0; }
  function onTouchEnd(e) {
    const end = e.changedTouches[0]?.clientX || 0;
    const delta = end - touchStartX;
    if (Math.abs(delta) > 50 && headers.length > 1) go(active + (delta < 0 ? 1 : -1));
  }
  header.addEventListener('touchstart', onTouchStart, { passive: true });
  header.addEventListener('touchend', onTouchEnd, { passive: true });

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/home-banners`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      headers = (Array.isArray(json?.data) ? json.data : []).filter(b => b && b.active !== false).sort((a,b) => Number(b.priority || 0) - Number(a.priority || 0));
      render();
    } catch (error) {
      console.warn('[Eatswada] Header feed unavailable:', error.message);
      headers = [];
      render();
    }
  }
  load();
})();
