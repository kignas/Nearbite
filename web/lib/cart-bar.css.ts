/* ================================================================
   EATSWADA — FLOATING CART BAR STYLES
   ----------------------------------------------------------------
   Verbatim copy of the `const CSS = \`...\`` string in legacy `cart-bar.js`.
   It is injected as `<style id="wc-styles">` by components/CartBar.tsx,
   exactly as the legacy script did, so every selector keeps working.
   Do not "clean up" or convert to Tailwind.
   ================================================================ */
export const CART_BAR_CSS = `
    /* Font is inherited from the global Eatswada typography system (Manrope). */

    @keyframes slideUpWhiteCart {
      0% { transform: translate(-50%, 150%); opacity: 0; }
      100% { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideDownWhiteCart {
      0% { transform: translate(-50%, 0); opacity: 1; }
      100% { transform: translate(-50%, 130%); opacity: 0; }
    }
    @keyframes wcBump {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
    @keyframes wcPinkEnter {
      0% { transform: translate(-50%, 130%) scale(.96); opacity:0; }
      70% { transform: translate(-50%, -4px) scale(1.015); opacity:1; }
      100% { transform: translate(-50%, 0) scale(1); opacity:1; }
    }
    @keyframes wcPinkPulse {
      0% { transform: scale(1); }
      38% { transform: scale(1.024); }
      72% { transform: scale(.995); }
      100% { transform: scale(1); }
    }
    @keyframes wcPinkTextBump {
      0% { transform: translateY(0); opacity:1; }
      35% { transform: translateY(-2px); opacity:.86; }
      100% { transform: translateY(0); opacity:1; }
    }
    @keyframes wcShine {
      0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
      15% { opacity: 0.45; }
      55% { opacity: 0.45; }
      100% { transform: translateX(220%) skewX(-20deg); opacity: 0; }
    }

    #white-cart-root {
      position: fixed !important; left: 50% !important; transform: translateX(-50%) !important;
      /* IMPORTANT: inherit the bottom-nav component's shared variable.
         Do not create an inline --nb-cart-bottom on this element. */
      bottom: var(--nb-cart-bottom, calc(5px + env(safe-area-inset-bottom, 0px))) !important;
      width: min(720px, calc(100vw - 24px)); max-width: calc(100vw - 24px);
      z-index: 100000; display: none;
      transition: bottom .32s cubic-bezier(.22,1,.36,1);
    }
    #white-cart-root.wc-enter {
      animation: slideUpWhiteCart 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    #white-cart-root.wc-pink.wc-enter {
      animation: wcPinkEnter .36s cubic-bezier(.22,1,.36,1) forwards;
    }
    #white-cart-root.wc-pink.wc-cart-update #es-pink-inner {
      animation: wcPinkPulse .32s cubic-bezier(.22,1,.36,1);
    }
    #white-cart-root.wc-pink.wc-cart-update .wc-pink-left,
    #white-cart-root.wc-pink.wc-cart-update .wc-pink-cta {
      animation: wcPinkTextBump .28s cubic-bezier(.22,1,.36,1);
    }
    /* Alternate pulse class: swapping between wc-cart-update and this one
       restarts the animation without a forced layout read. */
    #white-cart-root.wc-pink.wc-cart-update-alt #es-pink-inner {
      animation: wcPinkPulse .32s cubic-bezier(.22,1,.36,1);
    }
    #white-cart-root.wc-pink.wc-cart-update-alt .wc-pink-left,
    #white-cart-root.wc-pink.wc-cart-update-alt .wc-pink-cta {
      animation: wcPinkTextBump .28s cubic-bezier(.22,1,.36,1);
    }
    #white-cart-root.wc-exiting {
      will-change: bottom, transform;
      animation: slideDownWhiteCart 0.26s ease forwards;
    }

    /* ─────────────  HOME (white) cart bar  ───────────── */
    #white-cart-container {
      background: rgba(255,255,255,0.88);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(17,24,39,0.06);
      border-radius: 32px; padding: 8px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 1px 1px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.08), 0 16px 32px -8px rgba(16,24,40,0.16);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif; height: 62px;
      box-sizing: border-box;
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      #white-cart-container { background: rgba(255,255,255,0.98); }
    }

    .wc-left {
      all: unset;
      display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; overflow: hidden;
      cursor: pointer; box-sizing: border-box;
    }
    .wc-thumb-wrap { position: relative; display: flex; align-items: center; flex-shrink: 0; }
    .wc-image-stack { display: flex; position: relative; height: 36px; min-width: 36px; align-items: center; transition: width 0.3s ease; }
    .wc-img { width: 36px; height: 36px; border-radius: 18px; object-fit: cover; background: #f3f4f6; flex-shrink: 0; position: absolute; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: all 0.3s ease; }
    .wc-img:nth-child(1) { left: 0px; z-index: 3; }
    .wc-img:nth-child(2) { left: 12px; z-index: 2; transform: scale(0.95); opacity: 0.95; }
    .wc-img:nth-child(3) { left: 24px; z-index: 1; transform: scale(0.9); opacity: 0.85; }
    .wc-qty-badge {
      position: absolute; top: -4px; right: -4px; min-width: 17px; height: 17px;
      padding: 0 3px; border-radius: 9px;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      color: #fff; font-size: 10px; font-weight: 800; line-height: 18px; text-align: center;
      border: 2px solid #FFFFFF; box-shadow: 0 2px 4px rgba(0,0,0,0.18); z-index: 4;
    }
    .wc-bump { animation: wcBump 0.32s ease; }

    .wc-info { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; justify-content: center; overflow: hidden; }
    .wc-res-name { font-size: 12px; font-weight: 800; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wc-menu-link { font-size: 10px; font-weight: 700; color: #FF4D4F; margin-top: 1px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .wc-right { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; flex-shrink: 0; }
    #wc-standard-actions { flex: 0 0 auto; }
    .wc-btn { min-width: 86px; }

    .wc-btn {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #FF5A5F 0%, #FF2E44 100%);
      border: none; border-radius: 22px; height: 44px; min-height: 40px; padding: 0 12px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #ffffff; cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s ease; font-family: inherit;
    }
    .wc-btn:active { transform: scale(0.96); }
    .wc-btn::after {
      content: ''; position: absolute; top: 0; left: 0; width: 45%; height: 100%;
      background: linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
      transform: translateX(-120%) skewX(-20deg); pointer-events: none;
    }
    #white-cart-root.wc-enter #wc-standard-actions .wc-btn::after {
      animation: wcShine 1s ease 0.45s 1 both;
    }
    .wc-btn-title { font-size: 11px; font-weight: 800; line-height: 1.1; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
    .wc-btn-title svg { width: 13px; height: 13px; }
    .wc-btn-sub { font-size: 9px; font-weight: 600; opacity: 0.95; white-space: nowrap; }
    .wc-close {
      width: 30px; height: 30px; border-radius: 50%; background: #F1F1F1; border: none;
      display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 15px;
      cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent;
    }
    .wc-close:active { background: #e5e7eb; }

    #white-cart-root button:focus-visible,
    #white-cart-root .wc-left:focus-visible {
      outline: 2px solid #FF4D4F; outline-offset: 2px;
    }

    /* ── "All ↑" capsule — HOME ONLY, centered ABOVE the cart bar ── */
    #wc-allup {
      all: unset;
      position: absolute; left: 50%; transform: translateX(-50%);
      bottom: calc(100% + 8px);
      display: none; align-items: center; gap: 5px;
      background: #ffffff; color: #111827;
      border: 1px solid rgba(17,24,39,0.08);
      border-radius: 16px; height: 32px; padding: 0 14px;
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      font-size: 12px; font-weight: 800; cursor: pointer;
      box-shadow: 0 6px 16px rgba(16,24,40,0.16);
      -webkit-tap-highlight-color: transparent; box-sizing: border-box; z-index: 2;
    }
    #wc-allup.show { display: inline-flex; }
    #wc-allup:active { transform: translateX(-50%) scale(0.96); }
    #wc-allup svg { width: 12px; height: 12px; }

    #white-cart-root.wc-pink {
  width: min(520px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-sizing: border-box;
}
    #es-pink-inner {
      all: unset; box-sizing: border-box; width: 100%; display: flex;
      flex-direction: column; overflow: hidden;
      background: #C93650; color: #fff;
      border: 1px solid rgba(255,255,255,.16); border-radius: 16px;
      box-shadow: 0 7px 22px rgba(193,58,80,.24);
      font-family: 'Manrope', system-ui, -apple-system, sans-serif;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: transform .12s ease, box-shadow .18s ease;
    }
    #es-pink-inner:active { transform: scale(.99); }
    #es-pink-inner { will-change: transform; }
    .wc-pink-message {
      display: flex; align-items: center; gap: 6px; min-height: 26px;
      padding: 4px 11px; background: rgba(125, 18, 42, .24);
      color: #fff; font-size: 12px; line-height: 1.2; font-weight: 750;
    }
    .wc-pink-message svg { width: 13px; height: 13px; flex: 0 0 auto; }
    .wc-pink-main {
      min-height: 42px; display: flex; align-items: center;
      justify-content: space-between; gap: 8px; padding: 6px 11px;
    }
    .wc-pink-left {
      min-width: 0; color: #fff; font-size: 13px; line-height: 1.2;
      font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-variant-numeric: tabular-nums;
    }
    .wc-pink-cta {
      display: inline-flex; align-items: center; justify-content: flex-end;
      gap: 6px; flex: 0 0 auto; color: #fff; font-size: 13px; font-weight: 850;
      white-space: nowrap;
    }
    .wc-pink-cta svg { width: 18px; height: 18px; }
    @media (min-width: 600px) {
      .wc-pink-message { min-height: 29px; padding: 5px 13px; font-size: 12px; }
      .wc-pink-main { min-height: 46px; padding: 7px 13px; }
      .wc-pink-left, .wc-pink-cta { font-size: 14px; }
      .wc-pink-cta svg { width: 19px; height: 19px; }
    }

    /* Multi-restaurant cart drawer — used by pink bar and home "All ↑" */
    #ew-cart-drawer-backdrop{position:fixed;inset:0;z-index:100001;display:none;background:rgba(15,23,42,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    #ew-cart-drawer-backdrop.show{display:block}
    #ew-cart-drawer{position:fixed;left:50%;bottom:0;transform:translate(-50%,110%);width:min(720px,100vw);max-height:min(78vh,760px);background:#f7f8fc;border-radius:30px 30px 0 0;z-index:100002;box-shadow:0 -10px 40px rgba(15,23,42,.2);overflow:hidden;transition:transform .28s cubic-bezier(.22,1,.36,1);font-family:'Manrope',system-ui,-apple-system,sans-serif}
    #ew-cart-drawer.show{transform:translate(-50%,0)}
    .ew-cd-head{padding:18px 22px 12px;display:flex;align-items:center;justify-content:space-between}.ew-cd-title{font-size:24px;font-weight:800;color:#101828}.ew-cd-close{border:0;background:transparent;color:#667085;font-size:30px;width:40px;height:40px;border-radius:50%}
    .ew-cd-list{padding:6px 18px 18px;overflow:auto;max-height:calc(min(78vh,760px) - 150px)}
    .ew-cd-row{background:#fff;border-radius:34px;min-height:104px;margin:0 0 14px;padding:12px 14px;display:flex;align-items:center;gap:14px;box-shadow:0 5px 18px rgba(16,24,40,.07)}
    .ew-cd-logo{width:76px;height:76px;border-radius:50%;object-fit:cover;background:#f1f3f5;flex:0 0 auto;border:2px solid #fff}.ew-cd-info{min-width:0;flex:1}.ew-cd-name{font-size:20px;line-height:1.15;font-weight:800;color:#101828;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ew-cd-menu{margin-top:5px;font-size:17px;line-height:1.1;color:#111827;font-weight:650}.ew-cd-arrow{color:#ec5b6c;margin-left:4px;font-weight:900}
    .ew-cd-view{min-width:145px;height:64px;border:0;border-radius:32px;background:#ef5263;color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05;font-weight:800;box-shadow:0 5px 12px rgba(239,82,99,.18)}.ew-cd-view strong{font-size:20px}.ew-cd-view span{margin-top:5px;font-size:14px;font-weight:650;opacity:.92}
    .ew-cd-footer{padding:8px 22px calc(20px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;background:#f7f8fc}.ew-cd-checkout{min-width:210px;height:56px;padding:0 28px;border-radius:30px;border:1px solid #e5e7eb;background:#fff;color:#d65364;font:inherit;font-size:18px;font-weight:800;box-shadow:0 2px 7px rgba(16,24,40,.08)}.ew-cd-empty{padding:36px 20px 48px;text-align:center;color:#667085;font-weight:700}
    @media(max-width:520px){#ew-cart-drawer{border-radius:26px 26px 0 0}.ew-cd-head{padding:16px 18px 10px}.ew-cd-title{font-size:23px}.ew-cd-list{padding:6px 14px 12px}.ew-cd-row{min-height:94px;padding:10px;gap:10px;border-radius:30px}.ew-cd-logo{width:66px;height:66px}.ew-cd-name{font-size:17px}.ew-cd-menu{font-size:14px}.ew-cd-view{min-width:112px;height:58px;border-radius:29px}.ew-cd-view strong{font-size:17px}.ew-cd-view span{font-size:12px}}

    @media (hover: hover) {
      .wc-btn:hover { filter: brightness(1.04); }
      .wc-close:hover { background: #e9e9e9; }
      #es-pink-inner:hover { filter: brightness(1.03); }
    }

    /* Narrow phones (≈360px and below) */
    @media (max-width: 360px) {
      #white-cart-root { width: calc(100vw - 20px); max-width: calc(100vw - 20px); }
      #white-cart-root.wc-pink { width: calc(100vw - 28px); max-width: calc(100vw - 28px); }
      #white-cart-container { padding: 7px; height: 58px; }
      #es-pink-inner { height: auto; padding: 0; border-radius: 15px; }
      .wc-pink-message { min-height: 24px; padding: 4px 9px; font-size: 10px; }
      .wc-pink-main { min-height: 38px; padding: 6px 9px; gap: 6px; }
      .wc-pink-left, .wc-pink-cta { font-size: 12px; }
      .wc-pink-cta svg { width: 17px; height: 17px; }
      .wc-pink-left, .wc-pink-cta { font-size: 13px; }
      .wc-img { width: 34px; height: 34px; }
      .wc-image-stack { height: 34px; min-width: 34px; }
      .wc-btn { padding: 0 10px; height: 42px; }
      .wc-res-name { font-size: 11px; }
      .wc-menu-link { font-size: 9px; }
      .wc-close { width: 28px; height: 28px; }
    }

    @media (prefers-reduced-motion: reduce) {
      #white-cart-root, #white-cart-root * {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;
