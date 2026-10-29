"use client";

/* ================================================================
   EATSWADA — FLOATING CART BAR
   ----------------------------------------------------------------
   Port of the presentation half of legacy `cart-bar.js` (v3).

   Same ids, classes and markup as the legacy script created with innerHTML:
     #white-cart-root (+ .wc-pink), #white-cart-container, .wc-left/.wc-right,
     .wc-btn/.wc-close/.wc-img/.wc-qty-badge, #wc-allup, #wc-item-count,
     #wc-dynamic-res, #wc-dynamic-img-stack, #wc-standard-actions,
     #wc-clear-actions, #es-pink-inner, .wc-pink-*, #ew-cart-drawer-backdrop,
     #ew-cart-drawer, .ew-cd-*.

   The data layer lives in `lib/cart.ts`. The styles are the verbatim legacy
   CSS string, injected as `<style id="wc-styles">`.

   The dynamic regions (item count, restaurant label, image stack, badge,
   "All ↑", display/enter/exit classes) are updated imperatively exactly as
   the legacy renderer did — the JSX renders the shell once and is never
   re-rendered afterwards, so React cannot clobber those updates.
   ================================================================ */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { CART_BAR_CSS } from "../lib/cart-bar.css";
import {
  CART_UPDATED_EVENT,
  FALLBACK_IMG,
  type CartBarMode,
  cartTotals,
  clearCart,
  deliveryMessage,
  formatCurrency,
  getCartBarMode,
  getImageDict,
  installCartGlobals,
  rememberCartImage,
  restaurantGroups,
  safeGetCart,
} from "../lib/cart";

const EXIT_MS = 260;

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.16L21 8H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="20" r="1.4" fill="currentColor" />
      <circle cx="17.5" cy="20" r="1.4" fill="currentColor" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19V6M6 12l6-6 6 6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function escDrawer(v: any): string {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (m: string) =>
      (({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }) as any)[m]
  );
}

