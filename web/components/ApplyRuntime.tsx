"use client";

/* apply.html loads `./config.js` then its own inline script. config.js is
   imported by lib/config.ts; the wizard lives in lib/apply-page.ts. */
import { useEffect } from "react";
import { installApplyPage } from "../lib/apply-page";

export default function ApplyRuntime() {
  useEffect(() => {
    installApplyPage();
  }, []);

  return null;
}
