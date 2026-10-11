import { useEffect, useState, type ReactNode } from "react";
import { defaultPlans, PLAN_TIERS, type MembershipCycle, type PlanTier } from "../../../shared/site.js";
import { fetchPlans } from "../api";
import { Link } from "../router";
import { Check } from "./icons";

const rupees = (value: number): string => `₹${value.toLocaleString("en-IN")}`;

/** Per-plan copy. Benefit wording is deliberately "eligible", never guaranteed. */
const PLAN_FEATURES: Record<PlanTier, string[]> = {
  starter: [
    "Daily Style Streak access",
    "Personal outfit calendar",
    "Save qualifying looks",
    "Access to Starter-level eligible offers",
    "Illustrative reward benefit: up to 50% off an eligible partner offer, subject to its cap and terms",
  ],
  plus: [
    "Everything in Starter",
    "Enhanced style tracking",
    "Plus-level eligible fashion offers",
    "Priority access to selected challenges, if available",
    "Illustrative reward benefit: up to 100% off an eligible partner product, subject to a maximum reward value and availability",
  ],
  vip: [
    "Everything in Plus",
    "VIP-level eligible fashion rewards",
    "Access to selected premium campaigns when available",
    "Priority support, if operationally available",
    "Illustrative reward benefit: higher-value partner rewards, subject to published limits",
  ],
};

/**
 * The plan table. Prices come from the server's plan configuration (editable in
 * the admin dashboard) and fall back to the proposed launch prices; annual
 * savings are always computed from the live numbers, never hardcoded.
 */
export function PricingTable({
  onChoose,
  headline = "Find Your Style. Choose Your Plan.",
  subline = "Every plan unlocks the Style Streak challenge. Rewards are always subject to the active campaign's terms — nothing here is a guaranteed free product.",
}: {
  onChoose: (plan: PlanTier, cycle: MembershipCycle) => void;
  headline?: string;
  subline?: string;
}): ReactNode {
  const [cycle, setCycle] = useState<MembershipCycle>("monthly");
  const [plans, setPlans] = useState(defaultPlans());

  useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((result) => {
        if (!cancelled) setPlans(result.plans);
      })
      .catch(() => {
        // Offline or server unreachable: the proposed launch prices remain on
        // screen, and the page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savings = (tier: PlanTier): number => plans[tier].monthly * 12 - plans[tier].annual;

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">{headline}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-coal-500">{subline}</p>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full border border-coal/10 bg-white p-1" role="group" aria-label="Billing cycle">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={cycle === option}
              onClick={() => setCycle(option)}
              className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                cycle === option ? "bg-coal text-white" : "text-coal-500 hover:text-coal"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const plan = plans[tier];
          const price = cycle === "monthly" ? plan.monthly : plan.annual;
          const popular = tier === "plus";
          return (
            <div
              key={tier}
              className={`relative flex flex-col rounded-3xl p-7 ${
                popular
                  ? "border-2 border-coal bg-white shadow-[0_24px_64px_-32px_rgb(24_22_17/0.35)]"
                  : "st-card"
              }`}
            >
              {popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3.5 py-1 text-xs font-bold text-coal">
                  MOST POPULAR
                </span>
              )}
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-coal">{plan.label}</h3>
              <p className="mt-1 text-sm text-coal-400">{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-coal">{rupees(price)}</span>
                <span className="text-sm text-coal-400">{cycle === "monthly" ? "per month" : "per year"}</span>
              </div>
              <p className="mt-1.5 h-5 text-xs font-medium text-gold-deep">
                {cycle === "annual" && savings(tier) > 0 ? `Save ${rupees(savings(tier))} a year vs monthly` : ""}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {PLAN_FEATURES[tier].map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm leading-snug text-coal-700">
                    <Check width={16} height={16} className="mt-0.5 shrink-0 text-gold-deep" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={popular ? "st-btn-primary mt-7 w-full" : "st-btn-outline mt-7 w-full"}
                onClick={() => onChoose(tier, cycle)}
                disabled={!plan.enabled}
              >
                {tier === "starter" ? "Choose Starter" : tier === "plus" ? "Choose Plus" : "Explore VIP"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-coal-400">
        These are proposed launch prices, shown in Indian rupees. Prices, benefits, discount caps, eligibility, and
        availability are configurable and may change before launch. Online checkout opens once our payment provider is
        connected — see the{" "}
        <Link to="/subscription-and-refund-policy" className="font-medium text-coal underline underline-offset-2">
          subscription &amp; refund policy
        </Link>
        .
      </p>
    </div>
  );
}
