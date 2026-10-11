import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link, navigate } from "../router";
import { FormStatus, Spinner, apiErrorMessage } from "../components/forms";
import { LockIcon } from "../components/icons";
import {
  fetchAdminMessages,
  fetchAdminOverview,
  fetchAdminPartners,
  fetchAdminUsers,
  fetchAdminWaitlist,
  fetchMe,
  markMessageHandled,
  updatePartnerApplication,
  updatePlanConfig,
} from "../api";
import { PLAN_TIERS, defaultPlans } from "../../../shared/site.js";
import type {
  AdminOverview,
  ContactMessage,
  PartnerApplication,
  PlanConfig,
  PlanTier,
  SiteUserPublic,
} from "../../../shared/site.js";

const TABS = ["Overview", "Users", "Partners", "Messages", "Waitlist", "Plans"] as const;
type Tab = (typeof TABS)[number];

/**
 * The admin dashboard. Server-side role authorization backs every endpoint;
 * the client merely renders what the API returns (or the honest lock screen
 * when the signed-in account isn't an administrator).
 */
export function AdminPage(): ReactNode {
  usePageMeta({
    title: "Admin Dashboard | Raritone",
    description: "Raritone internal administration.",
    path: "/admin",
  });

  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (!me.user) {
          navigate("/sign-in", { replace: true });
          return;
        }
        if (me.user.role !== "admin") {
          setState("denied");
          return;
        }
        setState("ready");
      })
      .catch(() => navigate("/sign-in", { replace: true }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="st-container py-24">
        <Spinner label="Checking access…" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="st-container grid min-h-[60vh] place-items-center py-24">
        <div className="st-card max-w-md p-8 text-center">
          <LockIcon width={26} height={26} className="mx-auto text-coal-400" />
          <h1 className="mt-4 font-display text-2xl font-medium text-coal">Admin access required</h1>
          <p className="mt-2 text-sm leading-relaxed text-coal-500">
            This dashboard is restricted to Raritone administrators. Sign in with an administrator account, or head
            back to the site.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/sign-in" className="st-btn-primary">
              Sign in
            </Link>
            <Link to="/" className="st-btn-outline">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="st-container py-10 sm:py-14">
      <header>
        <p className="st-eyebrow">Raritone internal</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-coal sm:text-4xl">Admin Dashboard</h1>
      </header>

      <nav aria-label="Admin sections" className="mt-8 flex gap-2 overflow-x-auto pb-1">
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
        {tab === "Overview" && <OverviewTab />}
        {tab === "Users" && <UsersTab />}
        {tab === "Partners" && <PartnersTab />}
        {tab === "Messages" && <MessagesTab />}
        {tab === "Waitlist" && <WaitlistTab />}
        {tab === "Plans" && <PlansTab />}
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

function OverviewTab(): ReactNode {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminOverview()
      .then(setOverview)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (error) return <FormStatus status="error" message={error} />;
  if (!overview) return <Spinner label="Loading metrics…" />;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={`${overview.totals.users}`} hint={`+${overview.totals.newUsers7d} in 7 days`} />
        <StatCard label="Check-ins today" value={`${overview.totals.checkinsToday}`} hint={`${overview.totals.checkinsTotal} all time`} />
        <StatCard label="Active streaks (≥2 days)" value={`${overview.totals.activeStreaks}`} />
        <StatCard label="Completed challenges" value={`${overview.totals.completedChallenges}`} />
        <StatCard label="Partner applications" value={`${overview.totals.partnerApplications}`} hint={`${overview.totals.newPartnerApplications} new`} />
        <StatCard label="Contact messages" value={`${overview.totals.contactMessages}`} hint={`${overview.totals.unhandledContactMessages} unhandled`} />
        <StatCard label="Membership waitlist" value={`${overview.totals.waitlist}`} />
        <StatCard label="Subscribers" value={`${overview.totals.subscribers}`} hint="Payments not connected yet" />
      </div>

      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Revenue</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-coal/10 bg-paper p-4">
            <p className="text-xs text-coal-400">MRR</p>
            <p className="mt-1 text-xl font-semibold text-coal">₹{overview.payments.mrrRupees.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-xl border border-coal/10 bg-paper p-4">
            <p className="text-xs text-coal-400">Annual sales</p>
            <p className="mt-1 text-xl font-semibold text-coal">₹{overview.payments.annualSalesRupees.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-xl border border-coal/10 bg-paper p-4">
            <p className="text-xs text-coal-400">Cancellations</p>
            <p className="mt-1 text-xl font-semibold text-coal">{overview.payments.cancellations}</p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-paper p-4 text-xs leading-relaxed text-coal-500">
          {overview.payments.gatewayConnected
            ? "Payment gateway connected. Figures above are verified gateway transactions only."
            : "No payment gateway is connected, so these figures are actual ₹0 — not projections. Verified revenue appears here only after gateway payments are confirmed server-side via signed webhooks."}
        </p>
      </section>

      <section className="st-card p-6">
        <h2 className="text-[15px] font-semibold text-coal">Subscribers by tier</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PLAN_TIERS.map((tier) => (
            <div key={tier} className="rounded-xl border border-coal/10 bg-paper p-4">
              <p className="text-xs capitalize text-coal-400">{overview.plans[tier].label}</p>
              <p className="mt-1 text-xl font-semibold text-coal">{overview.byTier[tier]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface AdminUser extends SiteUserPublic {
  checkinDays: number;
  currentStreak: number;
  deletionRequested: boolean;
}

function UsersTab(): ReactNode {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchAdminUsers()
      .then((result) => setUsers(result.users))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (error) return <FormStatus status="error" message={error} />;
  if (!users) return <Spinner label="Loading users…" />;

  const filtered = users.filter(
    (user) =>
      query.trim() === "" ||
      user.name.toLowerCase().includes(query.toLowerCase()) ||
      user.email.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="st-card overflow-hidden">
      <div className="border-b border-coal/8 p-4">
        <input
          className="st-input max-w-sm"
          placeholder="Search by name or email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search users"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-coal-500">{users.length === 0 ? "No users have registered yet." : "No users match that search."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-coal/8 text-xs uppercase tracking-wide text-coal-400">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Streak</th>
                <th className="px-4 py-3 font-semibold">Check-ins</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-coal/5 last:border-0">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-coal">{user.name}</span>
                    <span className="block text-xs text-coal-400">{user.email}</span>
                  </td>
                  <td className="px-4 py-3 capitalize text-coal-700">{user.role}</td>
                  <td className="px-4 py-3 text-coal-700">{user.currentStreak} days</td>
                  <td className="px-4 py-3 text-coal-700">{user.checkinDays}</td>
                  <td className="px-4 py-3 text-coal-400">{user.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    {user.deletionRequested ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">Deletion requested</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<PartnerApplication["status"], string> = {
  new: "New",
  reviewing: "Reviewing",
  info_requested: "Info requested",
  approved: "Approved",
  rejected: "Rejected",
};

function PartnersTab(): ReactNode {
  const [applications, setApplications] = useState<PartnerApplication[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    fetchAdminPartners()
      .then((result) => setApplications(result.applications))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) return <FormStatus status="error" message={error} />;
  if (!applications) return <Spinner label="Loading applications…" />;
  if (applications.length === 0) return <p className="st-card p-6 text-sm text-coal-500">No partner applications yet.</p>;

  const setStatus = async (id: string, status: PartnerApplication["status"]): Promise<void> => {
    try {
      const result = await updatePartnerApplication(id, { status });
      setApplications((current) => current!.map((app) => (app.id === id ? result.application : app)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <article key={app.id} className="st-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-coal">{app.businessName}</h2>
              <p className="text-sm text-coal-500">
                {app.contactName} · {app.email} · {app.phone}
              </p>
              <p className="mt-1 text-xs text-coal-400">
                {app.category} · {app.city} · {app.website}
                {app.catalogueSize ? ` · ${app.catalogueSize}` : ""}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                app.status === "approved"
                  ? "bg-emerald-50 text-emerald-800"
                  : app.status === "rejected"
                    ? "bg-red-50 text-red-800"
                    : app.status === "new"
                      ? "bg-gold-soft text-gold-deep"
                      : "bg-coal/5 text-coal-500"
              }`}
            >
              {STATUS_LABELS[app.status]}
            </span>
          </div>
          {app.proposedOffer && (
            <p className="mt-3 text-sm text-coal-700">
              <span className="font-medium">Proposed offer:</span> {app.proposedOffer}
            </p>
          )}
          {app.notes && <p className="mt-1 text-sm text-coal-500">{app.notes}</p>}
          <p className="mt-2 text-xs text-coal-400">Partnership types: {app.partnershipTypes.join(", ")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-coal/8 pt-4">
            {(["reviewing", "info_requested", "approved", "rejected"] as const).map((status) => (
              <button
                key={status}
                type="button"
                disabled={app.status === status}
                onClick={() => void setStatus(app.id, status)}
                className="st-btn border border-coal/12 px-3.5 py-1.5 text-xs text-coal-700 hover:border-coal/40 disabled:opacity-40"
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
            <span className="ml-auto text-xs text-coal-400">
              {app.agreementSigned ? "Written agreement recorded" : "No written agreement yet"} · applied {app.createdAt.slice(0, 10)}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function MessagesTab(): ReactNode {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminMessages()
      .then((result) => setMessages(result.messages))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (error) return <FormStatus status="error" message={error} />;
  if (!messages) return <Spinner label="Loading messages…" />;
  if (messages.length === 0) return <p className="st-card p-6 text-sm text-coal-500">No messages yet.</p>;

  const setHandled = async (id: string, handled: boolean): Promise<void> => {
    try {
      const result = await markMessageHandled(id, handled);
      setMessages((current) => current!.map((m) => (m.id === id ? result.message : m)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {[...messages]
        .sort((a, b) => Number(a.handled) - Number(b.handled) || b.createdAt.localeCompare(a.createdAt))
        .map((message) => (
          <article key={message.id} className={`st-card p-6 ${message.handled ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-coal">
                  {message.topic}
                  {!message.handled && <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">New</span>}
                </h2>
                <p className="text-sm text-coal-500">
                  {message.name} · {message.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void setHandled(message.id, !message.handled)}
                className="st-btn border border-coal/12 px-3.5 py-1.5 text-xs text-coal-700 hover:border-coal/40"
              >
                {message.handled ? "Mark unhandled" : "Mark handled"}
              </button>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-coal-700">{message.message}</p>
            <p className="mt-2 text-xs text-coal-400">{message.createdAt.slice(0, 10)}</p>
          </article>
        ))}
    </div>
  );
}

function WaitlistTab(): ReactNode {
  const [entries, setEntries] = useState<Array<{ id: string; email: string; plan: string; cycle: string; createdAt: string }> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminWaitlist()
      .then((result) => setEntries(result.entries))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (error) return <FormStatus status="error" message={error} />;
  if (!entries) return <Spinner label="Loading waitlist…" />;
  if (entries.length === 0) return <p className="st-card p-6 text-sm text-coal-500">Nobody on the waitlist yet.</p>;

  return (
    <div className="st-card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-coal/8 text-xs uppercase tracking-wide text-coal-400">
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">Plan</th>
            <th className="px-4 py-3 font-semibold">Cycle</th>
            <th className="px-4 py-3 font-semibold">Joined</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-coal/5 last:border-0">
              <td className="px-4 py-3 font-medium text-coal">{entry.email}</td>
              <td className="px-4 py-3 capitalize text-coal-700">{entry.plan}</td>
              <td className="px-4 py-3 capitalize text-coal-700">{entry.cycle}</td>
              <td className="px-4 py-3 text-coal-400">{entry.createdAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlansTab(): ReactNode {
  const [plans, setPlans] = useState<Record<PlanTier, PlanConfig>>(defaultPlans());
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);

  useEffect(() => {
    fetchAdminOverview()
      .then((overview) => setPlans(overview.plans))
      .catch((err) => setMessage(apiErrorMessage(err)));
  }, []);

  const save = async (tier: PlanTier, patch: { monthly?: number; annual?: number; enabled?: boolean }): Promise<void> => {
    setBusyTier(tier);
    try {
      const result = await updatePlanConfig(tier, patch);
      setPlans(result.plans);
      setStatus("success");
      setMessage("Plan configuration saved. The public membership page shows these prices immediately.");
    } catch (err) {
      setStatus("error");
      setMessage(apiErrorMessage(err));
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <div className="space-y-4">
      <FormStatus status={status} message={message} />
      <p className="text-sm text-coal-500">
        Plan prices and availability shown on the public membership page are configured here. Savings lines are
        computed from these numbers automatically.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => (
          <form
            key={tier}
            className="st-card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save(tier, {
                monthly: Number(data.get("monthly")),
                annual: Number(data.get("annual")),
              });
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold capitalize text-coal">{plans[tier].label}</h2>
              <label className="flex items-center gap-2 text-xs text-coal-500">
                <input
                  type="checkbox"
                  checked={plans[tier].enabled}
                  onChange={(event) => void save(tier, { enabled: event.target.checked })}
                  disabled={busyTier === tier}
                  className="accent-[#181611]"
                  style={{ width: 15, height: 15 }}
                />
                Enabled
              </label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-coal-500">Monthly (₹)</span>
                <input
                  name="monthly"
                  type="number"
                  min={1}
                  max={1000000}
                  defaultValue={plans[tier].monthly}
                  className="st-input"
                  key={`m-${plans[tier].monthly}`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-coal-500">Annual (₹)</span>
                <input
                  name="annual"
                  type="number"
                  min={1}
                  max={10000000}
                  defaultValue={plans[tier].annual}
                  className="st-input"
                  key={`a-${plans[tier].annual}`}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-coal-400">
              Annual saves ₹{Math.max(0, plans[tier].monthly * 12 - plans[tier].annual).toLocaleString("en-IN")} a year.
            </p>
            <button type="submit" className="st-btn-primary mt-4 w-full" disabled={busyTier === tier}>
              {busyTier === tier ? "Saving…" : "Save prices"}
            </button>
            <p className="mt-2 text-center text-xs text-coal-400">Updated {plans[tier].updatedAt.slice(0, 10)}</p>
          </form>
        ))}
      </div>
      <p className="rounded-xl border border-coal/10 bg-paper p-4 text-xs leading-relaxed text-coal-500">
        Note: reward definitions, coupon inventory, and campaign activation are the next stage of this module. No
        inactive or unapproved partner coupon can be shown as redeemable — rewards stay inactive until a brand's
        written approval is recorded.
      </p>
    </div>
  );
}
