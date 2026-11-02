import type { PaidSubscriptionPlanId } from "../../shared/billing";
import { api } from "../state/api";

export type PurchaseAvailability = "native-ready" | "web-unavailable";

export interface PurchaseResult {
  productId: string;
  transactionId: string;
  receipt: string;
  platform: "apple" | "google";
}

export interface InAppPurchaseAdapter {
  availability: PurchaseAvailability;
  purchase(plan: PaidSubscriptionPlanId): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult[]>;
}

/** The native plugin will replace these methods without changing screen code. */
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

export async function submitVerifiedReceipt(input: PurchaseResult & { planId: PaidSubscriptionPlanId }): Promise<void> {
  await api.post("/billing/receipts", input);
}
