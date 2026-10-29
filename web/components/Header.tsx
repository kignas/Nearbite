/* ================================================================
   EATSWADA — HOME HERO HEADER
   ----------------------------------------------------------------
   Port of `<header class="hero-header" id="home-header">` from index.html.
   Same class names, same element structure, same ids.

   The promo banner carousel slides and the `#banner-controls` dots are filled
   at runtime by `home-banners.js` (a later phase); the skeleton slide is kept
   exactly as the legacy markup ships it.

   The `data-ew-premium-theme="oxblood-gold"` style block below is copied
   verbatim from the index.html `<head>`: it is the header's colour theme.
   ================================================================ */

export default function Header() {
  return (
    <>
      <header className="hero-header" id="home-header">
        <div className="loc-row es-header-item">
          <a
            className="loc-left tap"
            href="/address?view=select"
            aria-label="Change delivery location"
          >
            <span className="loc-pin-wrap" aria-hidden="true">
              <svg
                className="loc-pin-icon"
                viewBox="0 0 24 24"
                fill="none"
                role="img"
                aria-hidden="true"
              >
                <path
                  d="M12 21c-3.45-3.17-6.25-6.62-6.25-10.63A6.25 6.25 0 1 1 18.25 10.37C18.25 14.38 15.45 17.83 12 21Z"
                  fill="currentColor"
                />
                <circle cx="12" cy="10.2" r="2.55" fill="#fff" />
                <circle cx="12" cy="10.2" r="1.05" fill="currentColor" />
              </svg>
            </span>
            <span className="loc-copy">
              <span className="loc-name-row">
                <span className="loc-name" id="loc-name">
                  Home
                </span>
                <i
                  className="fa-solid fa-chevron-down loc-chevron"
                  aria-hidden="true"
                ></i>
              </span>
              <span className="loc-sub" id="loc-sub">
                Choose your delivery location
              </span>
            </span>
          </a>
          <div className="loc-right">
            <a
              className="btn-store tap"
              href="/under99"
              aria-label="Under 99 store"
            >
              <span className="store-top">UNDER</span>
              <span className="store-bot">₹99</span>
            </a>
            <a className="btn-profile tap" href="/profile" aria-label="Profile">
              <span className="profile-initial">S</span>
            </a>
          </div>
        </div>

        <div className="search-row es-header-item">
          <a className="search-box tap" href="/search">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <span
              className="search-text"
              id="search-placeholder"
              aria-label="Search dishes, restaurants and cuisines"
            >
              <span className="search-static">Search </span>
              <span className="search-dish">&quot;Biryani&quot;</span>
            </span>
            <span
              className="search-mic"
              id="header-voice-search"
              role="button"
              tabIndex={0}
              aria-label="Voice search"
            >
              <i className="fa-solid fa-microphone"></i>
            </span>
          </a>
          <button
            type="button"
            className="veg-box tap"
            id="veg-toggle-btn"
            aria-pressed="false"
            aria-label="Show pure veg restaurants only"
          >
            <span className="veg-label-txt">VEG</span>
            <span className="veg-track" id="veg-track">
              <span className="veg-thumb">
                <span className="veg-inner">
                  <span className="veg-inner-dot"></span>
                </span>
              </span>
            </span>
          </button>
        </div>

        <div
          className="banner-wrap es-header-item"
          id="hero-banner-region"
          aria-live="polite"
        >
          <div
            className="header-carousel"
            id="banner-carousel"
            aria-roledescription="carousel"
            aria-label="Promotions"
          >
            <div className="header-carousel-track" id="header-carousel-track">
              <article
                className="header-slide banner-skeleton"
                aria-hidden="true"
              >
                <div className="header-slide__panel">
                  <div className="header-slide__copy">
                    <span className="sk bsk-badge"></span>
                    <span className="sk bsk-title bsk-title-1"></span>
                    <span className="sk bsk-title bsk-title-2"></span>
                    <span className="sk bsk-sub"></span>
                    <span className="sk bsk-sub-2"></span>
                    <span className="sk bsk-cta"></span>
                  </div>
                  <span className="sk bsk-art"></span>
                </div>
              </article>
            </div>
          </div>
          <div
            className="banner-controls"
            id="banner-controls"
            role="tablist"
            aria-label="Choose promotion"
            hidden
          ></div>
        </div>
        <div className="ew-strip" aria-hidden="true">
          Nearby restaurants &middot; Maynaguri
        </div>
      </header>

      <style
        data-ew-premium-theme="oxblood-gold"
        dangerouslySetInnerHTML={{ __html: PREMIUM_THEME_CSS }}
      />
    </>
  );
}

