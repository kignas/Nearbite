"use client";

/* ================================================================
   EATSWADA — DARK-MODE TOGGLE ROW
   ----------------------------------------------------------------
   The Profile "Dark mode" switch. Markup matches `profile.html` exactly
   (`button.row#themeToggleRow[data-ew-theme-toggle]` + `.ew-theme-switch` +
   `[data-ew-theme-state]`), so the shared binder in lib/theme.ts owns the
   click and the `is-on`/`aria-checked` sync.
   ================================================================ */
import { useEffect } from "react";
import { bindThemeSwitches, getTheme, syncSwitches } from "../lib/theme";

export default function ThemeToggle() {
  useEffect(() => {
    syncSwitches(getTheme());
    bindThemeSwitches();
  }, []);

  return (
    <button
      className="row"
      id="themeToggleRow"
      type="button"
      data-ew-theme-toggle=""
      aria-checked="false"
      role="switch"
      aria-label="Toggle dark mode"
    >
      <span className="row-icon" aria-hidden="true">
        <svg className="pf-ico" viewBox="0 0 24 24">
          <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"></path>
        </svg>
      </span>
      <span className="row-main">
        <span className="row-title" style={{ display: "block" }}>
          Dark mode
        </span>
      </span>
      <span className="ew-theme-switch" aria-hidden="true">
        <span data-ew-theme-state="" className="pf-sr">
          Off
        </span>
      </span>
    </button>
  );
}
