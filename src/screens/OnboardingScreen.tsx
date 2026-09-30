import type { ReactNode } from "react";
import { Icon } from "../components/ui";

const features = [
  ["Live AI try-on", "Preview a selected garment in your camera."],
  ["Add any product link", "Bring in a link, screenshot, or garment photo."],
  ["Capture & share looks", "Save privately or share only when you choose."],
] as const;

export function OnboardingScreen({ onComplete }: { onComplete: () => void }): ReactNode {
  return (
    <main className="rt-frame bg-ink-950" aria-labelledby="onboarding-title">
      <div className="rt-safe-top flex items-center justify-between px-6 pt-4">
        <span className="text-sm font-semibold tracking-tight text-white">Raritone</span>
        <button className="rt-btn-ghost min-h-11" onClick={onComplete}>Skip</button>
      </div>
      <div className="flex flex-1 flex-col justify-center px-8">
        <div className="relative mb-8 grid aspect-[4/5] max-h-[330px] place-items-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-electric/25 via-chrome to-cyan-signal/10">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-violet-electric/25 blur-3xl" />
          <div className="absolute -bottom-16 -left-12 size-44 rounded-full bg-cyan-signal/15 blur-3xl" />
          <div className="relative grid size-24 place-items-center rounded-3xl border border-white/20 bg-white/10 text-white backdrop-blur-sm">
            <Icon name="sparkle" className="size-11" />
          </div>
        </div>
        <h1 id="onboarding-title" className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-white">See it. Save it. Wear the idea.</h1>
        <p className="mt-3 max-w-sm text-base leading-7 text-white/65">A camera-first visual wardrobe for style experiments, kept private by default.</p>
        <ul className="mt-6 space-y-4">
          {features.map(([title, body]) => (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-violet-electric/20 text-violet-200"><Icon name="check" className="size-4" /></span>
              <span><strong className="block text-sm font-semibold text-white">{title}</strong><span className="mt-0.5 block text-xs leading-5 text-white/55">{body}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rt-safe-bottom px-6 pb-6">
        <button
          className="rt-btn-primary h-11 w-full"
          onClick={onComplete}
        >
          Get started
        </button>
        <button className="rt-btn-ghost mt-2 min-h-11 w-full text-white/55" onClick={onComplete}>Continue as guest</button>
      </div>
    </main>
  );
}
