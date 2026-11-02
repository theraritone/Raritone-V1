import type { Entitlement, SubscriptionPlan } from "../../shared/billing";
import { api } from "./api";

export interface BillingSnapshot {
  entitlement: Entitlement;
  verificationConfigured: boolean;
}

export const billingApi = {
  plans: () => api.get<{ plans: SubscriptionPlan[] }>("/billing/plans"),
  entitlement: () => api.get<BillingSnapshot>("/billing/entitlement"),
};
