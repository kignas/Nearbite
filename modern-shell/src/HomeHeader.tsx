import HomeBannerCarousel from './HomeBannerCarousel';
import { HomeHeaderTop } from './SharedHeaderChrome';

export default function HomeHeader() {
  return (
    <header className="hero-header" id="home-header" data-theme="anime">
      <HomeHeaderTop />
      <div className="search-row es-header-item">
        <a className="search-box tap" href="search.html" aria-label="Search dishes, restaurants and cuisines">
          <i className="fa-solid fa-magnifying-glass search-icon" aria-hidden="true" />
          <span className="search-text" id="search-placeholder">
            <span className="search-static">Search </span><span className="search-dish">"Biryani"</span>
          </span>
          <span className="search-mic" id="header-voice-search" role="button" tabIndex={0} aria-label="Voice search">
            <i className="fa-solid fa-microphone" />
          </span>
        </a>
        <button type="button" className="veg-box tap" id="veg-toggle-btn" aria-label="Show pure veg restaurants only" hidden>
          <span className="veg-label-txt">VEG</span>
          <span className="veg-track" id="veg-track"><span className="veg-thumb"><span className="veg-inner"><span className="veg-inner-dot" /></span></span></span>
        </button>
      </div>
      <div className="banner-wrap es-header-item" id="hero-banner-region" aria-live="polite">
        <HomeBannerCarousel />
      </div>
    </header>
  );
}
