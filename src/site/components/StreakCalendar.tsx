import type { ReactNode } from "react";
import { Flame } from "./icons";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The 30-day Style Streak challenge grid. `completed` is the number of
 * consecutive qualifying days in the current run; the next cell is today's
 * slot, and everything after it is still to earn.
 */
export function ChallengeGrid({
  completed,
  status,
  compact = false,
}: {
  completed: number;
  status: "not_started" | "in_progress" | "completed" | "broken";
  compact?: boolean;
}): ReactNode {
  const cells: ReactNode[] = [];
  for (let day = 1; day <= 30; day += 1) {
    const done = day <= completed && (status === "in_progress" || status === "completed");
    const isNext = day === completed + 1 && status === "in_progress";
    const missedHere = status === "broken" && day === completed + 1;
    cells.push(
      <div
        key={day}
        className={`grid aspect-square place-items-center rounded-lg text-[10px] font-semibold transition-colors sm:text-xs ${
          done
            ? "bg-gold text-coal"
            : isNext
              ? "border-2 border-gold bg-gold-soft text-gold-deep"
              : missedHere
                ? "border border-coal/10 bg-coal/5 text-coal-400 line-through"
                : "border border-coal/10 bg-white text-coal-400"
        }`}
        title={done ? `Day ${day} · saved` : isNext ? `Day ${day} · today` : `Day ${day}`}
      >
        {day}
      </div>,
    );
  }

  return (
    <div>
      <div className={`grid grid-cols-10 gap-1.5 ${compact ? "" : "sm:gap-2"}`}>{cells}</div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-coal-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gold" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border-2 border-gold bg-gold-soft" /> Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-coal/10 bg-white" /> Upcoming
        </span>
      </div>
    </div>
  );
}

function monthDays(month: Date): Array<Date | null> {
  // The server keys qualifying days by their IST calendar date; this grid is
  // built with UTC day math so cell keys match those keys regardless of the
  // viewer's local timezone.
  const first = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
  const count = new Date(Date.UTC(month.getFullYear(), month.getMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const cells: Array<Date | null> = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= count; d += 1) {
    cells.push(new Date(Date.UTC(month.getFullYear(), month.getMonth(), d)));
  }
  return cells;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A real monthly calendar for the signed-in dashboard. */
export function MonthCalendar({ savedDays, todayKey }: { savedDays: string[]; todayKey: string }): ReactNode {
  const saved = new Set(savedDays);
  const now = new Date();
  const [y, m] = todayKey.split("-").map((part) => Number.parseInt(part, 10));
  const month = Number.isFinite(y) && Number.isFinite(m) && y === now.getFullYear() && m === now.getMonth() + 1 ? new Date(y, m - 1, 1) : now;
  const label = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-coal">{label}</p>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-coal-400">
        {DAY_LETTERS.map((letter, i) => (
          <span key={`${letter}-${i}`}>{letter}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {monthDays(month).map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />;
          const key = dayKey(date);
          const isSaved = saved.has(key);
          const isToday = key === todayKey;
          const isFuture = key > todayKey;
          return (
            <div
              key={key}
              className={`grid aspect-square place-items-center rounded-lg text-xs font-medium ${
                isSaved
                  ? "bg-gold text-coal"
                  : isToday
                    ? "border-2 border-gold bg-gold-soft text-gold-deep"
                    : isFuture
                      ? "border border-coal/8 text-coal-400/60"
                      : "border border-coal/10 text-coal-500"
              }`}
              title={isSaved ? "Qualifying look saved" : key}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StreakPill({ streak }: { streak: number }): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-coal">
      <Flame width={13} height={13} />
      {streak} day{streak === 1 ? "" : "s"}
    </span>
  );
}
