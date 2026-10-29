"use client";

/* ================================================================
   EATSWADA — 99 STORE PAGE RUNTIME
   ----------------------------------------------------------------
   Legacy `under99.html` loaded, in order: cart-bar.js, search-overlay.js,
   under99-icons.js, under99-core.js, under99-header.js, under99-filters.js,
   under99-price-tabs.js, under99-products.js, under99-customize.js, under99.js.

   <ShellRuntime/> (in layout) owns the theme/header-theme globals; <CartBar/>
   is mounted before this component so its effect (and the cart data layer)
   installs first. Here we install the rest in the legacy order. Renders nothing.
   ================================================================ */
import { useEffect } from "react";
import { installUnder99Icons } from "../lib/under99-icons";
import { installUnder99Core } from "../lib/under99-core";
import { installUnder99Header } from "../lib/under99-header";
import { installUnder99Filters } from "../lib/under99-filters";
import { installUnder99PriceTabs } from "../lib/under99-price-tabs";
import { installUnder99Products } from "../lib/under99-products";
import { installUnder99Customize } from "../lib/under99-customize";
import { installUnder99Boot, installToast } from "../lib/under99";

export default function Under99Runtime() {
  useEffect(() => {
    installToast();
    installUnder99Icons();
    installUnder99Core();
    installUnder99Header();
    installUnder99Filters();
    installUnder99PriceTabs();
    installUnder99Products();
    installUnder99Customize();
    installUnder99Boot();
  }, []);

  return null;
}
