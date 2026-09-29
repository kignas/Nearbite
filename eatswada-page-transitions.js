/* ================================================================
   EATSWADA — CROSS-DOCUMENT PAGE TRANSITIONS
   Home ↔ Orders directional navigation state.
   Uses sessionStorage so the outgoing and incoming HTML documents
   share one small navigation intent without changing routing.
   ================================================================ */
(function (window, document) {
  'use strict';

  if (window.__eatswadaPageTransitions) return;
  window.__eatswadaPageTransitions = true;

  var KEY = 'eatswada_nav_direction';
  var CLEAR_AFTER_MS = 1200;

  function validDirection(value) {
    return value === 'forward' || value === 'back';
  }

  function applyDirection(value) {
    if (!validDirection(value)) return;
    document.documentElement.dataset.ewNavDirection = value;

    window.setTimeout(function () {
      if (document.documentElement.dataset.ewNavDirection === value) {
        delete document.documentElement.dataset.ewNavDirection;
      }
      try {
        if (sessionStorage.getItem(KEY) === value) {
          sessionStorage.removeItem(KEY);
        }
      } catch (e) {}
    }, CLEAR_AFTER_MS);
  }

  function readStoredDirection() {
    try {
      var stored = sessionStorage.getItem(KEY);
      if (validDirection(stored)) {
        applyDirection(stored);
        return stored;
      }
    } catch (e) {}
    return null;
  }

  function setDirection(direction) {
    if (!validDirection(direction)) return;
    try {
      sessionStorage.setItem(KEY, direction);
    } catch (e) {}
    applyDirection(direction);
  }

  function navigate(url, direction) {
    if (validDirection(direction)) {
      setDirection(direction);
    }
    window.location.href = url;
  }

  window.EatswadaPageTransitions = {
    setDirection: setDirection,
    navigate: navigate
  };

  /* Read the direction as early as this script is parsed so the
     incoming document has its direction before the transition starts. */
  readStoredDirection();
})(window, document);
