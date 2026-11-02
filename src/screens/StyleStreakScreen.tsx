import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../state/api";

interface StyleStreakData {
  currentStreak: number;
  completedToday: boolean;
  cycleDays: number;
  eligibleForReward: boolean;
  rewardStatus: string;
  message: string;
}

export function StyleStreakScreen({ onBack }: { onBack: () => void }): ReactNode {
  const [data, setData] = useState<StyleStreakData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<StyleStreakData>("/style-streak").then((result) => {
      if (active) setData(result);
    }).catch((caught) => {
      if (!active) return;
      setError(caught instanceof ApiError ? caught.message : "Could not load your Style Streak.");
    });
    return () => { active = false; };
  }, []);

  const streak = data?.currentStreak ?? 0;
  const progress = Math.min(100, Math.round((streak / 30) * 100));

  return (
    <main className="rt-frame rt-body-scroll bg-ink-950 px-5 pb-8 text-white">
      <header className="rt-safe-top flex items-center gap-3 pb-5 pt-3">
        <button type="button" className="rt-icon-btn" onClick={onBack} aria-label="Back to profile">‹</button>
        <div>
          <p className="rt-eyebrow">Raritone / Progress</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Style Streak</h1>
        </div>
      </header>

      <section className="rt-panel bg-gradient-to-br from-amber-300/25 via-violet-500/20 to-cyan-300/10 p-5">
        <p className="rt-eyebrow text-amber-100/80">30-day cycle</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div><strong className="text-5xl font-semibold tabular-nums">{streak}</strong><span className="ml-2 text-sm text-white/60">days</span></div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">{data?.completedToday ? "Completed today" : "Not completed today"}</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/25" aria-label={`${progress}% of the 30-day cycle complete`}>
          <div className="h-full rounded-full bg-amber-200 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-xs leading-5 text-white/65">Complete a qualifying try-on and save an outfit each day. Only server-verified activity counts.</p>
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
        <h2 className="text-sm font-semibold">Reward eligibility</h2>
        <p className="mt-2 text-sm text-white/65">{data?.eligibleForReward ? "You are eligible for the current reward cycle." : "Reward eligibility is checked by Raritone after the cycle is verified."}</p>
        <p className="mt-3 text-[11px] leading-5 text-white/45">Rewards are subject to published terms, inventory, and server verification. Missing a qualifying day makes the cycle ineligible.</p>
      </section>

      {error ? <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs text-rose-100" role="alert">{error}</p> : null}
      {data?.message ? <p className="mt-4 text-center text-[11px] text-white/45">{data.message}</p> : null}
    </main>
  );
}