function prefersReducedMotion(): boolean {
  return !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function CartBar() {
  const router = useRouter();
  const routerRef = useRef(router);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<CartBarMode>("home");

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    // Read the path after mount: the server cannot know which page this is, and
    // initialising state from `location` would cause a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(getCartBarMode());
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!portalTarget) return;

    const CART_BAR_MODE = mode;
    const w = window as any;

    /* ── 2. THE CSS (injected once, same id as the legacy script) ── */
    if (!document.getElementById("wc-styles")) {
      const s = document.createElement("style");
      s.id = "wc-styles";
      s.innerHTML = CART_BAR_CSS;
      document.head.appendChild(s);
    }

    installCartGlobals();

    /* ── Remove any obsolete/legacy cart bars so exactly ONE remains ── */
    function isBottomNav(el: Element): boolean {
      if (!el) return false;
      const cls = (el.className || "").toString().toLowerCase();
      const id = (el.id || "").toLowerCase();
      return /nav|tabbar|tab-bar|footer/.test(cls + " " + id);
    }
    function removeLegacyCartBars(): void {
      const LEGACY = [
        "#floating-cart",
        "#floating-cart-bar",
        "#floatingCartBar",
        "#cart-bar",
        "#cartBar",
        "#global-cart",
        "#globalCart",
        "#global-cart-bar",
        "#mini-cart",
        "#miniCart",
        "#cart-float",
        "#cartFloat",
        "#sticky-cart",
        "#stickyCart",
        ".floating-cart-bar",
        ".floating-cart",
        ".global-cart-bar",
        ".mini-cart-bar",
        ".sticky-cart-bar",
        "[data-cart-bar]",
      ];
      LEGACY.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (el.id === "white-cart-root" || el.closest("#white-cart-root"))
            return;
          if (el.id === "ew-cart-drawer" || el.closest("#ew-cart-drawer-backdrop"))
            return;
          if (isBottomNav(el)) return;
          el.remove();
          console.info("[Eatswada cart] removed obsolete cart bar:", sel);
        });
      });
    }

    /* ── 4. UI BEHAVIOR LOGIC ── */
    let isDismissed = false;
    let lastTotalQty: number | null = null;
    let lastTotalPrice: number | null = null;
    let lastItemNamesHash: string | null = null;
    let exitTimer: any = null;
    let pinkUpdateTimer: any = null;
    let _lastDrawerGroupsHash: string | null = null;

    function bump(el: any): void {
      if (!el || prefersReducedMotion()) return;
      el.classList.remove("wc-bump");
      void el.offsetWidth;
      el.classList.add("wc-bump");
    }

    function showCartBar(root: any): void {
      if (!root) return;
      if (exitTimer) {
        clearTimeout(exitTimer);
        exitTimer = null;
      }
      root.classList.remove("wc-exiting");
      if (root.style.display === "none" || root.style.display === "") {
        root.style.display = "block";
        root.classList.remove("wc-enter");
        if (!prefersReducedMotion()) {
          void root.offsetWidth;
          root.classList.add("wc-enter");
        }
      }
    }

    function hideCartBar(root: any): void {
      if (!root) return;
      if (root.style.display === "none" || root.style.display === "") return;
      if (exitTimer) {
        clearTimeout(exitTimer);
        exitTimer = null;
      }
      root.classList.remove("wc-enter");
      if (prefersReducedMotion()) {
        root.style.display = "none";
        root.classList.remove("wc-exiting");
        return;
      }
      root.classList.add("wc-exiting");
      exitTimer = setTimeout(() => {
        root.style.display = "none";
        root.classList.remove("wc-exiting");
        exitTimer = null;
      }, EXIT_MS);
    }

    /* ── Positioning: keep the cart bar clear ABOVE any bottom navigation ── */
    function positionCartAboveNav(rootArg?: any): void {
      const root = rootArg || document.getElementById("white-cart-root");
      if (!root) return;

      /*
       * The universal bottom navigation owns --nb-cart-bottom.
       * cart-bar must NOT override that variable on #white-cart-root,
       * otherwise the cart cannot follow the nav when the nav hides/reveals.
       */
      if (CART_BAR_MODE === "home") {
        const nav = document.getElementById("nearbite-bottom-tabbar");
        if (nav) {
          root.style.removeProperty("--nb-cart-bottom");
          root.style.bottom =
            "var(--nb-cart-bottom, calc(16px + env(safe-area-inset-bottom, 0px)))";
        } else {
          root.style.removeProperty("--nb-cart-bottom");
          root.style.bottom = "104px";
        }
        return;
      }

      // 99 Store / Restaurant Menu: keep their lower placement.
      const nav = document.getElementById("nearbite-bottom-tabbar");
      if (nav) {
        const r = nav.getBoundingClientRect();
        const clearance = Math.max(0, window.innerHeight - r.top);
        const newVal = Math.round(clearance) + 8 + "px";
        if (root.style.getPropertyValue("--nb-cart-bottom") !== newVal) {
          root.style.setProperty("--nb-cart-bottom", newVal);
        }
      } else {
        const fallback = "calc(5px + env(safe-area-inset-bottom, 0px))";
        if (root.style.getPropertyValue("--nb-cart-bottom") !== fallback) {
          root.style.setProperty("--nb-cart-bottom", fallback);
        }
      }
    }

    let posRAF: any = null;
    function schedulePos(): void {
      if (posRAF) return;
      posRAF = requestAnimationFrame(() => {
        posRAF = null;
        positionCartAboveNav();
      });
    }

    // The bottom navigation is created by a separate script and changes its
    // hidden/revealed state by updating --nb-cart-bottom on <html>. Watch both
    // DOM creation and the shared CSS variable so the homepage cart follows it.
    let bodyObserver: MutationObserver | null = null;
    let rootStyleObserver: MutationObserver | null = null;
    const navTimeouts: any[] = [];

    function watchBottomNavigation(): void {
      const sync = () => schedulePos();

      bodyObserver = new MutationObserver(() => {
        if (document.getElementById("nearbite-bottom-tabbar")) {
          schedulePos();
          bodyObserver?.disconnect();
        }
      });
      bodyObserver.observe(document.body, { childList: true });

      rootStyleObserver = new MutationObserver(() => schedulePos());
      rootStyleObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style"],
      });

      const check = () => {
        sync();
        if (document.getElementById("nearbite-bottom-tabbar"))
          bodyObserver?.disconnect();
      };
      navTimeouts.push(setTimeout(check, 0));
      navTimeouts.push(setTimeout(check, 100));
      navTimeouts.push(
        setTimeout(function () {
          sync();
          bodyObserver?.disconnect();
        }, 400)
      );
    }

    /* ── Multi-restaurant cart drawer ── */
    function drawerNeedsRender(groups: any[]): boolean {
      const hash =
        groups.length +
        ":" +
        groups.map((g) => `${g.id}:${Math.round(g.units)}`).join("|");
      if (hash !== _lastDrawerGroupsHash) {
        _lastDrawerGroupsHash = hash;
        return true;
      }
      return false;
    }

    function renderCartDrawer(): void {
      const list = document.getElementById("ew-cd-list");
      if (!list) return;
      const groups = restaurantGroups(safeGetCart());
      const newTitle = `Your Carts (${groups.length})`;
      const titleEl = document.getElementById("ew-cd-title");
      if (titleEl && titleEl.textContent !== newTitle)
        titleEl.textContent = newTitle;

      // Only render if drawer content actually changed
      if (drawerNeedsRender(groups)) {
        const newHTML = groups.length
          ? groups
              .map((g) => {
                const u = Math.round(g.units);
                const img =
                  g.image ||
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=180&q=80";
                return `<div class="ew-cd-row"><img class="ew-cd-logo" src="${escDrawer(
                  img
                )}" alt=""><div class="ew-cd-info"><div class="ew-cd-name">${escDrawer(
                  g.name
                )}</div><div class="ew-cd-menu">View Menu <span class="ew-cd-arrow">›</span></div></div><button class="ew-cd-view" type="button" data-cd-view="${escDrawer(
                  g.id
                )}"><strong>View Cart</strong><span>${u} ${
                  u === 1 ? "item" : "items"
                }</span></button></div>`;
              })
              .join("")
          : '<div class="ew-cd-empty">Your cart is empty.</div>';
        list.innerHTML = newHTML;
      }
    }

    function closeCartDrawer(): void {
      const b = document.getElementById("ew-cart-drawer-backdrop");
      const d = document.getElementById("ew-cart-drawer");
      b?.classList.remove("show");
      d?.classList.remove("show");
      document.body.style.overflow = "";
    }

    function openRestaurantCarts(): void {
      renderCartDrawer();
      const b = document.getElementById("ew-cart-drawer-backdrop");
      const d = document.getElementById("ew-cart-drawer");
      if (!b || !d) return;
      b.classList.add("show");
      requestAnimationFrame(() => d.classList.add("show"));
      document.body.style.overflow = "hidden";
    }

    function openCartDrawer(): void {
      const isRestaurant = /restaurant/i.test(
        String(window.location.pathname || "")
      );
      // Restaurant menu: one tap goes straight to the cart page.
      // The multi-restaurant drawer is intentionally a Home-only interaction.
      if (CART_BAR_MODE === "hidden") return;
      if (isRestaurant) {
        routerRef.current.push("/cart");
        return;
      }
      if (CART_BAR_MODE !== "pink") {
        routerRef.current.push("/cart");
        return;
      }
      openRestaurantCarts();
    }

    function updateRestaurantDeliveryMessage(
      savedCart: any,
      totalQty: number
    ): void {
      if (CART_BAR_MODE !== "pink") return;
      const message = document.getElementById("wc-delivery-message-text");
      if (!message) return;
      const root = document.documentElement;
      const data = root && root.dataset ? root.dataset : {};
      message.textContent = deliveryMessage(savedCart, totalQty, data);
    }

    /* ── The single cart-bar renderer ── */
    function updateGlobalCart(): void {
      if (isDismissed || CART_BAR_MODE === "hidden") return;

      const savedCart = safeGetCart();
      const itemNames = Object.keys(savedCart);
      const root = document.getElementById("white-cart-root");
      if (!root) return;

      const countEl = document.getElementById("wc-item-count");

      // Reset the clear-confirm UI (home only).
      const stdActions = document.getElementById("wc-standard-actions");
      const clearActions = document.getElementById("wc-clear-actions");
      if (stdActions && clearActions) {
        if (stdActions.style.display !== "flex")
          stdActions.style.display = "flex";
        if (clearActions.style.display !== "none")
          clearActions.style.display = "none";
      }

      // Keep the drawer live if it happens to be open.
      if (
        document
          .getElementById("ew-cart-drawer-backdrop")
          ?.classList.contains("show")
      )
        renderCartDrawer();

      if (itemNames.length === 0) {
        hideCartBar(root);
        lastTotalQty = null;
        lastTotalPrice = null;
        lastItemNamesHash = null;
        _lastDrawerGroupsHash = null;
        const allup = document.getElementById("wc-allup");
        if (allup) {
          if (allup.classList.contains("show")) allup.classList.remove("show");
        }
        return;
      }

      const { totalQty, totalPrice, priceKnown } = cartTotals(savedCart);

      // Early return if totals are unchanged, but still restore visibility.
      // The customization sheet temporarily hides this root with inline
      // display:none; without these calls an unchanged cart would remain
      // hidden after the sheet closes.
      if (
        lastTotalQty === totalQty &&
        lastTotalPrice === totalPrice &&
        lastItemNamesHash === itemNames.join(",")
      ) {
        updateRestaurantDeliveryMessage(savedCart, totalQty);
        if (root.style.display === "none" || root.style.display === "") {
          positionCartAboveNav(root);
          showCartBar(root);
        }
        return;
      }

      const baseCountText = totalQty === 1 ? "1 item" : `${totalQty} items`;
      // Price shows ONLY on the pink (99 Store / Restaurant) bar. Home = count only.
      const showPrice =
        CART_BAR_MODE === "pink" && priceKnown && totalPrice > 0;
      if (countEl)
        countEl.textContent = showPrice
          ? `${baseCountText} · ${formatCurrency(totalPrice)}`
          : baseCountText;
      updateRestaurantDeliveryMessage(savedCart, totalQty);

      const totalChanged =
        lastTotalQty !== null &&
        (lastTotalQty !== totalQty || lastTotalPrice !== totalPrice);
      if (totalChanged) {
        if (CART_BAR_MODE === "pink") {
          // Restart the pulse by swapping between two equivalent classes.
          // Reading offsetWidth here would force a synchronous layout.
          const useAlt = root.classList.contains("wc-cart-update");
          root.classList.remove("wc-cart-update", "wc-cart-update-alt");
          root.classList.add(useAlt ? "wc-cart-update-alt" : "wc-cart-update");
          if (pinkUpdateTimer) {
            clearTimeout(pinkUpdateTimer);
            pinkUpdateTimer = null;
          }
          pinkUpdateTimer = setTimeout(function () {
            pinkUpdateTimer = null;
            if (root)
              root.classList.remove("wc-cart-update", "wc-cart-update-alt");
          }, 260);
        } else {
          bump(countEl);
        }
      }

      // Home-only visuals: image stack, badge, restaurant label, "All ↑".
      if (CART_BAR_MODE !== "pink") {
        const badgeEl = document.getElementById("wc-qty-badge");
        if (badgeEl) {
          const newBadgeText = totalQty > 99 ? "99+" : String(totalQty);
          if (badgeEl.textContent !== newBadgeText) {
            badgeEl.textContent = newBadgeText;
            if (lastTotalQty !== null && lastTotalQty !== totalQty)
              bump(badgeEl);
          }
        }

        const resEl = document.getElementById("wc-dynamic-res");
        const lastItemName = itemNames[itemNames.length - 1];
        const lastItem = savedCart[lastItemName] || {};
        const newResText =
          lastItem.resName || lastItem.restaurantName || lastItemName;
        if (resEl && resEl.textContent !== newResText)
          resEl.textContent = newResText;

        const imgStackEl = document.getElementById("wc-dynamic-img-stack");
        if (imgStackEl) {
          const imageDict = getImageDict();
          const latestThreeNames = itemNames.slice(-3).reverse();
          const desiredWidth =
            latestThreeNames.length === 1
              ? "36px"
              : latestThreeNames.length === 2
                ? "48px"
                : "60px";
          if (imgStackEl.style.width !== desiredWidth)
            imgStackEl.style.width = desiredWidth;

          // Reuse existing img nodes where possible
          const existingImgs = Array.from(
            imgStackEl.querySelectorAll("img")
          ) as HTMLImageElement[];
          const desiredSrcs = latestThreeNames.map((name) => {
            const itemData = savedCart[name] || {};
            return itemData.image || imageDict[name] || FALLBACK_IMG;
          });

          // Remove excess imgs (walk the snapshot from the end).
          for (let i = existingImgs.length - 1; i >= desiredSrcs.length; i--) {
            const el = existingImgs[i];
            if (el && el.parentElement === imgStackEl)
              imgStackEl.removeChild(el);
          }

          // Update existing nodes in place and append only genuinely new ones.
          for (let i = 0; i < desiredSrcs.length; i++) {
            const existing = existingImgs[i];
            if (existing) {
              if (existing.src !== desiredSrcs[i])
                existing.src = desiredSrcs[i];
              continue;
            }
            const img = document.createElement("img");
            img.src = desiredSrcs[i];
            img.alt = "";
            img.classList.add("wc-img");
            imgStackEl.appendChild(img);
          }
        }

        // "All ↑" appears only when the cart holds items from 2+ restaurants.
        const allup = document.getElementById("wc-allup");
        if (allup) {
          const groups = restaurantGroups(savedCart);
          const shouldShow = groups.length >= 2;
          if (shouldShow && !allup.classList.contains("show")) {
            allup.classList.add("show");
          } else if (!shouldShow && allup.classList.contains("show")) {
            allup.classList.remove("show");
          }
        }
      }

      lastTotalQty = totalQty;
      lastTotalPrice = totalPrice;
      lastItemNamesHash = itemNames.join(",");
      positionCartAboveNav(root);
      showCartBar(root);
    }

    /* ── 5. INITIALIZATION ── */
    const root = document.getElementById("white-cart-root");
    if (CART_BAR_MODE === "hidden" && root) root.style.display = "none";
    removeLegacyCartBars();
    watchBottomNavigation();

    // Clear-cart flow (home only — guarded so pink mode never throws).
    const closeBtn = document.getElementById("wc-close-btn");
    const onCloseClick = (e: any) => {
      e.stopPropagation();
      const s = document.getElementById("wc-standard-actions");
      const c = document.getElementById("wc-clear-actions");
      if (s) s.style.display = "none";
      if (c) c.style.display = "flex";
    };
    if (closeBtn) closeBtn.addEventListener("click", onCloseClick);

    const cancelClear = document.getElementById("wc-cancel-clear");
    const onCancelClick = (e: any) => {
      e.stopPropagation();
      const s = document.getElementById("wc-standard-actions");
      const c = document.getElementById("wc-clear-actions");
      if (c) c.style.display = "none";
      if (s) s.style.display = "flex";
    };
    if (cancelClear) cancelClear.addEventListener("click", onCancelClick);

    const confirmClear = document.getElementById("wc-confirm-clear");
    const onConfirmClick = (e: any) => {
      e.stopPropagation();
      clearCart();
      isDismissed = false;
      const r = document.getElementById("white-cart-root");
      if (r) {
        r.classList.remove("wc-enter", "wc-exiting");
        r.style.display = "none";
      }
      lastTotalQty = null;
      lastTotalPrice = null;
      lastItemNamesHash = null;
    };
    if (confirmClear) confirmClear.addEventListener("click", onConfirmClick);

    const wcLeft = document.querySelector("#white-cart-root .wc-left");
    const onLeftKeydown = (e: any) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        routerRef.current.push("/cart");
      }
    };
    if (wcLeft) wcLeft.addEventListener("keydown", onLeftKeydown);

    w.updateGlobalCart = updateGlobalCart;
    w.__ewOpenCartDrawer = openCartDrawer;
    w.__ewOpenRestaurantCarts = openRestaurantCarts;
    w.__ewCloseCartDrawer = closeCartDrawer;
    if (typeof w.__esGetUpdateGlobalCart === "undefined") {
      w.__esGetUpdateGlobalCart = function () {
        return w.updateGlobalCart;
      };
    }

    // Capture the food image that was tapped, for the cart-bar thumbnail stack.
    const captureImage = (e: any) => {
      const btn = e.target.closest(
        'button, .counter-btn, [onclick*="updateCart"]'
      );
      if (!btn) return;

      let foodName = "";
      const clickCode = btn.getAttribute("onclick");
      if (clickCode) {
        if (clickCode.includes("%7B")) {
          try {
            const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
            if (match) {
              const payload = JSON.parse(decodeURIComponent(match[1]));
              foodName = payload.name;
            }
          } catch {}
        } else {
          const match = clickCode.match(/updateCart\(\s*[`'"]([^`'"]+)[`'"]/);
          if (match) foodName = match[1];
        }
      }

      let wrapper = btn;
      let capturedImg = "";
      while (wrapper && wrapper !== document.body) {
        const img = wrapper.querySelector("img");
        if (
          img &&
          img.src &&
          !img.id.includes("wc-dynamic") &&
          !img.src.includes(".svg")
        ) {
          capturedImg = img.src;
          break;
        }
        wrapper = wrapper.parentElement;
      }

      if (foodName && capturedImg) rememberCartImage(foodName, capturedImg);
    };
    document.addEventListener("click", captureImage, true);

    positionCartAboveNav(root);
    window.addEventListener("orientationchange", schedulePos, { passive: true });
    window.addEventListener("resize", schedulePos, { passive: true });

    if (CART_BAR_MODE === "pink") {
      window.addEventListener("scroll", schedulePos, { passive: true });
    }

    const onPageshow = () => {
      isDismissed = false;
      removeLegacyCartBars();
      if (w.updateGlobalCart) w.updateGlobalCart();
      positionCartAboveNav();
    };
    const onStorage = (e: any) => {
      if (e.key === "nearbite_cart" || e.key === null) {
        if (typeof w.updateGlobalCart === "function") w.updateGlobalCart();
      }
    };
    const onCartUpdated = () => {
      if (typeof w.updateGlobalCart === "function") w.updateGlobalCart();
    };
    window.addEventListener("pageshow", onPageshow);
    window.addEventListener("storage", onStorage);
    // The shared event the cart engine dispatches after every mutation.
    document.addEventListener(CART_UPDATED_EVENT, onCartUpdated);

    updateGlobalCart();

    return () => {
      document.removeEventListener("click", captureImage, true);
      document.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener("pageshow", onPageshow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("orientationchange", schedulePos);
      window.removeEventListener("resize", schedulePos);
      window.removeEventListener("scroll", schedulePos);
      if (closeBtn) closeBtn.removeEventListener("click", onCloseClick);
      if (cancelClear) cancelClear.removeEventListener("click", onCancelClick);
      if (confirmClear)
        confirmClear.removeEventListener("click", onConfirmClick);
      if (wcLeft) wcLeft.removeEventListener("keydown", onLeftKeydown);
      bodyObserver?.disconnect();
      rootStyleObserver?.disconnect();
      navTimeouts.forEach(clearTimeout);
      if (exitTimer) clearTimeout(exitTimer);
      if (pinkUpdateTimer) clearTimeout(pinkUpdateTimer);
      if (posRAF) cancelAnimationFrame(posRAF);
    };
  }, [portalTarget, mode]);

  if (!portalTarget) return null;

  const isPink = mode === "pink";

  return createPortal(
    <>
      <div
        id="white-cart-root"
        className={isPink ? "wc-pink" : undefined}
        style={mode === "hidden" ? { display: "none" } : undefined}
      >
        {isPink ? (
          <button
            type="button"
            id="es-pink-inner"
            aria-label="View cart"
            onClick={() => (window as any).__ewOpenCartDrawer?.()}
          >
            <span
              className="wc-pink-message"
              id="wc-delivery-message"
              aria-live="polite"
            >
              <span className="wc-delivery-message-icon" aria-hidden="true">
                ✦
              </span>
              <span id="wc-delivery-message-text">Your cart is ready</span>
            </span>
            <span className="wc-pink-main">
              <span
                className="wc-pink-left"
                id="wc-item-count"
                aria-live="polite"
              >
                0 items
              </span>
              <span className="wc-pink-cta">
                View Cart <CartIcon />
              </span>
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              id="wc-allup"
              aria-label="View all restaurant carts"
              onClick={(e) => {
                e.stopPropagation();
                (window as any).__ewOpenRestaurantCarts?.();
              }}
            >
              All <UpIcon />
            </button>
            <div id="white-cart-container">
              <button
                type="button"
                className="wc-left"
                aria-label="View cart"
                onClick={() => (window as any).__ewOpenCartDrawer?.()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    routerRef.current.push("/cart");
                  }
                }}
              >
                <div className="wc-thumb-wrap">
                  <div
                    className="wc-image-stack"
                    id="wc-dynamic-img-stack"
                  ></div>
                  <span
                    className="wc-qty-badge"
                    id="wc-qty-badge"
                    aria-hidden="true"
                  >
                    0
                  </span>
                </div>
                <div className="wc-info">
                  <div className="wc-res-name" id="wc-dynamic-res">
                    EatSwada Order
                  </div>
                  <div className="wc-menu-link">
                    Added to cart{" "}
                    <i
                      className="fa-solid fa-check"
                      aria-hidden="true"
                      style={{ fontSize: "10px" }}
                    ></i>
                  </div>
                </div>
              </button>
              <div className="wc-right">
                <div
                  id="wc-standard-actions"
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button
                    type="button"
                    className="wc-btn"
                    onClick={() => (window as any).__ewOpenCartDrawer?.()}
                  >
                    <span className="wc-btn-title">
                      View Cart <CartIcon />
                    </span>
                    <span
                      className="wc-btn-sub"
                      id="wc-item-count"
                      aria-live="polite"
                    >
                      1 item
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wc-close"
                    id="wc-close-btn"
                    aria-label="Clear cart"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>
                <div
                  id="wc-clear-actions"
                  style={{ display: "none", gap: "8px", alignItems: "center" }}
                >
                  <button
                    type="button"
                    className="wc-btn"
                    id="wc-confirm-clear"
                    style={{
                      background:
                        "linear-gradient(135deg, #ef4444 0%, #D64545 100%)",
                    }}
                  >
                    <span className="wc-btn-title">Clear Cart</span>
                    <span className="wc-btn-sub">Remove all items</span>
                  </button>
                  <button
                    type="button"
                    className="wc-close"
                    id="wc-cancel-clear"
                    aria-label="Cancel, keep cart items"
                  >
                    <i
                      className="fa-solid fa-arrow-right-long"
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        id="ew-cart-drawer-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget)
            (window as any).__ewCloseCartDrawer?.();
        }}
      >
        <section
          id="ew-cart-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Your carts"
        >
          <div className="ew-cd-head">
            <div className="ew-cd-title" id="ew-cd-title">
              Your Carts
            </div>
            <button
              className="ew-cd-close"
              type="button"
              aria-label="Close"
              onClick={() => (window as any).__ewCloseCartDrawer?.()}
            >
              ×
            </button>
          </div>
          <div
            className="ew-cd-list"
            id="ew-cd-list"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-cd-view]"))
                routerRef.current.push("/cart");
            }}
          ></div>
          <div className="ew-cd-footer">
            <button
              className="ew-cd-checkout"
              type="button"
              id="ew-cd-checkout"
              onClick={() => routerRef.current.push("/cart")}
            >
              Checkout all <span>›</span>
            </button>
          </div>
        </section>
      </div>
    </>,
    portalTarget
  );
}
