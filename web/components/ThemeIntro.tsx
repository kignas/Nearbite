"use client";

/* ================================================================
   EATSWADA — ONE-TIME NEW-USER THEME PROMPT
   ----------------------------------------------------------------
   Rendered from the same markup the legacy `eatswada-theme.js` built:
   `.ew-theme-intro` + `.ew-theme-sheet` (styled by eatswada-theme.css).

   Shows only on Home and only when `eatswada_theme_intro_pending` is '1'
   (set by complete-profile.html for new Google accounts); the flag is
   consumed the first time the prompt is shown.
   ================================================================ */
import { useEffect, useState } from "react";
import { consumeThemeIntroPending, isHomePath, setTheme } from "../lib/theme";

export default function ThemeIntro() {
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isHomePath()) return;
    if (!consumeThemeIntroPending()) return;
    // Shown once after mount: the pending flag only exists in localStorage, so
    // it cannot be read during server rendering without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
  }, []);

  if (!show) return null;

  const choose = (choice: string) => {
    setTheme(choice);
    setClosing(true);
    setTimeout(function () {
      setShow(false);
    }, 180);
  };

  return (
    <div
      className={"ew-theme-intro" + (closing ? " is-closing" : "")}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const choice = target.closest("[data-ew-choice]");
        if (!choice) return;
        choose(choice.getAttribute("data-ew-choice") as string);
      }}
    >
      <div
        className="ew-theme-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ewThemeIntroTitle"
      >
        <div className="ew-theme-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z"></path>
          </svg>
        </div>
        <h2 id="ewThemeIntroTitle">Choose your Eatswada look</h2>
        <p>
          Dark mode is easier on the eyes at night. You can change this anytime
          from Profile.
        </p>
        <div className="ew-theme-actions">
          <button
            type="button"
            className="ew-theme-choice ew-theme-light"
            data-ew-choice="light"
          >
            <span className="ew-choice-icon">☀</span>
            <span>Keep light</span>
          </button>
          <button
            type="button"
            className="ew-theme-choice ew-theme-dark"
            data-ew-choice="dark"
          >
            <span className="ew-choice-icon">☾</span>
            <span>Use dark mode</span>
          </button>
        </div>
      </div>
    </div>
  );
}
