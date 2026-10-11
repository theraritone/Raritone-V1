import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { ArrowRight, CameraIcon, Flame, HeartIcon, ShieldIcon } from "../components/icons";

export function AboutPage(): ReactNode {
  usePageMeta({
    title: "About Raritone | Raritone",
    description:
      "Raritone Private Limited is an Indian fashion technology startup building a Snapchat-like fashion experience: live virtual try-on, a daily outfit calendar, and streak-based rewards.",
    path: "/about",
  });

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">About Raritone</p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-coal sm:text-5xl">
            We're making getting dressed <span className="italic text-gold-deep">the best part of the day.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Raritone Private Limited is an Indian fashion technology startup. We're building a Snapchat-like fashion
            experience — not another shopping marketplace — where the joy is in trying, saving, and repeating.
          </p>
        </Reveal>
      </section>

      <section className="border-t border-coal/8 bg-white">
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">The product idea</h2>
            <div className="st-prose mt-4 max-w-xl">
              <p>
                Fashion is social, visual, and daily — but trying clothes online is still a coin flip, and keeping a
                sense of your own style is mostly memory. Raritone puts a virtual fitting room in your camera and a
                calendar behind your wardrobe.
              </p>
              <p>
                The core loop is deliberately small: try an outfit virtually, save the look you love, come back
                tomorrow. Do that consistently and your Style Streak grows — and with it, eligibility for rewards from
                partner campaigns that brands fund and control.
              </p>
              <p>
                We are not building a conventional online marketplace. Shopping and partner offers support the
                experience; the experience is trying on fashion.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-4">
              {[
                {
                  icon: <CameraIcon />,
                  title: "Live Virtual Try-On",
                  body: "See outfits on yourself through the camera — photo try-on is live, real-time live mode is in development.",
                },
                {
                  icon: <Flame />,
                  title: "Style Streak",
                  body: "A 30-day challenge that turns daily looks into a habit, verified server-side.",
                },
                {
                  icon: <HeartIcon />,
                  title: "Daily Outfit Calendar",
                  body: "A personal, private calendar of what you wore and what you loved.",
                },
                {
                  icon: <ShieldIcon />,
                  title: "Fashion Rewards",
                  body: "Eligible rewards from approved partner campaigns — honest limits, real expiry dates.",
                },
              ].map((item) => (
                <div key={item.title} className="st-card flex gap-4 p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-deep">
                    {item.icon}
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

      <section className="border-t border-coal/8">
        <div className="st-container py-16 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">What we promise</h2>
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              {
                title: "Truth over spectacle",
                body: "Try-on output is labelled, never passed off as a photo or a fit guarantee. If a feature isn't live, the website says so.",
              },
              {
                title: "Private by default",
                body: "Body imagery, try-ons, and wardrobes stay private unless you share them. Deletion means deletion.",
              },
              {
                title: "Honest rewards",
                body: "No fake coupons, no reserved seats that don't exist. Rewards are funded, approved, and limited — and stated plainly.",
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <div className="st-card h-full p-7">
                  <h3 className="font-display text-xl font-medium text-coal">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-coal-500">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-coal/8 bg-coal text-white">
        <div className="st-container py-16 text-center sm:py-20">
          <p className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Your Style. Your Streak. Your Rewards.
          </p>
          <p className="mt-3 text-sm text-white/60">Try it. Save it. Make it your style.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/sign-up" className="st-btn-accent px-6 py-3 text-[15px]">
              Join Raritone <ArrowRight width={16} height={16} />
            </Link>
            <Link to="/contact" className="st-btn px-6 py-3 text-[15px] text-white ring-1 ring-inset ring-white/25 hover:ring-white/50">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
