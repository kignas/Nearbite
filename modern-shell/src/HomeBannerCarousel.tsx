import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

type Banner = {
  active?: boolean;
  priority?: number;
  headerTheme?: string;
  theme?: string;
  mobileImage?: string;
  image?: string;
  mobileImageUrl?: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  offerText?: string;
  ctaText?: string;
  ctaUrl?: string;
};

const API_BASE = 'https://api.eatswada.com/api';
const CACHE_KEY = 'es_home_banners_v2';
const CACHE_MAX_AGE = 10 * 60 * 1000;
const allowedThemes = ['anime', 'pink', 'lavender', 'magenta'];

function safeUrl(value?: string) {
  const url = String(value || '').trim();
  return ((url.startsWith('/') && !url.startsWith('//')) || /^https:\/\//i.test(url)) ? url : '';
}
function themeOf(banner?: Banner) {
  const value = String(banner?.headerTheme || banner?.theme || 'pink').toLowerCase();
  return allowedThemes.includes(value) ? value : 'pink';
}
function readCache(): Banner[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!Array.isArray(entry?.value) || !entry.value.length) return null;
    if (entry.savedAt && Date.now() - Number(entry.savedAt) > CACHE_MAX_AGE) return null;
    return entry.value;
  } catch { return null; }
}
function writeCache(value: Banner[]) {
  try {
    if (value.length) sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), value }));
  } catch { /* Storage can be unavailable in private browsing. */ }
}

export default function HomeBannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [active, setActive] = useState(0);
  const startX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => banners.length ? banners : [{}], [banners]);

  useEffect(() => {
    const cached = readCache();
    if (cached) setBanners(cached);
    let alive = true;
    fetch(`${API_BASE}/home-banners`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then(json => {
        const next = (Array.isArray(json?.data) ? json.data : [])
          .filter((item: Banner) => item && item.active !== false)
          .sort((a: Banner, b: Banner) => Number(b.priority || 0) - Number(a.priority || 0));
        writeCache(next);
        if (alive) { setBanners(next); setActive(0); }
      })
      .catch(error => console.warn('[Eatswada] Header feed unavailable:', error));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (list.length < 2) return;
    const timer = window.setInterval(() => setActive(current => (current + 1) % list.length), 5000);
    return () => window.clearInterval(timer);
  }, [list.length]);

  useEffect(() => {
    const header = document.getElementById('home-header');
    if (header) header.dataset.theme = themeOf(list[active]);
  }, [active, list]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => { startX.current = event.clientX; };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null || list.length < 2) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 28) setActive(current => (current + (delta < 0 ? 1 : -1) + list.length) % list.length);
    startX.current = null;
  };

  return <><div className="header-carousel" id="banner-carousel" aria-roledescription="carousel" aria-label="Promotions"
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { startX.current = null; }}>
      <div className="header-carousel-track" id="header-carousel-track" ref={trackRef}
        style={{ transform: `translate3d(-${active * 100}%,0,0)` }}>
        {list.map((banner, index) => {
          const image = safeUrl(banner.mobileImage) || safeUrl(banner.image) || safeUrl(banner.mobileImageUrl) || safeUrl(banner.imageUrl);
          const rawTitle = String(banner.title || '').trim();
          const legacyWelcome = /^welcome\s+to\s+eatswada$/i.test(rawTitle);
          const titleLines = rawTitle && !legacyWelcome ? rawTitle.split('\n') : ['Good Food', 'Closer to Home.'];
          const subtitle = banner.subtitle == null ? '' : String(banner.subtitle).trim();
          const cta = banner.ctaText || 'Order Now';
          return <article className={`header-slide${index === active ? ' is-active' : ''}`} data-theme={themeOf(banner)} role="group" aria-roledescription="slide" aria-label={`Banner ${index + 1}`} key={`${index}-${banner.title || 'default'}`}>
            <div className="header-slide__panel"><div className="header-slide__copy">
              {banner.badgeText && <span className="banner-badge">{banner.badgeText}</span>}
              <h2 className="banner-title">{titleLines[0]}{titleLines.length > 1 && <><br/><span className="banner-title-accent">{titleLines.slice(1).join(' ')}</span></>}</h2>
              {subtitle ? <p className="banner-subtitle">{subtitle}</p> : <p className="banner-subtitle banner-subtitle--default">Tasty food<br/>Happier you. <span className="banner-heart" aria-hidden="true">♥</span></p>}
              {banner.offerText && <div className="banner-offer">{banner.offerText}</div>}
              {cta && <a className="banner-cta" href={safeUrl(banner.ctaUrl) || 'search.html'}>{cta} <span className="banner-cta__chev" aria-hidden="true"><i className="fa-solid fa-chevron-right"/></span></a>}
            </div>{image && <img className="header-slide__art" src={image} alt="" aria-hidden="true" loading={index === 0 ? 'eager' : 'lazy'} decoding="async"/>}</div>
          </article>;
        })}
      </div>
    </div>
    <div className="banner-controls" id="banner-controls" role="tablist" aria-label="Choose promotion" hidden />
  </>;
}
