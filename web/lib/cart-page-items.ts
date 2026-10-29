/* =====================================================================
   EATSWADA — CART PAGE ITEMS RENDER  (chunk C4, Phase 2k)
   ---------------------------------------------------------------------
   TypeScript port of legacy `js/cart-page.js`, restricted to the chunk-C4
   ranges named in the task:

     659–771  paintItems (item rows, per-restaurant groups, stepper markup)
     1117–1226 renderCart / repaintCart (reused from C2), cartAdjust /
              ctBumpQty / clearCart (reused from C2)

   `paintItems` is the only function this chunk OWNS. `renderCart`,
   `repaintCart`, `cartAdjust`, `ctBumpQty` and `clearCart` were already
   ported in C2 and are REUSED (not duplicated) — the delegated stepper
   wiring in C2 (`#cart-items-list` click → `cartAdjust`) already drives
   `paintItems` through the `typeof window.paintItems === 'function'` guard,
   so installing C4 turns the rows on with no C2 change.

   Reused from C2: CT_CART_THUMBS, itemImage, vegMark, customLine, esc,
   ctState, getRestaurantNote, restaurantNoteField.
   ===================================================================== */
import {
  ctState,
  esc,
  itemImage,
  vegMark,
  customLine,
  CT_CART_THUMBS,
  getRestaurantNote,
  restaurantNoteField,
} from "./cart-page-state";

const w: any = typeof window !== "undefined" ? window : undefined;

/* Legacy icon constants (L608–613) — defined in C2's file too but kept local
   here so the two chunks stay independent; both are byte-identical SVGs. */
const CT_ICON_PLATE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M7.5 3.5v6.2a2.2 2.2 0 0 0 4.4 0V3.5M9.7 9.7V20.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M16.8 3.5c-1.2 1.4-1.8 3.2-1.8 5.2 0 1.6.6 2.6 1.8 2.9V20.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CT_ICON_TRASH =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<path d="M5.5 7h13M10 4.8h4M9.4 10.5v6M14.6 10.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M7 7h10l-.7 11.1A1.6 1.6 0 0 1 14.7 19.6H9.3a1.6 1.6 0 0 1-1.6-1.5L7 7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

