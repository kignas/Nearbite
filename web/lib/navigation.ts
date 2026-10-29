/* ================================================================
   NEARBITE — PRODUCTION SAFE BACK NAVIGATION
   TypeScript port of legacy `navigation.js`.
   Keeps in-app Back buttons deterministic and prevents accidental
   browser-history / external-page jumps.
   ================================================================ */

/* Legacy compared `location.pathname.split('/').pop()`. The App Router uses
   clean URLs, so a request for `/cart.html` is 301'd away; these mappings
   keep the same parent relationships expressed as clean paths. */
export const PARENT: Record<string, string> = {
  "cart.html": "index.html",
  "orders.html": "index.html",
  "profile.html": "index.html",
  "category.html": "index.html",
  "search.html": "index.html",
  "under99.html": "index.html",
  "restaurant.html": "index.html",
  "support.html": "orders.html",
  "track-order.html": "orders.html",
  "legal.html": "profile.html",
  "privacy-data.html": "profile.html",
  "location-onboarding.html": "index.html",
  "complete-profile.html": "login.html",
  "address-new.html": "index.html",
};

/* Clean-path equivalents, used when the legacy `.html` name is not matched. */
export const PARENT_CLEAN: Record<string, string> = {
  "/cart": "/",
  "/orders": "/",
  "/profile": "/",
  "/category": "/",
  "/search": "/",
  "/under99": "/",
  "/restaurant": "/",
  "/support": "/orders",
  "/track-order": "/orders",
  "/legal": "/profile",
  "/privacy-data": "/profile",
  "/location-onboarding": "/",
  "/complete-profile": "/login",
  "/address-new": "/",
};

function browser(): boolean {
  return typeof window !== "undefined";
}

function currentPage(): string {
  if (!browser()) return "index.html";
  return (location.pathname.split("/").pop() || "index.html").toLowerCase();
}

function isCartReturn(): boolean {
  if (!browser()) return false;
  return new URLSearchParams(location.search).get("return") === "cart";
}

export function nearbiteSafeBack(): void {
  if (!browser()) return;
  const page = currentPage();

  if (page === "address.html" && isCartReturn()) {
    location.replace("cart.html");
    return;
  }

  // Clean-path page → clean-path parent; legacy name → legacy parent.
  const clean = "/" + page.replace(/\.html$/, "");
  const fallback = PARENT[page] || PARENT_CLEAN[clean] || "index.html";

  // Orders → Home uses the same reverse slide as the bottom navigation.
  if (page === "orders.html" || page === "track-order.html") {
    if ((window as any).EatswadaPageTransitions) {
      (window as any).EatswadaPageTransitions.setDirection("back");
    }
  }

  location.replace(fallback);
}

export function premiumBack(): void {
  if (!browser()) return;
  const elementsToHide = document.querySelectorAll(
    ".res-card, .delivery-strip, .filter-bar, .menu-section, .cat-nav, .closed-warning-card"
  );

  elementsToHide.forEach(function (el) {
    el.classList.add("slide-out-active");
  });

  setTimeout(function () {
    nearbiteSafeBack();
  }, 250);
}

/* ── Shared request timeout ────────────────────────────────────
   Several pages use direct fetch() calls instead of api.ts. A cold or
   unavailable backend must not leave Profile, Orders, Tracking, or Menu
   pages on an infinite loading skeleton. Preserve caller abort signals
   while adding a bounded timeout to requests made by page scripts. */
