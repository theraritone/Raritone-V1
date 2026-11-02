import { Router } from "express";
import { SUBSCRIPTION_PLANS, type PaidSubscriptionPlanId, type Entitlement } from "../../shared/billing.js";
import { config } from "../env.js";
import { repo } from "../lib/db.js";
import { readEntitlement } from "../lib/entitlements.js";
import { badRequest, HttpError } from "../lib/http.js";
import { today } from "../lib/auth.js";

export const billingApi = Router();

billingApi.get("/billing/plans", (_req, res) => {
  res.json({ plans: SUBSCRIPTION_PLANS });
});

billingApi.get("/billing/entitlement", async (req, res) => {
  const userId = req.userId;
  if (!userId) throw new HttpError(401, "permission_denied", "No Raritone session.", "Reopen the app.", true);
  const entitlement: Entitlement = await readEntitlement(userId);
  res.json({ entitlement, verificationConfigured: hasStoreVerificationConfig() });
});

billingApi.post("/billing/receipts", async (req, res) => {
  const body = req.body as Partial<{ planId: PaidSubscriptionPlanId; platform: "apple" | "google"; productId: string; transactionId: string; receipt: string }>;
  if (!body.planId || !["pro", "vip"].includes(body.planId)) throw badRequest("Choose a paid Raritone plan.", "Select Pro or VIP and try again.");
  if (!body.platform || !body.productId || !body.transactionId || !body.receipt) throw badRequest("The store purchase receipt is incomplete.", "Finish the purchase in the App Store or Google Play.");
  if (!hasStoreVerificationConfig()) throw new HttpError(503, "provider_unavailable", "Store verification is not configured yet.", "Nothing was charged. Try again after the mobile store configuration is complete.", true);
  throw new HttpError(501, "provider_unavailable", "Store verification is not enabled for this build.", "Nothing was charged. Please try again later.", true);
});

billingApi.get("/style-streak", async (req, res) => {
  const userId = req.userId;
  if (!userId) throw new HttpError(401, "permission_denied", "No Raritone session.", "Reopen the app.", true);
  const days = await repo.readActivity(userId);
  const currentDay = today();
  const completedToday = days.includes(currentDay);
  res.json({ currentStreak: completedToday ? calculateTrailingDays(days) : 0, completedToday, cycleDays: 30, eligibleForReward: false, rewardStatus: "server_verification_pending", message: "Only qualifying, server-verified try-ons count toward rewards." });
});

function hasStoreVerificationConfig(): boolean {
  return Boolean(config.env === "production" && process.env.APPLE_APP_STORE_ISSUER_ID && process.env.APPLE_APP_STORE_KEY_ID && process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
}

function calculateTrailingDays(days: string[]): number {
  const set = new Set(days);
  let count = 0;
  const cursor = new Date();
  while (set.has(cursor.toISOString().slice(0, 10))) { count += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return count;
}
