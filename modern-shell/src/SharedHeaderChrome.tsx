import type { ChangeEvent } from 'react';
export function HomeHeaderTop() {
  return (
    <div className="loc-row es-header-item">
      <a className="loc-left tap" href="address.html?view=select" aria-label="Change delivery location">
        <span className="loc-pin-wrap" aria-hidden="true">
          <svg className="loc-pin-icon" viewBox="0 0 24 24" fill="none" role="img" aria-hidden="true">
            <path d="M12 21c-3.45-3.17-6.25-6.62-6.25-10.63A6.25 6.25 0 1 1 18.25 10.37C18.25 14.38 15.45 17.83 12 21Z" fill="currentColor" />
            <circle cx="12" cy="10.2" r="2.55" fill="#fff" />
            <circle cx="12" cy="10.2" r="1.05" fill="currentColor" />
          </svg>
        </span>
        <LocationText />
      </a>
      <div className="loc-right">
        <a className="btn-store tap" href="under99.html" aria-label="Under 99 store">
          <span className="store-top">UNDER</span>
          <span className="store-bot">₹99</span>
        </a>
        <a className="btn-profile tap" href="profile.html" aria-label="Profile">
          <span className="profile-initial">S</span>
        </a>
      </div>
    </div>
  );
}

function LocationText() {
  return (
    <span className="loc-copy">
      <span className="loc-name-row">
        <span className="loc-name">Home</span>
        <i className="fa-solid fa-chevron-down loc-chevron" aria-hidden="true" />
      </span>
      <span className="loc-sub">Choose your delivery location</span>
    </span>
  );
}

export type SharedSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
};

export function SharedSearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search',
  ariaLabel = 'Search',
}: SharedSearchBarProps) {
  return (
    <div className="search-box ew-shared-input-search" role="search">
      <i className="fa-solid fa-magnifying-glass search-icon" aria-hidden="true" />
      <input
        className="ew-shared-search-input"
        type="search"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        aria-label={ariaLabel}
      />
      {value ? (
        <button type="button" className="ew-shared-search-clear tap" onClick={onClear} aria-label="Clear search">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      ) : (
        <span className="search-mic" aria-hidden="true">
          <i className="fa-solid fa-magnifying-glass" />
        </span>
      )}
    </div>
  );
}
