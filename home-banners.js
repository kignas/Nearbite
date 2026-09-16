(function () {
  'use strict';

  const API_BASE = String(window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://eatswada.onrender.com/api').replace(/\/$/, '');
  const carousel = document.getElementById('banner-carousel');
  const header = document.getElementById('home-header');
  if (!carousel || !header) return;

  let banners = [];
  let active = 0;
  let timer = null;
  let paused = false;
  let touchStartX = 0;
  let touchStartY = 0;

  const safeUrl = (value) => {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.startsWith('/') && !v.startsWith('//')) return v;
    if (/^https:\/\//i.test(v)) return v;
    return '';
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])
  );

  function hexRgb(value) {
    const m = String(value || '').trim().match(/^#([0-9a-f]{6})$/i);
    if (!m) return null;
    return {
      r: parseInt(m[1].slice(0,2), 16),
      g: parseInt(m[1].slice(2,4), 16),
      b: parseInt(m[1].slice(4,6), 16)
    };
  }

  function applyHeaderTheme(banner) {
    const bg = String(banner?.background || '#C50057').trim();
    const rgb = hexRgb(bg);
    const lightBg = rgb
      ? ((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000) > 220
      : false;
    const darkText = banner?.textColor === 'dark' || lightBg;

    header.style.setProperty('--hero-bg', bg);
    header.style.setProperty('--hero-bg-2', bg);
    header.style.setProperty('--hero-ink', darkText ? '#1F2430' : '#FFFFFF');
    header.style.setProperty('--hero-muted', darkText ? '#697386' : 'rgba(255,255,255,.76)');
    header.style.setProperty('--hero-accent', darkText ? '#D20A61' : '#FFD35A');
    header.dataset.theme = lightBg ? 'anime' : 'custom';
  }

  function fallback() {
    header.dataset.theme = 'custom';
    header.style.setProperty('--hero-bg', '#C50057');
    header.style.setProperty('--hero-bg-2', '#8E003E');
    header.style.setProperty('--hero-ink', '#FFFFFF');
    header.style.setProperty('--hero-muted', 'rgba(255,255,255,.76)');
    header.style.setProperty('--hero-accent', '#FFD35A');
    carousel.innerHTML = `
      <div class="banner-fallback">
        <strong>Good food.<br>Close to home.</strong>
        <span>Discover restaurants and dishes around Maynaguri.</span>
      </div>`;
  }

  function render() {
    if (!banners.length) return fallback();

    carousel.innerHTML = banners.map((b, i) => {
      const url = safeUrl(b.ctaUrl);
      const image = esc(b.mobileImage || b.image || '');
      return `
        <article class="banner-slide ${b.textColor === 'dark' ? 'text-dark' : ''}" data-index="${i}">
          ${image ? `<img class="banner-image" src="${image}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async">` : ''}
          <div class="banner-shade"></div>
          <div class="banner-copy">
            ${b.badgeText ? `<span class="banner-badge">${esc(b.badgeText)}</span>` : ''}
            <h2 class="banner-title">${esc(b.title || 'Good food. Close to home.')}</h2>
            ${b.subtitle ? `<p class="banner-subtitle">${esc(b.subtitle)}</p>` : ''}
            ${b.offerText ? `<div class="banner-offer">${esc(b.offerText)}</div>` : ''}
            ${url && b.ctaText ? `<a class="banner-cta" href="${esc(url)}">${esc(b.ctaText)} <i class="fa-solid fa-arrow-right"></i></a>` : ''}
          </div>
        </article>`;
    }).join('');

    if (banners.length > 1) {
      carousel.insertAdjacentHTML('beforeend', `
        <div class="banner-controls" role="tablist" aria-label="Homepage headers">
          ${banners.map((_, i) => `<button type="button" class="banner-dot ${i === active ? 'is-active' : ''}" data-banner-index="${i}" aria-label="Show header ${i + 1}" aria-selected="${i === active}"></button>`).join('')}
        </div>`);
      carousel.querySelectorAll('.banner-dot').forEach(btn => {
        btn.addEventListener('click', () => go(Number(btn.dataset.bannerIndex), true));
      });
    }

    carousel.querySelectorAll('.banner-slide').forEach((slide, i) => {
      slide.classList.toggle('is-active', i === active);
    });

    applyHeaderTheme(banners[active]);
    startTimer();
  }

  function update(direction) {
    const slides = carousel.querySelectorAll('.banner-slide');
    slides.forEach((slide, i) => {
      slide.classList.remove('is-enter-prev');
      if (i === active) {
        slide.classList.add('is-active');
        if (direction < 0) slide.classList.add('is-enter-prev');
      } else {
        slide.classList.remove('is-active');
        slide.classList.add('is-leaving');
      }
    });

    carousel.querySelectorAll('.banner-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === active);
      dot.setAttribute('aria-selected', i === active ? 'true' : 'false');
    });

    applyHeaderTheme(banners[active]);

    window.setTimeout(() => {
      slides.forEach((slide, i) => {
        if (i !== active) slide.classList.remove('is-leaving', 'is-enter-prev');
      });
    }, 520);
  }

  function go(next, manual) {
    if (!banners.length) return;
    const previous = active;
    active = (next + banners.length) % banners.length;
    const direction =
      active > previous || (previous === banners.length - 1 && active === 0) ? 1 : -1;
    update(direction);
    if (manual) startTimer();
  }

  function startTimer() {
    clearInterval(timer);
    if (banners.length < 2) return;
    timer = setInterval(() => {
      if (!paused && !document.hidden) go(active + 1, false);
    }, 7000);
  }

  function onTouchStart(e) {
    const t = e.changedTouches[0];
    touchStartX = t?.clientX || 0;
    touchStartY = t?.clientY || 0;
  }

  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = (t?.clientX || 0) - touchStartX;
    const dy = (t?.clientY || 0) - touchStartY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) || banners.length < 2) return;
    go(active + (dx < 0 ? 1 : -1), true);
  }

  carousel.addEventListener('touchstart', onTouchStart, { passive: true });
  carousel.addEventListener('touchend', onTouchEnd, { passive: true });
  carousel.addEventListener('mouseenter', () => { paused = true; });
  carousel.addEventListener('mouseleave', () => { paused = false; });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startTimer();
    else clearInterval(timer);
  });

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/home-banners`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      banners = Array.isArray(json?.data)
        ? json.data.filter(b => b && (b.image || b.mobileImage))
        : [];
      if (!banners.length) throw new Error('No active headers');
      banners.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
      active = 0;
      render();
    } catch (error) {
      console.warn('[Eatswada] Home headers unavailable:', error.message);
      fallback();
    }
  }

  load();
})();
