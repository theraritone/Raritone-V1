import { SUBSCRIPTION_PLANS, type PaidSubscriptionPlanId } from "../../shared/billing.js";
import { badRequest } from "./http.js";

export function assertStoreProduct(planId: PaidSubscriptionPlanId, productId: string): void {
  const plan = SUBSCRIPTION_PLANS.find((candidate) => candidate.id === planId);
  if (!plan || plan.productId !== productId) {
    throw badRequest("That store product does not match the selected Raritone plan.", "Refresh the plans and try again.");
  }
}

export function productForPlan(planId: PaidSubscriptionPlanId): string {
  const plan = SUBSCRIPTION_PLANS.find((candidate) => candidate.id === planId);
  if (!plan?.productId) throw new Error(`Missing store product for ${planId}`);
  return plan.productId;
}
