"use client";

/* ================================================================
   EATSWADA — CATEGORY PAGE RUNTIME
   ----------------------------------------------------------------
   Legacy `category.html` loaded, in order: config.js, safe-html.js, api.js,
   restaurant-card.js, the inline category IIFE, navigation.js, cart-bar.js.

   The shared shell (config, safe-html, navigation) comes from
   <ShellRuntime/>; <CartBar/> is mounted before this component so its effect
   runs first. Here we install restaurant-card.js (for its delegated
   favourites/gallery handlers and the read helpers) and then the category
   logic, in that legacy order. Renders nothing.
   ================================================================ */
import { useEffect } from "react";
import { installRestaurantCard } from "../lib/restaurant-card";
import { installCategoryPage } from "../lib/category-page";

export default function CategoryRuntime() {
  useEffect(() => {
    installRestaurantCard();
    installCategoryPage();
  }, []);

  return null;
}
