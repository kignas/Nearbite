/* ================================================================
   EATSWADA — FIRST-HOME SAVED-ADDRESS PROMPT
   ----------------------------------------------------------------
   TypeScript port of new-user-location-prompt.js. Shows only for a newly
   created account, only when no saved address exists. The existing
   location-onboarding page is unchanged.

   NOTE: no legacy HTML file references this script (its CSS is not linked
   either); complete-profile.html is the only writer of the pending key.
   Ported as-is for parity; it is a no-op unless that key is set.
   ================================================================ */

const PENDING_KEY = "eatswada_new_user_location_pending";
const SHOWN_KEY = "eatswada_new_user_location_prompt_shown";

function browser(): boolean {
  return typeof window !== "undefined";
}

function accountShownKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem("nearbite_user") || "{}");
    const id = user && (user._id || user.id || user.uid);
    return SHOWN_KEY + (id ? ":" + String(id) : ":current");
  } catch {
    return SHOWN_KEY + ":current";
  }
}
function signedIn(): boolean {
  try {
    return !!(localStorage.getItem("nearbite_token") || localStorage.getItem("token"));
  } catch {
    return false;
  }
}
function consumePending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}
function hasSavedAddress(store: any): boolean {
  if (!store) return false;
  const list = store.getAll ? store.getAll() : [];
  if (Array.isArray(list) && list.length) return true;
  const active = store.getActive && store.getActive();
  return !!(active && (active._id || active.addressId));
}
function waitForThemePrompt(): Promise<void> {
  return new Promise(function (resolve) {
    if (!document.querySelector(".ew-theme-intro")) return resolve();
    const observer = new MutationObserver(function () {
      if (!document.querySelector(".ew-theme-intro")) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
function closeModal(modal: any): void {
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.style.overflow = "";
  window.setTimeout(function () {
    modal.remove();
  }, 230);
}
function showModal(): void {
  if (document.getElementById("ew-location-welcome")) return;
  const modal: any = document.createElement("div");
  modal.className = "ew-location-welcome";
  modal.id = "ew-location-welcome";
  modal.setAttribute("role", "presentation");
  modal.innerHTML =
    '<section class="ew-location-welcome__card" role="dialog" aria-modal="true" aria-labelledby="ewLocationWelcomeTitle" aria-describedby="ewLocationWelcomeCopy">' +
    '<div class="ew-location-welcome__handle" aria-hidden="true"></div>' +
    '<div class="ew-location-welcome__top">' +
    '<div class="ew-location-welcome__copy-wrap">' +
    '<p class="ew-location-welcome__eyebrow">Make Eatswada yours</p>' +
    '<h2 class="ew-location-welcome__title" id="ewLocationWelcomeTitle">Where should we deliver?</h2>' +
    "</div>" +
    '<button class="ew-location-welcome__close" type="button" aria-label="Close">×</button>' +
    "</div>" +
    '<div class="ew-location-welcome__intro">' +
    '<div class="ew-location-welcome__art" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></div>' +
    '<p class="ew-location-welcome__copy" id="ewLocationWelcomeCopy">Save your delivery address once to see restaurants and dishes available near you, and make checkout quicker.</p>' +
    "</div>" +
    '<div class="ew-location-welcome__benefit"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>Your address is saved to your Eatswada account.</span></div>' +
    '<a class="ew-location-welcome__cta" href="address.html?view=select"><i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i> Set delivery address <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>' +
    '<button class="ew-location-welcome__later" type="button">Maybe later</button>' +
    "</section>";
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(function () {
    modal.classList.add("is-open");
  });
  modal
    .querySelector(".ew-location-welcome__close")
    .addEventListener("click", function () {
      closeModal(modal);
    });
  modal
    .querySelector(".ew-location-welcome__later")
    .addEventListener("click", function () {
      closeModal(modal);
    });
  modal.addEventListener("click", function (event: any) {
    if (event.target === modal) closeModal(modal);
  });
  document.addEventListener("keydown", function onKey(event: any) {
    if (event.key === "Escape" && document.getElementById("ew-location-welcome")) {
      closeModal(modal);
      document.removeEventListener("keydown", onKey);
    }
  });
  modal.querySelector(".ew-location-welcome__close").focus();
}
async function run(): Promise<void> {
  if (!signedIn()) return;
  let pending = false;
  try {
    pending = localStorage.getItem(PENDING_KEY) === "1";
  } catch {}
  if (!pending) return;
  const store = (window as any).EatswadaAddressStore;
  if (store && store.hydrate) {
    try {
      await store.hydrate();
    } catch {}
  }
  if (hasSavedAddress(store)) {
    consumePending();
    return;
  }
  let alreadyShown = false;
  try {
    alreadyShown = localStorage.getItem(accountShownKey()) === "1";
  } catch {}
  if (alreadyShown) {
    consumePending();
    return;
  }
  await waitForThemePrompt();
  window.setTimeout(function () {
    if (!signedIn()) return;
    try {
      localStorage.setItem(accountShownKey(), "1");
    } catch {}
    consumePending();
    showModal();
  }, 2000);
}

let promptInstalled = false;
export function installNewUserLocationPrompt(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.__ewNewUserLocationPrompt) return;
  w.__ewNewUserLocationPrompt = true;
  promptInstalled = true;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
}

export default installNewUserLocationPrompt;
