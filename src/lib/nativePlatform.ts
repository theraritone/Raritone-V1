export type NativePlatform = "web" | "ios" | "android";

export interface NativeCapabilities {
  platform: NativePlatform;
  camera: boolean;
  inAppPurchases: boolean;
  storeReceiptSubmission: boolean;
}

/** Explicit capability contract until native billing plugins are installed. */
export function nativeCapabilities(): NativeCapabilities {
  const protocol = typeof window === "undefined" ? "" : window.location.protocol;
  const platform: NativePlatform = protocol === "capacitor:" ? "ios" : "web";
  return {
    platform,
    camera: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    inAppPurchases: false,
    storeReceiptSubmission: platform !== "web",
  };
}
