import type { ReactNode } from "react";
import { LegalPage } from "../components/LegalPage";

export function SubscriptionRefundPage(): ReactNode {
  return (
    <LegalPage
      path="/subscription-and-refund-policy"
      title="Subscription and Refund Policy"
      metaTitle="Subscription & Refund Policy | Raritone"
      description="Raritone membership billing, renewal, cancellation, and refund rules — what you pay, when it renews, and how refunds work."
      updated="October 2026"
      intro="This policy describes how Raritone memberships are billed, renewed, cancelled, and refunded. It is shown before checkout, alongside the plan's price and benefits."
      sections={[
        {
          heading: "Plans and pricing",
          bullets: [
            "Starter: ₹99 per month or ₹999 per year (proposed launch price).",
            "Plus: ₹199 per month or ₹1,999 per year (proposed launch price).",
            "VIP: ₹399 per month or ₹3,999 per year (proposed launch price).",
            "All prices are in Indian rupees. Applicable taxes are calculated and shown before you pay.",
            "Prices, benefits, discount caps, and eligibility are configurable and may change; changes never apply mid-billing-period.",
          ],
        },
        {
          heading: "What a subscription includes",
          paragraphs: [
            "A subscription covers exactly the benefits listed for the plan on the Membership page. A subscription does not automatically include a guaranteed free product. Rewards are governed by the active campaign's rules and are always subject to availability, maximum benefit, purchase conditions, and expiry.",
          ],
        },
        {
          heading: "Billing and renewal",
          bullets: [
            "Monthly plans renew every month on the date you first subscribed; annual plans renew every year.",
            "The renewal amount is the plan price shown at checkout, plus applicable taxes.",
            "You can view your renewal date, plan, and payment history in your dashboard at any time.",
          ],
        },
        {
          heading: "Cancellation",
          bullets: [
            "You can cancel any time from your dashboard or by contacting support.",
            "Cancelling stops future renewals; your benefits continue until the end of the period you have already paid for.",
            "Deleting your account does not automatically cancel an active subscription — cancel first, then delete.",
          ],
        },
        {
          heading: "Refunds",
          bullets: [
            "Monthly plans: if you cancel within 48 hours of a renewal and have not claimed any reward in that period, contact support for a refund of that renewal.",
            "Annual plans: a 7-day change-of-mind window applies from payment, provided no reward has been claimed in that period.",
            "If a streak is broken by a verified outage on our side and it materially affects a paid benefit you were counting on, contact support — we will make it right case by case.",
            "Approved refunds are processed back to the original payment method through our payment provider. Timing depends on your bank.",
            "Rewards already claimed or redeemed are not refundable.",
          ],
        },
        {
          heading: "Failed payments",
          paragraphs: [
            "If a payment fails, your membership remains unpaid and no benefits relying on the failed payment are activated. We notify you of the failure and you can retry from your dashboard. Payment status is always confirmed server-side through our payment provider.",
          ],
        },
        {
          heading: "Authorisation",
          paragraphs: [
            "We never charge you without your explicit authorization at checkout. Payments are processed by a regulated Indian payment provider, and renewal is disclosed before the first charge.",
          ],
        },
      ]}
    />
  );
}
