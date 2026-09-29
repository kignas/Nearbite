import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import HomeBannerCarousel from './HomeBannerCarousel';

/**
 * Transitional React-owned Home header. Markup and class names are intentionally
 * kept identical to the legacy Home page so its visual system can be verified
 * before event/data logic is migrated.
 */
const headerMarkup = `<header class="hero-header" id="home-header" data-theme="anime">
  <div class="loc-row es-header-item">
    <a class="loc-left tap" href="address.html?view=select" aria-label="Change delivery location">
      <span class="loc-pin-wrap" aria-hidden="true">
        <svg class="loc-pin-icon" viewBox="0 0 24 24" fill="none" role="img" aria-hidden="true">
          <path d="M12 21c-3.45-3.17-6.25-6.62-6.25-10.63A6.25 6.25 0 1 1 18.25 10.37C18.25 14.38 15.45 17.83 12 21Z" fill="currentColor"/>
          <circle cx="12" cy="10.2" r="2.55" fill="#fff"/>
          <circle cx="12" cy="10.2" r="1.05" fill="currentColor"/>
        </svg>
      </span>
      <span class="loc-copy">
        <span class="loc-name-row">
          <span class="loc-name" id="loc-name">Home</span>
          <i class="fa-solid fa-chevron-down loc-chevron" aria-hidden="true"></i>
        </span>
        <span class="loc-sub" id="loc-sub">Choose your delivery location</span>
      </span>
    </a>
    <div class="loc-right">
      <a class="btn-store tap" href="under99.html" aria-label="Under 99 store">
        <span class="store-top">UNDER</span>
        <span class="store-bot">₹99</span>
      </a>
      <a class="btn-profile tap" href="profile.html" aria-label="Profile">
        <span class="profile-initial">S</span>
      </a>
    </div>
  </div>

  <div class="search-row es-header-item">
    <a class="search-box tap" href="search.html">
      <i class="fa-solid fa-magnifying-glass search-icon"></i>
      <span class="search-text" id="search-placeholder" aria-label="Search dishes, restaurants and cuisines">
        <span class="search-static">Search </span><span class="search-dish">"Biryani"</span>
      </span>
      <span class="search-mic" id="header-voice-search" role="button" tabindex="0" aria-label="Voice search">
        <i class="fa-solid fa-microphone"></i>
      </span>
    </a>
    <button type="button" class="veg-box tap" id="veg-toggle-btn" aria-pressed="false" aria-label="Show pure veg restaurants only" hidden>
      <span class="veg-label-txt">VEG</span>
      <span class="veg-track" id="veg-track"><span class="veg-thumb"><span class="veg-inner"><span class="veg-inner-dot"></span></span></span></span>
    </button>
  </div>

  <div class="banner-wrap es-header-item" id="hero-banner-region" aria-live="polite"></div>
</header>`;

export default function HomeHeader() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById('hero-banner-region')); }, []);
  return <><div dangerouslySetInnerHTML={{ __html: headerMarkup }} />{target && createPortal(<HomeBannerCarousel />, target)}</>;
}
