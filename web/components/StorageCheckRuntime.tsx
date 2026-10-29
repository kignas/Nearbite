"use client";

/* storage-check.html loads no shared scripts; only its own inline block. */
import { useEffect } from "react";
import { installStorageCheckPage } from "../lib/storage-check-page";

export default function StorageCheckRuntime() {
  useEffect(() => {
    installStorageCheckPage();
  }, []);

  return null;
}
