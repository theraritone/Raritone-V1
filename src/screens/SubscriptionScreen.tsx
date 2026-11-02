import { useMemo, useState, type ReactNode } from "react";
import { SUBSCRIPTION_PLANS, type PaidSubscriptionPlanId, type SubscriptionPlanId } from "../../shared/billing";
import { createInAppPurchaseAdapter } from "../lib/inAppPurchases";

export function SubscriptionScreen({ currentPlan = "free", onBack }: { currentPlan?: SubscriptionPlanId; onBack: () => void }): ReactNode {
  const [selected, setSelected] = useState<PaidSubscriptionPlanId>("pro");
  const [message, setMessage] = useState<string | null>(null);
  const adapter = useMemo(() => createInAppPurchaseAdapter(), []);

  const startPurchase = async (): Promise<void> => {
    setMessage(null);
    try { await adapter.purchase(selected); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Purchases are not available right now."); }
  };

  return (
    <main className="rt-frame rt-body-scroll bg-ink-950 px-5 pb-8 text-white">
      <header className="rt-safe-top flex items-center gap-3 pb-5 pt-3">
        <button type="button" className="rt-icon-btn" onClick={onBack} aria-label="Back to profile">‹</button>
        <div><p className="rt-eyebrow">Raritone / Membership</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose your pace</h1></div>
      </header>
      <section className="rt-panel bg-gradient-to-br from-violet-500/25 to-cyan-300/10 p-5">
        <p className="rt-eyebrow text-cyan-200/80">Try before you buy</p>
        <h2 className="mt-2 text-xl font-semibold">More looks. More possibilities.</h2>
        <p className="mt-2 text-sm leading-5 text-white/65">Your plan controls usage and benefits. Purchases are verified by Raritone's server.</p>
      </section>
      <section className="mt-5 space-y-3" aria-label="Subscription plans">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const active = plan.id === currentPlan;
          const selectedPlan = plan.id === selected;
          return <button key={plan.id} type="button" disabled={plan.id === "free"} onClick={() => plan.id !== "free" && setSelected(plan.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedPlan ? "border-cyan-300/70 bg-cyan-300/10" : "border-white/10 bg-white/[0.05]"}`}>
            <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold">{plan.name}</h2>{active ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">Current</span> : null}</div><p className="mt-1 text-xs text-white/55">{plan.summary}</p></div><strong className="text-lg">₹{plan.priceInr}<span className="text-xs font-normal text-white/50">/mo</span></strong></div>
            <ul className="mt-3 grid gap-1 text-xs text-white/70">{plan.benefits.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul>
          </button>;
        })}
      </section>
      <button type="button" className="rt-btn rt-btn-primary mt-5 h-12 w-full" onClick={() => void startPurchase()}>Continue with {selected === "pro" ? "Pro" : "VIP"}</button>
      <button type="button" className="rt-btn rt-btn-ghost mt-2 h-10 w-full text-xs" onClick={() => setMessage("Restore purchases will be available in the App Store and Google Play builds.")}>Restore purchases</button>
      <p className="mt-4 text-center text-[11px] leading-4 text-white/45">Subscriptions renew monthly unless cancelled in your store account. Raritone never grants access from a client-only payment result.</p>
      {message ? <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100" role="status">{message}</p> : null}
    </main>
  );
}
