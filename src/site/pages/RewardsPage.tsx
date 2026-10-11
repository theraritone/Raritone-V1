import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { ArrowRight, GiftIcon, ShieldIcon, Spark } from "../components/icons";

const REWARD_TYPES = [
  { title: "Percentage discounts", body: "A share off an eligible purchase, always capped at the campaign's stated maximum." },
  { title: "Fixed-value discounts", body: "A set rupee amount off, with the minimum purchase value shown up front." },
  { title: "Partner-funded vouchers", body: "Vouchers funded by a partner brand, redeemable on their terms." },
  { title: "Free eligible products", body: "A selected product fully covered, subject to the campaign's published limits." },
  { title: "Limited-time campaigns", body: "Time-boxed rewards that expire — the expiry is always shown before you claim." },
  { title: "Single-use coupon codes", body: "Unique codes issued to one person, for one redemption, verified at checkout." },
];

const WORKFLOW = [
  "You complete the required Style Streak.",
  "Raritone's backend verifies your eligibility.",
  "The system checks the reward's active status and remaining inventory.",
  "A unique coupon is reserved or issued to you.",
  "You see redemption instructions, expiry, and any conditions.",
  "The brand validates the coupon at checkout or in-store.",
  "Redemption status is updated securely, and you can review it in your dashboard.",
];

/**
 * Fashion Rewards. The sample offer is clearly labelled as illustrative and
 * inactive — a reward only becomes claimable after a brand's written approval
 * is recorded and the campaign is activated.
 */
export function RewardsPage(): ReactNode {
  usePageMeta({
    title: "Fashion Rewards | Raritone",
    description:
      "How Raritone rewards work: streak-based eligibility, verified server-side, with clear caps, expiry, and redemption rules — no inactive offer is ever presented as live.",
    path: "/rewards",
  });

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">Fashion rewards</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-coal sm:text-5xl">
            Earned in streaks. <span className="italic text-gold-deep">Backed by brands.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Rewards come from partner campaigns with real budgets and real limits. Every reward states who funds it,
            what it covers, and exactly when it expires — before you claim it.
          </p>
        </Reveal>
      </section>

      {/* Reward types */}
      <section className="border-t border-coal/8 bg-white">
        <div className="st-container py-16 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">The kinds of rewards</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {REWARD_TYPES.map((type, index) => (
              <Reveal key={type.title} delay={index * 70}>
                <article className="st-card h-full p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-soft text-gold-deep">
                    <GiftIcon width={18} height={18} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-coal">{type.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-coal-500">{type.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mx-auto mt-10 max-w-3xl text-center">
            <p className="text-xs leading-relaxed text-coal-400">
              Every reward also records its membership eligibility, required streak, partner or sponsor, maximum
              discount, eligible products or categories, start and expiry dates, total and per-user redemption limits,
              online or in-store redemption method, funding responsibility, campaign status, and full terms.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Illustrative offer */}
      <section className="border-t border-coal/8">
        <div className="st-container py-16 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <article className="relative overflow-hidden rounded-3xl border-2 border-dashed border-gold/70 bg-gold-soft/40 p-8 sm:p-10">
                <span className="st-chip absolute right-6 top-6 border-gold/50 bg-white text-gold-deep">
                  Illustrative Partner Offer — Not Yet Active
                </span>
                <p className="font-display text-2xl font-medium text-coal sm:text-3xl">
                  10% off your next eligible fashion purchase.
                </p>
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-coal-400">Example code</p>
                <p className="mt-1 inline-block rounded-lg border border-dashed border-coal/30 bg-white px-4 py-2 font-mono text-lg tracking-[0.2em] text-coal">
                  RARITONE10
                </p>
                <ul className="st-prose mt-6 text-sm">
                  <li>Available only if a participating brand approves the campaign.</li>
                  <li>Valid for eligible products only.</li>
                  <li>Subject to the partner's minimum order value, expiry, and redemption rules.</li>
                </ul>
                <p className="mt-6 flex items-start gap-2.5 rounded-2xl bg-white p-4 text-xs leading-relaxed text-coal-500">
                  <ShieldIcon width={16} height={16} className="mt-0.5 shrink-0 text-gold-deep" />
                  This sample exists to show how an offer will be presented. It is not a working offer, cannot be
                  redeemed, and no reward is reserved by viewing this page. A reward is issued only through the verified
                  workflow below.
                </p>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Redemption workflow */}
      <section className="border-t border-coal/8 bg-coal text-white">
        <div className="st-container py-16 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Redemption workflow</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              From streak to coupon, step by step.
            </h2>
          </Reveal>
          <ol className="mx-auto mt-12 max-w-3xl space-y-4">
            {WORKFLOW.map((step, index) => (
              <Reveal key={step} delay={index * 60}>
                <li className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-coal">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-[15px] leading-relaxed text-white/80">{step}</p>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mx-auto mt-10 max-w-3xl text-center">
            <p className="text-xs leading-relaxed text-white/50">
              Duplicate claims, coupon reuse, race conditions, and fraudulent check-ins are prevented transactionally
              on the server. During the pilot, some redemptions may be confirmed manually by the brand — when that
              applies, it is stated clearly on the reward.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-coal/8">
        <div className="st-container py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-medium tracking-tight text-coal">
            Rewards start with a streak.
          </h2>
          <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-sm text-coal-500">
            <Spark width={15} height={15} className="text-gold-deep" /> No active campaigns yet — yours begins with day one.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/style-streak" className="st-btn-primary px-6 py-3 text-[15px]">
              Explore the Style Streak <ArrowRight width={16} height={16} />
            </Link>
            <Link to="/brands" className="st-btn-outline px-6 py-3 text-[15px]">
              Fund a campaign as a brand
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
