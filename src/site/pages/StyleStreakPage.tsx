import { useEffect, useState, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { ChallengeGrid } from "../components/StreakCalendar";
import { ArrowRight, Check, Flame, ShieldIcon } from "../components/icons";
import { fetchStreak } from "../api";
import { defaultStreak, milestonesFor } from "../demo";
import type { StreakState } from "../../../shared/site.js";

/**
 * The Style Streak page: the 30-day challenge explained, with an interactive
 * calendar. Public visitors see the labelled example state (12 days); a
 * signed-in visitor with real activity sees their own numbers instead.
 */
export function StyleStreakPage(): ReactNode {
  usePageMeta({
    title: "Style Streak — 30 Days. 30 Looks. | Raritone",
    description:
      "Build a daily fashion habit with the Raritone Style Streak: save a qualifying look every day, keep your streak alive, and qualify for eligible fashion rewards.",
    path: "/style-streak",
  });

  const [streak, setStreak] = useState<StreakState>(defaultStreak());
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchStreak()
      .then((result) => {
        if (cancelled) return;
        // Signed in? Always show the real state — including an honest zero —
        // and keep the labelled example only for signed-out visitors.
        if (result.streak) {
          setStreak(result.streak);
          setIsDemo(false);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = streak.status === "completed" ? 30 : streak.currentStreak;
  const progress = Math.min(100, Math.round((completed / 30) * 100));

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-gold-chip">
            <Flame width={13} height={13} /> The 30-day Style Streak
          </p>
          <h1 className="mt-5 font-display text-4xl font-medium leading-tight tracking-tight text-coal sm:text-5xl">
            30 Days. 30 Looks. <span className="italic text-gold-deep">Your Style Story.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Create a daily habit of trying outfits virtually, save your looks, and complete your Style Streak to qualify
            for eligible fashion rewards.
          </p>
        </Reveal>
      </section>

      {/* Interactive calendar */}
      <section className="border-y border-coal/8 bg-white">
        <div className="st-container py-16 sm:py-20">
          <Reveal>
            <div className="st-card mx-auto max-w-4xl p-6 sm:p-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-coal">
                    {isDemo ? "Example challenge — demo values" : "Your challenge"}
                  </h2>
                  <p className="text-sm text-coal-400">
                    {isDemo
                      ? "These numbers are a design preview. Sign in and your real activity appears here."
                      : "Computed from your verified check-ins, in Indian Standard Time."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-sm font-bold text-coal">
                  <Flame width={15} height={15} /> {streak.currentStreak} day streak
                </span>
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Current streak", value: `${streak.currentStreak} days` },
                  { label: "Qualifying days saved", value: `${streak.totalDays}` },
                  { label: "Days remaining", value: `${streak.daysRemaining}` },
                  {
                    label: "Challenge status",
                    value:
                      streak.status === "completed"
                        ? "Completed"
                        : streak.status === "broken"
                          ? "Broken — restart today"
                          : streak.status === "not_started"
                            ? "Not started"
                            : "In progress",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-coal/8 bg-paper px-4 py-4">
                    <dt className="text-xs font-medium text-coal-400">{stat.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tracking-tight text-coal">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8">
                <ChallengeGrid completed={completed} status={streak.status} />
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between text-xs text-coal-500">
                  <span>Milestone progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-coal/8">
                  <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="mt-10">
                <p className="text-sm font-semibold text-coal">Milestones</p>
                <ol className="mt-3 grid gap-3 sm:grid-cols-4">
                  {milestonesFor(streak.currentStreak).map((milestone) => (
                    <li
                      key={milestone.day}
                      className={`rounded-2xl border p-4 ${
                        milestone.achieved ? "border-gold/60 bg-gold-soft/60" : "border-coal/10 bg-white"
                      }`}
                    >
                      <p className={`text-xs font-bold ${milestone.achieved ? "text-gold-deep" : "text-coal-400"}`}>
                        DAY {milestone.day}
                      </p>
                      <p className="mt-1 text-sm font-medium text-coal">{milestone.label}</p>
                      {milestone.achieved && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-deep">
                          <Check width={12} height={12} /> Achieved
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-coal-400">
                  Milestones are illustrative progress markers. A milestone does not promise a separate reward unless a
                  funded reward has been configured for it.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Qualification rules */}
      <section>
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">How a day qualifies</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
              A day counts only when all three things happen. The rules are shown here before you start, and the same
              checks run again on our servers before any reward is issued.
            </p>
            <ol className="mt-6 space-y-4">
              {[
                "Complete a qualifying try-on using a supported try-on feature.",
                "Save the resulting outfit to your Style Calendar.",
                "Pass the server-side eligibility checks.",
              ].map((rule, index) => (
                <li key={rule} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coal text-sm font-bold text-gold">
                    {index + 1}
                  </span>
                  <p className="pt-1.5 text-[15px] text-coal-700">{rule}</p>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={100}>
            <div className="st-card h-full space-y-5 p-7">
              {[
                {
                  title: "One check-in per day",
                  body: "Only one qualifying check-in counts per calendar day, measured in Indian Standard Time (UTC+5:30). You cannot bank extra days by checking in twice.",
                },
                {
                  title: "If you miss a day",
                  body: "A missed day resets your consecutive streak to zero. Your historical completed days stay visible on your calendar — the story is not erased, but the run restarts.",
                },
                {
                  title: "Verified outages",
                  body: "If a verified technical failure on our side stops you from checking in, an exception can be applied by the Raritone team so an outage never breaks an honest streak.",
                },
                {
                  title: "Verified server-side",
                  body: "Every check-in, streak calculation, and reward eligibility decision is validated on Raritone's servers — never in the browser.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-deep">
                    <ShieldIcon width={17} height={17} />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-coal">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-coal-500">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Reward eligibility */}
      <section className="border-t border-coal/8 bg-coal text-white">
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Day 30</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              “You've completed your Style Streak!”
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70">
              When you reach day 30, Raritone verifies the full qualifying streak, your active membership and plan
              rules, reward availability, the partner campaign's validity, product and discount limits, and any purchase
              requirements. Only then is a reward issued — with clear redemption instructions and expiry.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
              <h3 className="text-sm font-semibold text-white">If no reward is available</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                We will say so plainly, explain why, and point you to support. We never issue a placeholder coupon or
                claim a reward has been reserved when it hasn't.
              </p>
              <div className="mt-5 rounded-2xl bg-white/8 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Illustrative example</p>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  “10% off your next eligible fashion purchase” — available only when a participating brand has approved
                  the campaign, for eligible products only, subject to the partner's minimum order value, expiry, and
                  redemption rules.
                </p>
              </div>
              <Link to="/rewards" className="st-btn-accent mt-6">
                How rewards work <ArrowRight width={16} height={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-coal/8">
        <div className="st-container py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-medium tracking-tight text-coal">Start your day one.</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/sign-up" className="st-btn-primary px-6 py-3 text-[15px]">
              Start Your Style Streak <ArrowRight width={16} height={16} />
            </Link>
            <Link to="/membership" className="st-btn-outline px-6 py-3 text-[15px]">
              See membership plans
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