export function installFetchTimeout(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.__nearbiteFetchTimeout) return;

  const nativeFetch = window.fetch.bind(window);
  /* The raw, UNBOUND native `fetch` is exposed before it is wrapped so a page
     whose legacy original never loaded `navigation.js` can still reproduce
     legacy's exact fetch semantics. `payment-failed.html` is such a page: it
     passed the unbound native `fetch` as `EWPaymentVerify.run({fetchImpl})`,
     and that call throws "Illegal invocation" (this === opts), so the legacy
     retry-verify POST never fired and the page fell back to /status polling.
     `lib/payment-failed.ts` reads this to reproduce that exactly. */
  if (!w.__nearbiteNativeFetch) w.__nearbiteNativeFetch = window.fetch;
  const DEFAULT_TIMEOUT_MS = 15000;

  w.fetch = function (input: any, init: any) {
    const options = init ? { ...init } : {};
    const callerSignal = options.signal || (input && input.signal);
    const controller = new AbortController();
    let timedOut = false;
    let timer: any = null;
    let removeCallerAbort: any = null;

    if (callerSignal) {
      if (callerSignal.aborted) controller.abort(callerSignal.reason);
      else {
        removeCallerAbort = function () {
          controller.abort(callerSignal.reason);
        };
        callerSignal.addEventListener("abort", removeCallerAbort, { once: true });
      }
    }

    const timeout = Number(options.timeout || DEFAULT_TIMEOUT_MS);
    delete options.timeout;
    options.signal = controller.signal;

    timer = setTimeout(
      function () {
        timedOut = true;
        controller.abort();
      },
      Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS
    );

    return nativeFetch(input, options)
      .catch(function (error: any) {
        if (timedOut) {
          const timeoutError: any = new Error(
            "The server took too long to respond."
          );
          timeoutError.name = "TimeoutError";
          throw timeoutError;
        }
        throw error;
      })
      .finally(function () {
        clearTimeout(timer);
        if (callerSignal && removeCallerAbort) {
          callerSignal.removeEventListener("abort", removeCallerAbort);
        }
      });
  };

  w.__nearbiteFetchTimeout = true;
}

/* ── Intent-based navigation warming ──────────────────────────
   Do not prefetch several complete HTML documents after every page
   opens. Those requests compete with the page's API calls, fonts and
   images, especially on mobile connections and cold backend starts.
   In the App Router a hover prefetch of a same-origin document is still
   valid, so the same guard is kept. */
export function installFastNavigation(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.__esFastNavigation) return;
  w.__esFastNavigation = true;

  let lastPrefetchUrl = "";

  function prefetch(url: string): void {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin || !/\.html$/i.test(u.pathname)) return;
      if (u.pathname === location.pathname) return;
      if (u.href === lastPrefetchUrl) return;
      if (
        document.querySelector('link[rel="prefetch"][href="' + u.href + '"]')
      )
        return;

      lastPrefetchUrl = u.href;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = u.href;
      (link as any).as = "document";
      document.head.appendChild(link);
    } catch {}
  }

  let hoverTimer: any = null;
  document.addEventListener(
    "pointerover",
    function (e: any) {
      if (e.pointerType === "touch") return;
      const link = e.target.closest && e.target.closest("a[href]");
      if (!link) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        prefetch(link.href);
      }, 120);
    },
    { passive: true }
  );

  document.addEventListener(
    "pointerout",
    function (e: any) {
      if (e.pointerType === "touch") return;
      const link = e.target.closest && e.target.closest("a[href]");
      if (link && !link.contains(e.relatedTarget)) clearTimeout(hoverTimer);
    },
    { passive: true }
  );

  document.addEventListener(
    "pointerdown",
    function (e: any) {
      const link = e.target.closest && e.target.closest("a[href]");
      if (link) prefetch(link.href);
    },
    { passive: true }
  );
}

export function registerServiceWorker(): void {
  if (!browser() || !("serviceWorker" in navigator)) return;
  window.addEventListener(
    "load",
    function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    },
    { once: true }
  );
}

/* Installs `window.nearbiteSafeBack`, `window.goBack`, `window.premiumBack`
   and the two page-script helpers. Called once by `components/ShellRuntime.tsx`. */
export function installNavigation(): void {
  if (!browser()) return;
  const w = window as any;
  if (w.__nearbiteSafeNavigation) return;
  w.__nearbiteSafeNavigation = true;

  w.nearbiteSafeBack = nearbiteSafeBack;
  w.goBack = nearbiteSafeBack;
  w.premiumBack = premiumBack;

  installFetchTimeout();
  installFastNavigation();
  registerServiceWorker();
}

const navigation = {
  nearbiteSafeBack,
  premiumBack,
  installNavigation,
  installFetchTimeout,
  installFastNavigation,
  registerServiceWorker,
  PARENT,
};

export default navigation;
