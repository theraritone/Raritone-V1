import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { PhonePreview } from "../components/PhonePreview";
import { ArrowRight, CameraIcon, LockIcon, ShieldIcon } from "../components/icons";

/**
 * The Live Try-On page. It must be honest about product status: the Release 1
 * app is real and usable (camera-first photo try-on), while the real-time live
 * mode is still in development. No claim says real-time try-on is operational.
 */
export function LiveTryOnPage(): ReactNode {
  usePageMeta({
    title: "Live Try-On | Raritone",
    description:
      "Preview outfits on yourself with Raritone's virtual try-on — photo try-on is live in the app today, and the real-time live experience is in development.",
    path: "/live-try-on",
  });

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-32 h-[420px] w-[420px] rounded-full bg-gold-soft blur-3xl"
        />
        <div className="st-container relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <p className="st-gold-chip">In development — launching with the app</p>
            <h1 className="mt-5 font-display text-4xl font-medium leading-tight tracking-tight text-coal sm:text-5xl">
              Your camera, <span className="italic text-gold-deep">your fitting room.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-coal-700">
              Raritone's try-on lets you see an outfit on yourself before it ever reaches your wardrobe. The camera-first
              app is usable today for photo try-on; the real-time live experience is being finished now.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/app" className="st-btn-primary px-6 py-3 text-[15px]">
                Open the Raritone app <ArrowRight width={17} height={17} />
              </Link>
              <Link to="/style-streak" className="st-btn-outline px-6 py-3 text-[15px]">
                Turn looks into streaks
              </Link>
            </div>
            <p className="mt-5 text-sm text-coal-400">
              The app opens the Release 1 experience: photo try-on with your own garments. No account needed to try once.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <PhonePreview />
          </Reveal>
        </div>
      </section>

      <section className="border-t border-coal/8 bg-white">
        <div className="st-container py-20 sm:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="st-eyebrow">Two ways to try</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">
              Photo today. Live next.
            </h2>
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            <Reveal>
              <article className="st-card h-full p-8">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-coal text-white">
                    <CameraIcon />
                  </span>
                  <span className="st-chip">Available now</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-coal">Photo Try-On</h3>
                <p className="mt-2 text-sm leading-relaxed text-coal-500">
                  Capture or upload a photo, pick a garment, and receive an AI-generated visual try-on you can save to
                  your wardrobe and Style Calendar. Quality states are shown honestly — some garments are marked
                  experimental or unsupported.
                </p>
              </article>
            </Reveal>
            <Reveal delay={100}>
              <article className="st-card relative h-full overflow-hidden p-8">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold text-coal">
                    <CameraIcon />
                  </span>
                  <span className="st-gold-chip">Coming soon</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-coal">Live Try-On</h3>
                <p className="mt-2 text-sm leading-relaxed text-coal-500">
                  A real-time session where switching garments updates the preview as you move. Sessions are bounded,
                  usage is metered, and the camera stops the moment you leave. We will switch this page on the day the
                  live pipeline is genuinely operational.
                </p>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-t border-coal/8">
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">Camera and image privacy</h2>
            <div className="st-prose mt-4 max-w-xl">
              <p>
                Your camera is used only while you are creating a try-on. Camera frames are not continuously stored, and
                live sessions end — including the stream — when you leave the experience.
              </p>
              <p>
                Saved try-on results stay private to your account unless you choose to share them. Every saved artifact
                carries an “AI try-on” disclosure: you can move the label, but not remove it.
              </p>
              <p>
                We never train on your private body imagery by default, and we do not log image bytes or measurements.
                Read the full detail in our{" "}
                <Link to="/privacy-policy" className="font-medium text-coal underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-4">
              {[
                {
                  icon: <LockIcon />,
                  title: "Permission with a reason",
                  body: "The camera permission is requested only when you start a try-on, with a plain-language explanation first.",
                },
                {
                  icon: <ShieldIcon />,
                  title: "Private by default",
                  body: "Nothing is published unless you share it. Your wardrobe and your looks are yours.",
                },
                {
                  icon: <CameraIcon />,
                  title: "Honest AI labelling",
                  body: "Results are labelled as AI-generated visuals — never presented as photos of you or as fit guarantees.",
                },
              ].map((item) => (
                <div key={item.title} className="st-card flex gap-4 p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-coal">
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
    </>
  );
}
