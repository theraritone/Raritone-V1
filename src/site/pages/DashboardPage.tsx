import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link, navigate } from "../router";
import { MonthCalendar, StreakPill } from "../components/StreakCalendar";
import { Field, FormStatus, Spinner, apiErrorMessage } from "../components/forms";
import { Check, Flame, GiftIcon, Spark } from "../components/icons";
import {
  fetchMe,
  fetchStreak,
  postCheckin,
  requestAccountDeletion,
  signOut,
  updateMe,
} from "../api";
import { defaultStreak, milestonesFor } from "../demo";
import type { SiteUserPublic, StreakState } from "../../../shared/site.js";

const TABS = ["Overview", "Style Calendar", "Rewards", "Membership", "Settings"] as const;
type Tab = (typeof TABS)[number];

/**
 * The signed-in dashboard. Everything shown comes from the server session:
 * streaks from verified check-ins, membership from the (not yet live) billing
 * system — which today honestly reads "Free".
 */
export function DashboardPage(): ReactNode {
  usePageMeta({
    title: "Your Dashboard | Raritone",
    description: "Your Style Streak, outfit calendar, rewards, and membership in one place.",
    path: "/dashboard",
  });

  const [user, setUser] = useState<SiteUserPublic | null>(null);
  const [streak, setStreak] = useState<StreakState>(defaultStreak());
  const [tab, setTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMe(), fetchStreak().catch(() => ({ streak: defaultStreak() }))])
      .then(([me, streakResult]) => {
        if (cancelled) return;
        if (!me.user) {
          setRedirecting(true);
          navigate("/sign-in", { replace: true });
          return;
        }
        setUser(me.user);
        setStreak(streakResult.streak);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setRedirecting(true);
          navigate("/sign-in", { replace: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || redirecting || !user) {
    return (
      <div className="st-container py-24">
        <Spinner label="Loading your dashboard…" />
      </div>
    );
  }

  return (
    <div className="st-container py-10 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="st-eyebrow">Dashboard</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">
            Hi {user.name.split(" ")[0]}.
          </h1>
        </div>
        <StreakPill streak={streak.currentStreak} />
      </header>

      <nav aria-label="Dashboard sections" className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === item ? "bg-coal text-white" : "bg-white text-coal-500 ring-1 ring-inset ring-coal/10 hover:text-coal"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "Overview" && <OverviewTab user={user} streak={streak} onCheckedIn={setStreak} />}
        {tab === "Style Calendar" && <CalendarTab streak={streak} onCheckedIn={setStreak} />}
        {tab === "Rewards" && <RewardsTab streak={streak} />}
        {tab === "Membership" && <MembershipTab />}
        {tab === "Settings" && <SettingsTab user={user} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): ReactNode {
  return (
    <div className="st-card p-5">
      <p className="text-xs font-medium text-coal-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-coal">{value}</p>
      {hint && <p className="mt-1 text-xs text-coal-400">{hint}</p>}
    </div>
  );
}

function OverviewTab({
  user,
  streak,
  onCheckedIn,
}: {
  user: SiteUserPublic;
  streak: StreakState;
  onCheckedIn: (streak: StreakState) => void;
}): ReactNode {
  const nextMilestone = milestonesFor(streak.currentStreak).find((m) => !m.achieved);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Membership" value="Free" hint="Payments open soon" />
        <StatCard label="Current streak" value={`${streak.currentStreak} days`} hint={streak.status === "broken" ? "Restart today" : streak.status === "not_started" ? "Your first look starts it" : "Keep it alive"} />
        <StatCard label="Qualifying looks" value={`${streak.totalDays}`} />
        <StatCard label="Next milestone" value={nextMilestone ? `Day ${nextMilestone.day}` : "Done"} hint={nextMilestone?.label} />
      </div>

      <CheckinCard streak={streak} onCheckedIn={onCheckedIn} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="st-card p-6">
          <h2 className="text-[15px] font-semibold text-coal">Challenge progress</h2>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-coal-500">
              <span>{streak.status === "completed" ? "Challenge complete" : `Day ${Math.min(streak.currentStreak + 1, 30)} of 30`}</span>
              <span>{Math.round((Math.min(streak.currentStreak, 30) / 30) * 100)}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-coal/8">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (streak.currentStreak / 30) * 100)}%` }} />
            </div>
          </div>
          <ol className="mt-5 space-y-3">
            {milestonesFor(streak.currentStreak).map((milestone) => (
              <li key={milestone.day} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    milestone.achieved ? "bg-gold text-coal" : "border border-coal/15 text-coal-400"
                  }`}
                >
                  {milestone.achieved && <Check width={12} height={12} />}
                </span>
                <span className={milestone.achieved ? "font-medium text-coal" : "text-coal-500"}>
                  Day {milestone.day} — {milestone.label}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="st-card p-6">
          <h2 className="text-[15px] font-semibold text-coal">Recent activity</h2>
          {streak.days.length === 0 ? (
            <p className="mt-4 text-sm text-coal-500">
              Nothing here yet. Your first saved look starts your streak — try one in the app.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {streak.days
                .slice(-5)
                .reverse()
                .map((day) => (
                  <li key={day} className="flex items-center gap-3 text-sm text-coal-700">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-soft text-gold-deep">
                      <Flame width={14} height={14} />
                    </span>
                    <span className="font-medium">Qualifying look saved</span>
                    <span className="ml-auto text-xs text-coal-400">{day}</span>
                  </li>
                ))}
            </ol>
          )}
          <p className="mt-5 flex items-center gap-2 text-xs text-coal-400">
            <Spark width={13} height={13} className="text-gold-deep" /> Active rewards: none yet — campaigns open with our first brand partners.
          </p>
        </section>
      </div>

      <p className="text-xs text-coal-400">
        Signed in as {user.email} ({user.role === "admin" ? "administrator" : "member"}).
        {user.role === "admin" && (
          <>
            {" "}
            <Link to="/admin" className="font-medium text-coal underline underline-offset-2">
              Open the admin dashboard
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

function CheckinCard({ streak, onCheckedIn }: { streak: StreakState; onCheckedIn: (streak: StreakState) => void }): ReactNode {
  const [affirmed, setAffirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!affirmed) {
      setStatus("error");
      setMessage("Please confirm you completed a qualifying try-on and saved the look first.");
      return;
    }
    setBusy(true);
    try {
      const result = await postCheckin();
      onCheckedIn(result.streak);
      setStatus("success");
      setMessage(
        result.alreadyDone
          ? "Today is already counted — one qualifying check-in per day keeps the streak honest."
          : `Saved. Day ${result.streak.currentStreak} of your streak is on the calendar.`,
      );
      setAffirmed(false);
    } catch (error) {
      setStatus("error");
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="st-card p-6">
      <h2 className="text-[15px] font-semibold text-coal">Today's check-in</h2>
      {streak.checkedInToday ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-gold-soft px-4 py-3 text-sm font-medium text-gold-deep">
          <Check width={16} height={16} /> Today is on your calendar — come back tomorrow to keep the streak going.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <label className="flex items-start gap-3 text-sm text-coal-700">
            <input
              type="checkbox"
              checked={affirmed}
              onChange={(event) => setAffirmed(event.target.checked)}
              className="mt-0.5 accent-[#181611]"
              style={{ width: 16, height: 16 }}
            />
            <span>
              I completed a try-on today and saved the look to my Style Calendar.
              <span className="block text-xs text-coal-400">
                At launch this will be verified directly against your saved try-on; today your confirmation plus the
                server's one-check-in-per-day rule applies.
              </span>
            </span>
          </label>
          <FormStatus status={status} message={message} />
          <button type="submit" className="st-btn-accent" disabled={busy}>
            {busy ? "Saving…" : "Save today's check-in"}
          </button>
        </form>
      )}
    </section>
  );
}

function CalendarTab({ streak, onCheckedIn }: { streak: StreakState; onCheckedIn: (streak: StreakState) => void }): ReactNode {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="st-card p-6">
        <MonthCalendar savedDays={streak.days} todayKey={streak.today} />
        <p className="mt-4 text-xs text-coal-400">
          Gold days are verified qualifying check-ins (Indian Standard Time). Opening the app or visiting this page
          never counts as activity.
        </p>
      </section>
      <div className="space-y-6">
        <CheckinCard streak={streak} onCheckedIn={onCheckedIn} />
        <section className="st-card p-6">
          <h2 className="text-[15px] font-semibold text-coal">Streak history</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-coal-500">Current consecutive streak</dt>
              <dd className="font-semibold text-coal">{streak.currentStreak} days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-coal-500">Longest streak</dt>
              <dd className="font-semibold text-coal">{streak.longestStreak} days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-coal-500">Total qualifying days</dt>
              <dd className="font-semibold text-coal">{streak.totalDays}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-coal-500">Days remaining to day 30</dt>
              <dd className="font-semibold text-coal">{streak.daysRemaining}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function RewardsTab({ streak }: { streak: StreakState }): ReactNode {
  return (
    <div className="space-y-6">
      <section className="st-card p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-deep">
            <GiftIcon width={18} height={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-coal">Available rewards</h2>
            <p className="mt-1 text-sm leading-relaxed text-coal-500">
              No campaigns are active yet — rewards open with our first approved brand partners. When one goes live and
              your streak qualifies, it appears here with its code, expiry, and redemption steps.
            </p>
          </div>
        </div>
      </section>
      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Eligibility status</h2>
        <p className="mt-2 text-sm leading-relaxed text-coal-500">
          {streak.status === "completed"
            ? "You've completed your Style Streak! No reward is currently available — we'll contact you when a campaign you qualify for opens, or reach support from the contact page."
            : streak.status === "not_started"
              ? "Complete your first qualifying check-in to start the 30-day challenge."
              : `Day ${streak.currentStreak} of 30. Reach day 30 with your streak intact to qualify for eligible rewards from active campaigns.`}
        </p>
        <Link to="/style-streak" className="st-btn-outline mt-4">
          Review the rules
        </Link>
      </section>
      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Used and expired rewards</h2>
        <p className="mt-2 text-sm text-coal-500">Nothing here yet.</p>
      </section>
    </div>
  );
}

function MembershipTab(): ReactNode {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Current plan</h2>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-coal">Free</p>
        <p className="mt-1 text-sm text-coal-500">
          No paid membership yet. Checkout opens once our payment provider is connected — join the waitlist on the
          membership page and we'll email you.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/membership" className="st-btn-primary">
            See membership plans
          </Link>
        </div>
      </section>
      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Payment history</h2>
        <p className="mt-2 text-sm text-coal-500">
          No payments yet. When you subscribe, verified receipts appear here — every entry comes from our payment
          provider's server-side confirmation, never from a browser screen.
        </p>
        <div className="mt-5 rounded-xl border border-dashed border-coal/15 p-4 text-xs text-coal-400">
          Upgrades, downgrades, and cancellation will be self-serve here once billing is live.
        </div>
      </section>
    </div>
  );
}

function SettingsTab({ user }: { user: SiteUserPublic }): ReactNode {
  const [name, setName] = useState(user.name);
  const [prefs, setPrefs] = useState(user.prefs);
  const [nameStatus, setNameStatus] = useState<"success" | "error" | null>(null);
  const [nameMessage, setNameMessage] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<"success" | "error" | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    try {
      await updateMe({ name: name.trim() });
      setNameStatus("success");
      setNameMessage("Profile saved.");
    } catch (error) {
      setNameStatus("error");
      setNameMessage(apiErrorMessage(error));
    }
  };

  const savePrefs = async (next: typeof prefs): Promise<void> => {
    setPrefs(next);
    try {
      await updateMe({ prefs: next });
    } catch {
      setPrefs(user.prefs);
    }
  };

  const exportData = useCallback((): void => {
    // Export what the dashboard actually holds: profile, preferences, and the
    // verified streak record. Fetched fresh so the file is current.
    void fetchStreak()
      .then((result) => ({ streak: result.streak }))
      .catch(() => ({ streak: null }))
      .then((streak) => {
        const payload = {
          profile: { name: user.name, email: user.email, createdAt: user.createdAt },
          notificationPreferences: prefs,
          ...streak,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "raritone-data-export.json";
        anchor.click();
        URL.revokeObjectURL(url);
      });
  }, [user, prefs]);

  const requestDeletion = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setDeleting(true);
    try {
      await requestAccountDeletion(deleteReason.trim());
      setDeleteStatus("success");
      setDeleteMessage("Deletion request recorded. Our team will verify and confirm the deletion by email.");
    } catch (error) {
      setDeleteStatus("error");
      setDeleteMessage(apiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Profile</h2>
        <form onSubmit={saveProfile} className="mt-4 space-y-4">
          <Field label="Name" required>
            <input className="st-input" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email address" hint="Email changes go through support while accounts are young.">
            <input className="st-input" value={user.email} disabled />
          </Field>
          <FormStatus status={nameStatus} message={nameMessage} />
          <button type="submit" className="st-btn-primary">
            Save profile
          </button>
        </form>
      </section>

      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Notification preferences</h2>
        <div className="mt-4 space-y-4">
          {[
            { key: "streakReminders" as const, label: "Daily streak reminders", hint: "A nudge if today's look isn't saved yet. Respects your timezone." },
            { key: "marketing" as const, label: "Marketing updates", hint: "New features and campaigns. Optional, always." },
          ].map((item) => (
            <label key={item.key} className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-coal">{item.label}</span>
                <span className="mt-0.5 block text-xs text-coal-400">{item.hint}</span>
              </span>
              <input
                type="checkbox"
                checked={prefs[item.key]}
                onChange={(event) => void savePrefs({ ...prefs, [item.key]: event.target.checked })}
                className="mt-1 accent-[#181611]"
                style={{ width: 18, height: 18 }}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Your data</h2>
        <p className="mt-2 text-sm text-coal-500">Download what your dashboard holds today as JSON.</p>
        <button type="button" className="st-btn-outline mt-4" onClick={exportData}>
          Export my data
        </button>
      </section>

      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Sign out and deletion</h2>
        <button
          type="button"
          className="st-btn-outline mt-4"
          onClick={() => {
            void signOut().then(() => navigate("/"));
          }}
        >
          Sign out
        </button>
        <form onSubmit={requestDeletion} className="mt-6 space-y-3 border-t border-coal/8 pt-5">
          <Field label="Request account deletion" hint="Tell us why (optional) — it helps us improve.">
            <textarea
              className="st-input min-h-20"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Optional reason"
            />
          </Field>
          <FormStatus status={deleteStatus} message={deleteMessage} />
          <button type="submit" className="st-btn border border-red-200 bg-red-50 px-5 py-2.5 text-red-800 hover:bg-red-100" disabled={deleting}>
            {deleting ? "Sending…" : "Request deletion"}
          </button>
        </form>
      </section>
    </div>
  );
}
