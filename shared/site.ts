/**
 * The raritone.com API contract — shared by the website client and the server
 * routes under /api/site. Kept separate from the PWA's shared/types.js because
 * the site has its own surface: accounts, check-ins, plans, and partner
 * applications.
 */

export type PlanTier = "starter" | "plus" | "vip";

export interface PlanConfig {
  /** Display label, e.g. "Starter". */
  label: string;
  /** Monthly price in whole rupees. */
  monthly: number;
  /** Annual price in whole rupees. */
  annual: number;
  /** Whether the plan is open for interest while payments are not live. */
  enabled: boolean;
  tagline: string;
  updatedAt: string;
}

export type MembershipCycle = "monthly" | "annual";

export type SiteRole = "user" | "admin";

export interface SiteUserPublic {
  id: string;
  name: string;
  email: string;
  role: SiteRole;
  emailVerified: boolean;
  /** "deletion_requested" is a pending support queue item, not a deleted account. */
  status: "active" | "deletion_requested";
  createdAt: string;
  prefs: {
    streakReminders: boolean;
    marketing: boolean;
  };
}

export interface StreakState {
  /** Consecutive qualifying days, IST calendar days, ending today or yesterday. */
  currentStreak: number;
  longestStreak: number;
  /** Total qualifying days ever recorded for this account. */
  totalDays: number;
  daysRemaining: number;
  /** "not_started" until the first qualifying day; a missed day breaks the run. */
  status: "not_started" | "in_progress" | "completed" | "broken";
  /** The IST day key the server computed this state against. */
  today: string;
  /** Whether today (IST) already has a qualifying check-in. */
  checkedInToday: boolean;
  /** The qualifying day keys for calendar rendering (most recent 90). */
  days: string[];
  milestones: Array<{ day: number; label: string; achieved: boolean }>;
}

export interface PartnerApplication {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  category: string;
  city: string;
  catalogueSize: string;
  partnershipTypes: string[];
  proposedOffer: string;
  notes: string;
  consent: boolean;
  status: "new" | "reviewing" | "info_requested" | "approved" | "rejected";
  agreementSigned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  handled: boolean;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  plan: PlanTier;
  cycle: MembershipCycle;
  createdAt: string;
}

export interface AdminOverview {
  totals: {
    users: number;
    newUsers7d: number;
    checkinsToday: number;
    checkinsTotal: number;
    activeStreaks: number;
    completedChallenges: number;
    subscribers: number;
    partnerApplications: number;
    newPartnerApplications: number;
    contactMessages: number;
    unhandledContactMessages: number;
    waitlist: number;
  };
  byTier: Record<PlanTier, number>;
  plans: Record<PlanTier, PlanConfig>;
  /** Revenue figures stay at zero until a payment gateway is connected. */
  payments: {
    gatewayConnected: boolean;
    mrrRupees: number;
    annualSalesRupees: number;
    cancellations: number;
  };
}

export interface ApiErrorBody {
  error: {
    category: string;
    message: string;
    nextAction?: string;
    retryIsFree?: boolean;
    traceId?: string;
  };
}

/** The default plan configuration the server seeds on first boot. */
export function defaultPlans(): Record<PlanTier, PlanConfig> {
  const now = new Date().toISOString();
  return {
    starter: {
      label: "Starter",
      monthly: 99,
      annual: 999,
      enabled: true,
      tagline: "Build the daily habit.",
      updatedAt: now,
    },
    plus: {
      label: "Plus",
      monthly: 199,
      annual: 1999,
      enabled: true,
      tagline: "The full Style Streak experience.",
      updatedAt: now,
    },
    vip: {
      label: "VIP",
      monthly: 399,
      annual: 3999,
      enabled: true,
      tagline: "Premium campaigns and priority support.",
      updatedAt: now,
    },
  };
}

export const PLAN_TIERS: PlanTier[] = ["starter", "plus", "vip"];
export const PARTNERSHIP_TYPES = [
  "Coupon or discount campaign",
  "Product placement",
  "Virtual try-on integration",
  "Sponsored challenge",
  "In-store try-on screen",
  "Other",
] as const;
