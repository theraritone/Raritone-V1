/** Server-owned commercial plan contract. Prices are monthly INR amounts. */
export const SUBSCRIPTION_PLANS = [
  {
    id: "free",
    name: "Free",
    priceInr: 0,
    productId: null,
    summary: "A simple way to start trying on.",
    benefits: ["Limited photo try-ons", "Basic wardrobe", "Basic discovery"],
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: 299,
    productId: "com.raritone.pro.monthly",
    summary: "More room to explore your style.",
    benefits: ["Higher try-on limits", "Expanded wardrobe", "Style Streak eligibility"],
  },
  {
    id: "vip",
    name: "VIP",
    priceInr: 999,
    productId: "com.raritone.vip.monthly",
    summary: "The complete Raritone experience.",
    benefits: ["Highest usage limits", "Priority processing where available", "Exclusive benefits"],
  },
] as const;

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLANS)[number]["id"];
export type PaidSubscriptionPlanId = Exclude<SubscriptionPlanId, "free">;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export interface Entitlement {
  planId: SubscriptionPlanId;
  active: boolean;
  renewsAt: string | null;
  source: "none" | "apple" | "google" | "server";
}
