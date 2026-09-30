import { useEffect, useState, type ReactNode } from "react";

export function SplashScreen({ onContinue }: { onContinue: () => void }): ReactNode {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="rt-frame bg-ink-950" aria-labelledby="splash-title">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 grid size-20 place-items-center rounded-[1.75rem] bg-violet-electric shadow-[0_18px_60px_-18px_rgba(139,92,246,0.9)]">
          <span className="text-4xl font-semibold tracking-[-0.08em] text-white" aria-hidden="true">R</span>
        </div>
        <p className="rt-eyebrow text-cyan-signal">Personal visual wardrobe</p>
        <h1 id="splash-title" className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Raritone</h1>
        <p className="mt-4 max-w-xs text-base font-medium leading-6 text-white/70">Try on anything. Instantly.</p>
        <p className="mt-2 max-w-xs text-xs leading-5 text-white/45">AI-generated visual previews for your personal wardrobe.</p>
      </div>
      <div className="rt-safe-bottom px-6 pb-6">
        <button className="rt-btn-secondary h-11 w-full" onClick={onContinue} disabled={!ready}>
          {ready ? "Get started" : "Starting…"}
        </button>
      </div>
    </main>
  );
}
