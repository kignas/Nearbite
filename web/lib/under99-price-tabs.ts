/* =====================================================================
   99 STORE — PRICE RANGE CAPSULE
   TypeScript port of legacy `js/under99-price-tabs.js`.
   Moves the sliding thumb, flips active/aria-selected, and dispatches the
   SAME 'eatswada99:filters-changed' event. The state key (S.priceBand) and
   the filtering contract are unchanged — products.js recomputes count + grid.
   ===================================================================== */

export function installUnder99PriceTabs(): void {
  if (typeof window === "undefined") return;
  const S = (window as any).Eatswada99State;
  if (!S) return;
  const tabs = (): any[] => Array.from(document.querySelectorAll(".u99-price-seg [data-price-band]"));

  function sync(): void {
    const list = tabs();
    if (!list.length) return;
    let i = list.findIndex((x: any) => x.dataset.priceBand === S.priceBand);
    if (i < 0) i = 0;
    const thumb = document.querySelector(".u99-price-thumb") as HTMLElement | null;
    if (thumb) thumb.style.transform = "translateX(" + i * 100 + "%)";
    list.forEach((x: any, idx: number) => {
      const on = idx === i;
      x.classList.toggle("active", on);
      x.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest(".u99-price-seg [data-price-band]") as HTMLElement | null;
    if (!b) return;
    if (S.priceBand === (b as any).dataset.priceBand) return; // no-op re-tap
    S.priceBand = (b as any).dataset.priceBand;
    sync(); // 1. animate capsule
    document.dispatchEvent(new Event("eatswada99:filters-changed")); // 2-4. re-filter, recount, keep cart
  });

  document.addEventListener("eatswada99:data-ready", sync);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync);
  } else {
    sync();
  }
}
