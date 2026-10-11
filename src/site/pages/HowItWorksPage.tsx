import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { ArrowRight, Check } from "../components/icons";

export function HowItWorksPage(): ReactNode {
  usePageMeta({
    title: "How It Works | Raritone",
    description:
      "Discover, try, save, unlock — how the Raritone Style Streak turns daily virtual try-ons into eligible fashion rewards.",
    path: "/how-it-works",
  });

  const steps = [
    {
      step: "01",
      title: "Discover",
      body: "Open Raritone and explore supported fashion items — your own uploads, or items shared into the experience. Release 1 focuses on upper-body garments.",
    },
    {
      step: "02",
      title: "Try",
      body: "Use the available Photo Try-On or Live Try-On experience to preview the outfit on yourself. Every result is labelled as an AI-generated visual try-on — never a fit guarantee.",
    },
    {
      step: "03",
      title: "Save",
      body: "Save a qualifying outfit to your Style Calendar. Opening the app or browsing is not enough — the day counts when the look is saved.",
    },
    {
      step: "04",
      title: "Unlock",
      body: "Complete the required challenge and claim eligible rewards from active campaigns, verified server-side before anything is issued.",
    },
  ];

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">How it works</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-coal sm:text-5xl">
            From open to unlocked, in four steps.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Raritone is a daily loop, not a shopping cart. Here is exactly how a look becomes a streak, and a streak
            becomes an eligible reward.
          </p>
        </Reveal>
      </section>

      <section className="border-t border-coal/8 bg-white">
        <div className="st-container py-16 sm:py-24">
          <ol className="space-y-6">
            {steps.map((item, index) => (
              <Reveal key={item.step} delay={index * 80}>
                <li className="st-card grid gap-4 p-7 sm:grid-cols-[auto_1fr] sm:items-baseline sm:gap-8 sm:p-9">
                  <span className="font-display text-4xl font-medium italic text-gold-deep">{item.step}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-coal">{item.title}</h2>
                    <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-coal-500">{item.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-coal/8">
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">What counts, and what doesn't</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
              Streak integrity is enforced on our servers, not in the app. One qualifying check-in per person per
              calendar day (Indian Standard Time) — and the qualifying activity is always a try-on saved to your
              calendar.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="st-card divide-y divide-coal/8">
              {[
                { ok: true, text: "A qualifying try-on saved to your Style Calendar" },
                { ok: true, text: "One check-in per calendar day, IST" },
                { ok: true, text: "Server-side verification of every check-in" },
                { ok: false, text: "Opening the app or visiting the calendar" },
                { ok: false, text: "Browsing garments without saving a look" },
                { ok: false, text: "Multiple check-ins in one day to catch up" },
              ].map((row) => (
                <p key={row.text} className="flex items-center gap-3 px-6 py-4 text-sm text-coal-700">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      row.ok ? "bg-gold-soft text-gold-deep" : "bg-coal/5 text-coal-400"
                    }`}
                  >
                    {row.ok ? <Check width={13} height={13} /> : <span aria-hidden>—</span>}
                  </span>
                  {row.text}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-coal/8 bg-coal text-white">
        <div className="st-container py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-medium tracking-tight">Start your first look today.</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/sign-up" className="st-btn-accent px-6 py-3 text-[15px]">
              Create your account <ArrowRight width={16} height={16} />
            </Link>
            <Link to="/style-streak" className="st-btn px-6 py-3 text-[15px] text-white ring-1 ring-inset ring-white/25 hover:ring-white/50">
              Read the Style Streak rules
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
