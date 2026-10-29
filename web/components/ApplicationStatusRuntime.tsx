"use client";

/* application-status.html loads no shared scripts; only its own inline block. */
import { useEffect } from "react";
import { installApplicationStatusPage } from "../lib/application-status-page";

export default function ApplicationStatusRuntime() {
  useEffect(() => {
    installApplicationStatusPage();
  }, []);

  return null;
}
