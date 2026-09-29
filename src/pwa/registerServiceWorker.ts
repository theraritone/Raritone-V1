import { Capacitor } from "@capacitor/core";

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  // The native shell serves local files (no service-worker support on the iOS
  // scheme, nothing to gain on Android), so the worker is a web-only concern.
  if (Capacitor.isNativePlatform()) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
