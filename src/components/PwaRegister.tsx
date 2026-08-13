"use client";

import { useEffect } from "react";

/** Registers the service worker that makes the app installable. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing (old browser, private mode) never breaks the app.
      });
    }
  }, []);
  return null;
}
