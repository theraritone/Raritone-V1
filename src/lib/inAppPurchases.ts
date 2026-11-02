import type { PaidSubscriptionPlanId } from "../../shared/billing";

export type PurchaseAvailability = "native-ready" | "web-unavailable";

export interface PurchaseResult {
  productId: string;
  transactionId: string;
  receipt: string;
  platform: "apple" | "google";
}

/** Native store boundary. The backend validates receipts before entitlements change. */
export interface InAppPurchaseAdapter {
  availability: PurchaseAvailability;
  purchase(plan: PaidSubscriptionPlanId): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult[]>;
}

export function createInAppPurchaseAdapter(): InAppPurchaseAdapter {
  return {
    availability: "web-unavailable",
    async purchase(): Promise<PurchaseResult> {
      throw new Error("In-app purchases are available in the mobile store build only.");
    },
    async restore(): Promise<PurchaseResult[]> {
      throw new Error("Restore purchases is available in the mobile store build only.");
    },
  };
}