/* ── paintItems — legacy L659–771 ────────────────────────────────────── */
export function paintItems(savedCart: any): void {
  const listEl = document.getElementById("cart-items-list");
  if (!listEl) return;

  const entries: any[] = Object.entries(savedCart || {});
  const groups: any[] = [];
  const byRid = new Map<string, any>();
  for (const [name, info] of entries) {
    const rid = String((info && (info as any).resId) || "legacy");
    if (!byRid.has(rid)) {
      const group = {
        resId: rid,
        name: String(
          (info && ((info as any).resName || (info as any).restaurantName)) ||
            "Restaurant"
        ),
        items: [] as any[],
      };
      byRid.set(rid, group);
      groups.push(group);
    }
    byRid.get(rid).items.push([name, info || {}]);
  }

  const renderRow = (name: string, info: any, anyMedia: boolean) => {
    const price = Number(info.price || 0);
    const original = Number(info.originalPrice || 0);
    const hasDiscount = original > price;
    const discountPct = hasDiscount
      ? Math.round(((original - price) / original) * 100)
      : 0;
    const quantity = Number(info.quantity || 0);
    const itemTotal = quantity * price;
    const itemSavings = hasDiscount ? quantity * (original - price) : 0;
    const img = itemImage(info);
    const media = anyMedia
      ? `
        <div class="ct-media">
          <div class="ct-media-fallback">${CT_ICON_PLATE}</div>
          ${
            img
              ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">`
              : ""
          }
        </div>`
      : "";
    /* At one unit the decrement IS the delete, so the control says so. Same
       data-step="-1", same cartAdjust() path — only the glyph and label change. */
    const last = quantity <= 1;
    const custom = customLine(info.customizations);
    return `
      <div class="ct-row${anyMedia ? " has-media" : ""}" data-name="${esc(name)}">
        ${media}
        <div class="ct-info">
          <div class="ct-name-row">${vegMark(
            info
          )}<span class="ct-name">${esc(name)}</span></div>
          ${custom ? `<div class="ct-custom">${esc(custom)}</div>` : ""}
          <div class="ct-price-line">
            <span class="ct-unit-price ct-num">₹${price}</span>
            ${
              hasDiscount
                ? `<span class="ct-was-price ct-num">₹${original}</span><span class="ct-off-badge">${discountPct}% OFF</span>`
                : ""
            }
          </div>
        </div>
        <div class="ct-right">
          <div>
            <div class="ct-item-total ct-num">₹${itemTotal}</div>
            ${
              hasDiscount
                ? `<div class="ct-item-save ct-num">Save ₹${itemSavings.toFixed(
                    0
                  )}</div>`
                : ""
            }
          </div>
          <div class="ct-stepper${
            last ? " is-last" : ""
          }" role="group" aria-label="Quantity for ${esc(name)}">
            <button type="button" data-step="-1" class="ct-step-down" aria-label="${
              last ? "Remove " + esc(name) : "Decrease quantity"
            }">${
      last ? CT_ICON_TRASH : '<span class="ct-step-glyph" aria-hidden="true">−</span>'
    }</button>
            <span class="ct-qty">${quantity}</span>
            <button type="button" data-step="1" class="ct-step-up" aria-label="Increase quantity"><span class="ct-step-glyph" aria-hidden="true">+</span></button>
          </div>
        </div>
      </div>`;
  };

  listEl.innerHTML = groups
    .map((group, groupIndex) => {
      const anyMedia =
        CT_CART_THUMBS && group.items.some(([, info]: any) => itemImage(info));
      const subtotal = group.items.reduce(
        (sum: number, [, info]: any) =>
          sum + Number(info.price || 0) * Number(info.quantity || 0),
        0
      );
      const units = group.items.reduce(
        (sum: number, [, info]: any) => sum + Number(info.quantity || 0),
        0
      );
      const note =
        group.resId === "legacy"
          ? ctState.restaurantNote
          : getRestaurantNote(group.resId);
      const noteTitle = note ? "Restaurant note added" : "Restaurant note";
      const noteSub = note ? note : "Add a note for this restaurant";
      const href =
        group.resId !== "legacy"
          ? "restaurant.html?id=" + encodeURIComponent(group.resId)
          : "index.html";
      return `
      <section class="ct-restaurant-group" data-restaurant-id="${esc(
        group.resId
      )}">
        <div class="ct-restaurant-head">
          <div class="ct-restaurant-copy">
            <div class="ct-restaurant-name">${esc(group.name)}</div>
            <div class="ct-restaurant-meta">${units} ${
        units === 1 ? "item" : "items"
      } · ₹${subtotal}</div>
          </div>
        </div>
        <div class="ct-restaurant-items">${group.items
          .map(([name, info]: any) => renderRow(name, info, anyMedia))
          .join("")}</div>
        <div class="ct-item-actions ct-group-actions">
          <a class="ct-pill-btn tap" href="${href}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>Add Items
          </a>
          <button type="button" class="ct-pill-btn tap ct-restaurant-note-btn${
            note ? " is-set" : ""
          }" data-note-field="${esc(
        restaurantNoteField(group.resId)
      )}" data-restaurant-id="${esc(
        group.resId
      )}" aria-haspopup="dialog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19h14M7 15l9-9 2 2-9 9H7v-2z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="ct-note-btn-text">${esc(
              note ? "Request added" : "Cooking requests"
            )}</span>
          </button>
        </div>
        ${
          note
            ? `<div class="ct-restaurant-note-preview" data-note-preview="${esc(
                group.resId
              )}">${esc(note)}</div>`
            : ""
        }
      </section>`;
    })
    .join("");
  listEl.setAttribute("aria-busy", "false");

  /* Keep hidden machine-readable values in sync; the brand name is never shown here. */
  const first = entries[0]?.[1] || {};
  const resName = first.resName || first.restaurantName || "Restaurant";
  const hiddenName = document.getElementById("cart-restaurant-name");
  if (hiddenName) hiddenName.innerText = resName;

  /* Visible header line. Deliberately a SEPARATE element from the hidden one
     above, which placeOrder() still reads as the restaurantName fallback — a
     multi-restaurant cart must never send "2 restaurants" to the backend. */
  const headName = document.getElementById("ct-dh-restaurant");
  if (headName) {
    headName.textContent =
      groups.length > 1
        ? groups.length + " restaurants"
        : (groups[0] && groups[0].name) || "";
  }
}

/* ── Installer ───────────────────────────────────────────────────────── */
let installed = false;

export function installCartPageC4(): void {
  if (typeof document === "undefined") return;
  if (installed) return;
  installed = true;

  /* Legacy `paintItems` is a file-scope function (NOT a `window.*` property);
     it is reachable from the other classic scripts by bare name. In the module
     port the sibling chunks reach it through the same `window.X` guard the
     earlier installers use, so it is published here like `paintBill` etc. */
  if (w) {
    w.paintItems = paintItems;
  }
}

export default installCartPageC4;