/* Verbatim from the index.html <head> `<style data-ew-premium-theme>`. */
const PREMIUM_THEME_CSS = `
  /* Theme-colored offer strip (mobile). */
  .ew-strip{display:none;}
  @media (max-width:599px){
    .ew-strip{display:flex;align-items:center;justify-content:center;gap:10px;position:relative;z-index:3;
      width:calc(100% + 40px);margin:0 -20px;height:34px;background:var(--hd-primary);color:var(--hd-ink);
      font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;border-radius:0 0 30px 30px;box-shadow:none;}
    .ew-strip::before,.ew-strip::after{content:"";width:26px;height:1px;background:var(--hd-muted);}
  }
  @media (max-width:380px){.ew-strip{width:calc(100% + 28px);margin:0 -14px;}}

  /* Section headings: smaller, with a themed accent bar (accent only). */
  .sec-title,#restaurants-title,#mind-section .sec-title{font-size:16px !important;line-height:1.2 !important;font-weight:800 !important;letter-spacing:-.2px !important;}

  /* Contrast fixes: white pills must show dark/coloured text and icons. */
  .hero-header .store-top{color:#64748B !important;}
  .hero-header .loc-pin-wrap i,.hero-header .loc-pin-icon{color:var(--hd-primary,#E9546B) !important;}

  /* ===== Premium oxblood + gold theme ===== */
  html .hero-header,.hero-header{
    --hd-primary:#5D0D18 !important;--hd-ink:#fff !important;--hd-muted:rgba(255,255,255,.72) !important;
    --hd-accent:#EBCB8B !important;--hd-accent-ink:#5D0D18 !important;--hd-on-light:#5D0D18 !important;
    --hd-cta-bg:#EBCB8B !important;--hd-cta-ink:#3E0710 !important;
  }
  .hero-header .loc-pin-wrap{background:#fff !important;box-shadow:none !important;}
  .hero-header .btn-store,.hero-header .btn-profile{background:#fff !important;border-color:transparent !important;box-shadow:none !important;}
  .hero-header .store-top{color:#7A5A60 !important;}
  .hero-header .search-box,.hero-header .veg-box{box-shadow:none !important;border:0 !important;}
  .hero-header .banner-cta{box-shadow:none !important;font-weight:900 !important;}
  .hero-header .banner-cta__chev{background:rgba(62,7,16,.14) !important;}
  .hero-header .banner-dot{background:rgba(255,255,255,.35) !important;}
  .hero-header .banner-dot.is-active{background:#EBCB8B !important;}
  .sec-title::before{content:"";display:inline-block;width:4px;height:15px;border-radius:3px;background:#5D0D18;margin-right:8px;vertical-align:-2px;}

  /* Shorter, tighter header (mobile) */
  @media (max-width:599px){
    .hero-header{padding-top:8px !important;}
    .loc-row{min-height:44px !important;margin-bottom:7px !important;}
    .banner-wrap{aspect-ratio:2.05/1 !important;border-radius:0 !important;}
    .banner-title{font-size:23px !important;max-width:14ch;}
    .banner-subtitle--default{font-size:18px !important;margin-top:5px !important;}
    .banner-cta{margin-top:8px !important;min-height:36px !important;font-size:13px !important;}
    .banner-cta__chev{width:24px !important;height:24px !important;}
    .ew-strip{height:30px !important;font-size:10px !important;color:#EBCB8B !important;background:var(--hd-primary) !important;
      border-top:1px solid rgba(235,203,139,.28);}
    .ew-strip::before,.ew-strip::after{background:rgba(235,203,139,.55) !important;}
  }
`;
