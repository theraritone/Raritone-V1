import type { StreakState } from "../../shared/site.js";

/**
 * The labelled demo state used across the public site until a visitor signs in
 * and real activity is loaded. Mirrors the example in the product spec:
 * streak 12, completed 12, 18 days remaining, challenge in progress.
 */
export function defaultStreak(): StreakState {
  const now = new Date();
  const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST day key
  const days: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    days.unshift(d.toISOString().slice(0, 10));
  }
  return {
    currentStreak: 12,
    longestStreak: 12,
    totalDays: 12,
    daysRemaining: 18,
    status: "in_progress",
    today,
    checkedInToday: true,
    days,
    milestones: milestonesFor(12),
  };
}

export function milestonesFor(current: number): Array<{ day: number; label: string; achieved: boolean }> {
  return [
    { day: 1, label: "Start your streak", achieved: current >= 1 },
    { day: 7, label: "One week of style", achieved: current >= 7 },
    { day: 15, label: "Halfway there", achieved: current >= 15 },
    { day: 30, label: "Challenge complete", achieved: current >= 30 },
  ];
}
