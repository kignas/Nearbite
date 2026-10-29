/* =====================================================================
   99 STORE — FILTERS (rail + bottom sheet)
   TypeScript port of legacy `js/under99-filters.js`.
   Sections: Offers & Pricing (multi) / Delivery time (single) / Veg (single).
   Applies to the shared state; rail chips reflect the active filters.
   ===================================================================== */

interface Draft {
  discountOnly: boolean;
  freeDeliveryOnly: boolean;
  greatOffersOnly: boolean;
  deliveryLimit: number | null;
  foodType: "all" | "veg" | "nonveg";
}

export function installUnder99Filters(): void {
  if (typeof window === "undefined") return;
  const S = (window as any).Eatswada99State;
  const I = (window as any).U99Icons;
  if (!S) return;
  let draft: Draft | null = null;

  const snapshot = (): Draft => ({
    discountOnly: S.discountOnly,
    freeDeliveryOnly: S.freeDeliveryOnly,
    greatOffersOnly: S.greatOffersOnly,
    deliveryLimit: S.deliveryLimit,
    foodType: S.foodType,
  });

  function activeCount(d: Draft): number {
    return (
      (d.discountOnly ? 1 : 0) +
      (d.freeDeliveryOnly ? 1 : 0) +
      (d.greatOffersOnly ? 1 : 0) +
      (d.deliveryLimit != null ? 1 : 0) +
      (d.foodType !== "all" ? 1 : 0)
    );
  }

  function sync(): void {
    if (!draft) return;
    document.querySelectorAll("[data-filter-choice]").forEach((b: any) => {
      const type = b.dataset.filterChoice;
      const value = b.dataset.value;
      let on = false;
      if (type === "offer")
        on =
          value === "discount"
            ? draft!.discountOnly
            : value === "free"
              ? draft!.freeDeliveryOnly
              : draft!.greatOffersOnly;
      if (type === "delivery") on = String(draft!.deliveryLimit) === value;
      if (type === "food") on = draft!.foodType === value;
      b.classList.toggle("selected", on);
      const box = b.querySelector(".u99-check");
      if (box) box.innerHTML = on ? I.icon("check", { size: 14 }) : "";
    });
    const btn = document.querySelector(".u99-apply");
    if (btn) {
      const n = activeCount(draft);
      btn.textContent = n ? "Apply (" + n + ")" : "Apply";
    }
  }

  function open(): void {
    draft = snapshot();
    document.getElementById("u99-filter-backdrop")?.classList.add("open");
    document.body.classList.add("u99-modal-open");
    sync();
  }
  function close(): void {
    document.getElementById("u99-filter-backdrop")?.classList.remove("open");
    document.body.classList.remove("u99-modal-open");
  }

  function apply(): void {
    if (!draft) return;
    S.discountOnly = draft.discountOnly;
    S.freeDeliveryOnly = draft.freeDeliveryOnly;
    S.greatOffersOnly = draft.greatOffersOnly;
    S.deliveryLimit = draft.deliveryLimit;
    S.foodType = draft.foodType;
    close();
    reflectRail();
    document.dispatchEvent(new Event("eatswada99:filters-changed"));
  }

  function clear(): void {
    draft = {
      discountOnly: false,
      freeDeliveryOnly: false,
      greatOffersOnly: false,
      deliveryLimit: null,
      foodType: "all",
    };
    sync();
  }

  /* rail chips reflect committed state */
  function reflectRail(): void {
    document.getElementById("u99-discount")?.classList.toggle("active", S.discountOnly);
    document.querySelector('[data-rail="delivery"]')?.classList.toggle("active", S.deliveryLimit != null);
    document.querySelector('[data-rail="food"]')?.classList.toggle("active", S.foodType !== "all");
  }

  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-filter-action]") as HTMLElement | null;
    if (b) {
      const a = (b as any).dataset.filterAction;
      if (a === "open") open();
      if (a === "close") close();
      if (a === "apply") apply();
      if (a === "clear") clear();
      if (a === "discount") {
        // rail quick-toggle
        S.discountOnly = !S.discountOnly;
        reflectRail();
        document.dispatchEvent(new Event("eatswada99:filters-changed"));
      }
    }
    const choice = (e.target as HTMLElement).closest("[data-filter-choice]") as HTMLElement | null;
    if (choice && draft) {
      const t = (choice as any).dataset.filterChoice;
      const v = (choice as any).dataset.value;
      if (t === "offer") {
        if (v === "discount") draft.discountOnly = !draft.discountOnly;
        if (v === "free") draft.freeDeliveryOnly = !draft.freeDeliveryOnly;
        if (v === "great") draft.greatOffersOnly = !draft.greatOffersOnly;
      }
      if (t === "delivery") draft.deliveryLimit = String(draft.deliveryLimit) === v ? null : Number(v);
      if (t === "food") draft.foodType = v;
      sync();
    }
  });

  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "u99-filter-backdrop") close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  document.addEventListener("eatswada99:data-ready", reflectRail);
}
