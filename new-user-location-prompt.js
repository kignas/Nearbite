/* ================================================================
   EATSWADA — first-home saved-address prompt
   Shows only for a newly created account, only when no saved address
   exists. The existing location-onboarding page remains unchanged.
   ================================================================ */
(function () {
  'use strict';
  if (window.__ewNewUserLocationPrompt) return;
  window.__ewNewUserLocationPrompt = true;

  var PENDING_KEY = 'eatswada_new_user_location_pending';
  var SHOWN_KEY = 'eatswada_new_user_location_prompt_shown';
  function accountShownKey() {
    try {
      var user = JSON.parse(localStorage.getItem('nearbite_user') || '{}');
      var id = user && (user._id || user.id || user.uid);
      return SHOWN_KEY + (id ? ':' + String(id) : ':current');
    } catch (_) { return SHOWN_KEY + ':current'; }
  }

  function signedIn() {
    try { return !!(localStorage.getItem('nearbite_token') || localStorage.getItem('token')); }
    catch (_) { return false; }
  }
  function consumePending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
  }
  function hasSavedAddress(store) {
    if (!store) return false;
    var list = store.getAll ? store.getAll() : [];
    if (Array.isArray(list) && list.length) return true;
    var active = store.getActive && store.getActive();
    return !!(active && (active._id || active.addressId));
  }
  function waitForThemePrompt() {
    return new Promise(function (resolve) {
      if (!document.querySelector('.ew-theme-intro')) return resolve();
      var observer = new MutationObserver(function () {
        if (!document.querySelector('.ew-theme-intro')) {
          observer.disconnect(); resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(function () { modal.remove(); }, 230);
  }
  function showModal() {
    if (document.getElementById('ew-location-welcome')) return;
    var modal = document.createElement('div');
    modal.className = 'ew-location-welcome';
    modal.id = 'ew-location-welcome';
    modal.setAttribute('role', 'presentation');
    modal.innerHTML =
      '<section class="ew-location-welcome__card" role="dialog" aria-modal="true" aria-labelledby="ewLocationWelcomeTitle" aria-describedby="ewLocationWelcomeCopy">' +
        '<button class="ew-location-welcome__close" type="button" aria-label="Close">×</button>' +
        '<div class="ew-location-welcome__art" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></div>' +
        '<p class="ew-location-welcome__eyebrow">One quick step</p>' +
        '<h2 class="ew-location-welcome__title" id="ewLocationWelcomeTitle">Save your delivery address</h2>' +
        '<p class="ew-location-welcome__copy" id="ewLocationWelcomeCopy">Your location permission helps us find you, but you still need to save a delivery address before you can order.</p>' +
        '<a class="ew-location-welcome__cta" href="address.html?view=select"><i class="fa-solid fa-map-pin" aria-hidden="true"></i> Set delivery address</a>' +
        '<button class="ew-location-welcome__later" type="button">I’ll do this later</button>' +
      '</section>';
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    modal.querySelector('.ew-location-welcome__close').addEventListener('click', function () { closeModal(modal); });
    modal.querySelector('.ew-location-welcome__later').addEventListener('click', function () { closeModal(modal); });
    modal.addEventListener('click', function (event) { if (event.target === modal) closeModal(modal); });
    document.addEventListener('keydown', function onKey(event) {
      if (event.key === 'Escape' && document.getElementById('ew-location-welcome')) {
        closeModal(modal); document.removeEventListener('keydown', onKey);
      }
    });
    modal.querySelector('.ew-location-welcome__close').focus();
  }
  async function run() {
    if (!signedIn()) return;
    var pending = false;
    try { pending = localStorage.getItem(PENDING_KEY) === '1'; } catch (_) {}
    if (!pending) return;

    var store = window.EatswadaAddressStore;
    if (store && store.hydrate) {
      try { await store.hydrate(); } catch (_) {}
    }
    if (hasSavedAddress(store)) { consumePending(); return; }

    // The prompt is one-time on this device/account flow; dismissing it does
    // not interrupt browsing, and the header remains available for later.
    var alreadyShown = false;
    try { alreadyShown = localStorage.getItem(accountShownKey()) === '1'; } catch (_) {}
    if (alreadyShown) { consumePending(); return; }
    await waitForThemePrompt();
    window.setTimeout(function () {
      if (!signedIn()) return;
      try { localStorage.setItem(accountShownKey(), '1'); } catch (_) {}
      consumePending();
      showModal();
    }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
