/* =====================================================================
   99 STORE — BOOT + SORT SHEET
   TypeScript port of legacy `js/under99.js`. Runs on DOMContentLoaded in
   legacy; here it is invoked by <Under99Runtime/> after the other modules
   are installed (same effective order).
   ===================================================================== */

const LABELS: Record<string, string> = {
  default: "Recommended",
  rating: "Rating: High to Low",
  price: "Price: Low to High",
  "price-desc": "Price: High to Low",
  delivery: "Delivery time",
};

export function installUnder99Boot(): void {
  if (typeof window === "undefined") return;
  const S = (window as any).Eatswada99State;
  const E = (window as any).Eatswada99;
  if (!S || !E) return;
  const backdrop = document.getElementById("u99-sort-backdrop");
  let sortDraft = S.sortMode;

  const syncSort = () => {
    document
      .querySelectorAll(".u99-sort-option")
      .forEach((x: any) => x.classList.toggle("selected", x.dataset.sortOption === sortDraft));
  };
  const openSort = () => {
    sortDraft = S.sortMode;
    syncSort();
    backdrop?.classList.add("open");
    document.body.classList.add("u99-modal-open");
  };
  const closeSort = () => {
    backdrop?.classList.remove("open");
    document.body.classList.remove("u99-modal-open");
  };

  document.getElementById("u99-sort")?.addEventListener("click", openSort);

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const opt = target.closest("[data-sort-option]") as HTMLElement | null;
    if (opt) {
      sortDraft = (opt as any).dataset.sortOption;
      syncSort();
      return;
    }
    if (target.closest('[data-sort-action="apply"]')) {
      S.sortMode = sortDraft;
      const lbl = document.getElementById("u99-sort-label");
      if (lbl) lbl.textContent = S.sortMode === "default" ? "Sort" : LABELS[S.sortMode] || "Sort";
      closeSort();
      (window as any).Eatswada99Products?.render();
      return;
    }
    if (target.closest('[data-sort-action="close"]') || target === backdrop) closeSort();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSort();
  });

  E.loadHero();
  E.load();
}

export function installToast(): void {
  if (typeof window === "undefined") return;
  (window as any).showToast = (message: string) => {
    const t = document.getElementById("u99-toast");
    if (!t) return;
    t.textContent = message;
    t.classList.add("show");
    clearTimeout((window as any).__u99Toast);
    (window as any).__u99Toast = setTimeout(() => t.classList.remove("show"), 1600);
  };
}
