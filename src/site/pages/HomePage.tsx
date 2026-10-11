import { useEffect, useState, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link, navigate } from "../router";
import { PricingTable } from "../components/PricingTable";
import { PhonePreview } from "../components/PhonePreview";
import { Reveal } from "../components/Reveal";
import { ChallengeGrid } from "../components/StreakCalendar";
import { ArrowRight, CameraIcon, Check, Flame, GiftIcon, ShieldIcon, Spark, TshirtIcon } from "../components/icons";
import { fetchStreak } from "../api";
import { defaultStreak } from "../demo";
import type { StreakState } from "../../../shared/site.js";

/**
 * The homepage. Every claim is written to stay true while the product is still
 * in development: try-on is labelled as in development, streak numbers on this
 * page are a labelled demo state, and no partner, review, or statistic is
 * invented.
 */
export function HomePage(): ReactNode {
  usePageMeta({
    title: "Raritone | Live Virtual Try-On & Daily Fashion Style Streak",
    description:
      "Discover Raritone, a fashion technology experience for virtual outfit try-ons, daily style tracking, and eligible fashion rewards.",
    path: "/",
  });

  // The homepage streak strip shows real signed-in data when it exists, and a
  // clearly-labelled demo state otherwise.
  const [signedIn, setSignedIn] = useState(false);
  const [realStreak, setRealStreak] = useState<StreakState | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchStreak()
      .then((result) => {
        if (!cancelled && result.streak) {
          setSignedIn(true);
          setRealStreak(result.streak);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const demoStreak = realStreak ?? defaultStreak();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-gold-soft blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-52 top-72 h-[420px] w-[420px] rounded-full bg-cream blur-3xl"
        />
        <div className="st-container relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <p className="st-gold-chip">
              <Spark width={13} height={13} /> Live Virtual Try-On · In development
            </p>
            <h1 className="mt-5 font-display text-4xl font-medium leading-[1.05] tracking-tight text-coal sm:text-6xl">
              Your Next Outfit. <span className="italic text-gold-deep">Your New Streak.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-coal-700">
              Try outfits virtually, capture your daily looks, build your personal style calendar, and unlock exciting
              fashion rewards with Raritone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/app" className="st-btn-primary px-6 py-3 text-[15px]">
                Start Trying On <ArrowRight width={17} height={17} />
              </Link>
              <Link to="/membership" className="st-btn-outline px-6 py-3 text-[15px]">
                Explore Memberships
              </Link>
            </div>
            <p className="mt-5 text-sm text-coal-400">Discover your style, one look at a time.</p>
          </Reveal>
          <Reveal delay={120} className="relative">
            <PhonePreview />
          </Reveal>
        </div>
      </section>

      {/* Product demonstration */}
      <section className="border-t border-coal/8 bg-white">
        <div className="st-container py-20 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="st-eyebrow">The experience</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">
              Fashion, Meet Your Camera.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
              Raritone turns your camera into a fitting room. Here is what a daily look looks like — the visual below
              is an illustrative preview while live try-on finishes development.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: <TshirtIcon />,
                title: "Try on virtually",
                body: "Preview outfits on yourself through the available virtual try-on experience.",
                visual: "from-[#efe9dd] to-[#e2d7bf]",
              },
              {
                icon: <CameraIcon />,
                title: "Capture your look",
                body: "Save your favorite looks and organize them in your personal wardrobe.",
                visual: "from-[#f3efe8] to-[#dcd2c0]",
              },
              {
                icon: <Flame />,
                title: "Build your streak",
                body: "Complete daily outfit check-ins and work toward eligible fashion rewards.",
                visual: "from-[#fbf1d2] to-[#f0dfae]",
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 100}>
                <article className="st-card group h-full overflow-hidden">
                  <div className={`grid h-36 place-items-center bg-gradient-to-br ${item.visual}`}>
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-coal shadow-sm transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">
                      {item.icon}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-base font-semibold text-coal">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-coal-500">{item.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-coal/8">
        <div className="st-container py-20 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="st-eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">
              Four steps. One daily habit.
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", title: "Discover", body: "Open Raritone and explore supported fashion items." },
              { step: "02", title: "Try", body: "Use the available Photo Try-On or Live Try-On experience." },
              { step: "03", title: "Save", body: "Save a qualifying outfit to your Style Calendar." },
              { step: "04", title: "Unlock", body: "Complete the required challenge and claim eligible rewards." },
            ].map((item, index) => (
              <Reveal key={item.step} delay={index * 90}>
                <li className="st-card h-full p-6">
                  <span className="font-display text-2xl font-medium italic text-gold-deep">{item.step}</span>
                  <h3 className="mt-3 text-base font-semibold text-coal">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-coal-500">{item.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-10 text-center">
            <Link to="/how-it-works" className="st-btn-outline">
              See How It Works <ArrowRight width={16} height={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Style Streak feature */}
      <section className="border-t border-coal/8 bg-coal text-white">
        <div className="st-container grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Style Streak</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              One Look Every Day. <span className="italic text-gold">One Streak at a Time.</span>
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70">
              Build a daily fashion habit: try on an outfit, save it to your Style Calendar, and keep the streak alive.
              Reach day 30 to qualify for eligible rewards from active partner campaigns.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Day 1 — First look saved",
                "Day 7 — One week of styling",
                "Day 15 — Halfway milestone",
                "Day 30 — Challenge completed",
              ].map((milestone) => (
                <li key={milestone} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-gold">
                    <Check width={13} height={13} />
                  </span>
                  {milestone}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-white/45">Milestones shown are illustrative progress markers, not guaranteed additional rewards.</p>
            <Link to="/style-streak" className="st-btn-accent mt-8">
              Explore Style Streak <ArrowRight width={16} height={16} />
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {signedIn ? "Your streak so far" : "Example streak"}
                  </p>
                  <p className="text-xs text-white/50">{signedIn ? "From your account activity" : "Demo values — sign in to see your own"}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-coal">
                  <Flame width={13} height={13} /> {demoStreak.currentStreak} days
                </span>
              </div>
              <ChallengeGrid completed={demoStreak.currentStreak} status={demoStreak.status} />
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Challenge progress</span>
                  <span>{Math.round((demoStreak.currentStreak / 30) * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-700"
                    style={{ width: `${(demoStreak.currentStreak / 30) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Membership preview */}
      <section className="border-t border-coal/8 bg-cream/60">
        <div className="st-container py-20 sm:py-28">
          <Reveal>
            <PricingTable
              onChoose={() => navigate("/membership")}
              headline="Find Your Style. Choose Your Plan."
              subline="Three plans, one daily habit. Full details, comparison, and billing options on the membership page."
            />
          </Reveal>
        </div>
      </section>

      {/* Brand partnerships */}
      <section className="border-t border-coal/8 bg-white">
        <div className="st-container grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2">
          <Reveal>
            <p className="st-eyebrow">For fashion brands</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">
              Fashion Brands. Meet Your Future Customers.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-coal-500">
              Partner with Raritone to introduce your collection to users who love experimenting with fashion. Explore
              virtual try-on opportunities, exclusive coupon campaigns, and measurable customer engagement.
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                "Brand discovery and product exposure",
                "Eligible virtual try-on product placement",
                "Exclusive coupon campaigns",
                "Trackable referral links and coupon redemptions",
                "Fashion challenge sponsorship opportunities",
                "Campaign performance reporting",
              ].map((benefit) => (
                <li key={benefit} className="flex gap-2.5 text-sm text-coal-700">
                  <Check width={16} height={16} className="mt-0.5 shrink-0 text-gold-deep" />
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/brands" className="st-btn-primary">
                Partner With Raritone
              </Link>
              <span className="text-xs text-coal-400">Partnerships are not confirmed yet — be the first.</span>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-3xl border border-dashed border-coal/20 bg-paper p-10 text-center">
              <GiftIcon width={28} height={28} className="mx-auto text-gold-deep" />
              <p className="mt-4 font-display text-xl font-medium text-coal">Become a Partner</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-coal-500">
                Our partner showcase opens with our first confirmed collaborations. Apply now and help shape the
                launch cohort.
              </p>
              <Link to="/brands#apply" className="st-btn-outline mt-6">
                Become a Partner <ArrowRight width={16} height={16} />
              </Link>
              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-coal-400">
                <ShieldIcon width={13} height={13} /> Campaigns activate only after written brand approval.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-coal/8">
        <div className="st-container py-20 text-center sm:py-28">
          <Reveal>
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-medium tracking-tight text-coal sm:text-5xl">
              Ready to Make Every Look Count?
            </h2>
            <p className="mt-4 text-[15px] text-coal-500">Start your fashion journey with Raritone.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/sign-up" className="st-btn-primary px-6 py-3 text-[15px]">
                Get Started
              </Link>
              <Link to="/membership" className="st-btn-outline px-6 py-3 text-[15px]">
                Explore Memberships
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
