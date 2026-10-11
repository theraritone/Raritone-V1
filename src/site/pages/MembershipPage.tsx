import { useState, type FormEvent, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { PricingTable } from "../components/PricingTable";
import { ConsentCheckbox, Field, FormStatus, apiErrorMessage } from "../components/forms";
import { ArrowRight, Check, LockIcon, ShieldIcon } from "../components/icons";
import { joinWaitlist } from "../api";
import type { MembershipCycle, PlanTier } from "../../../shared/site.js";

/**
 * Membership plans. Payments are not connected yet, so choosing a plan joins
 * the launch waitlist — a real server record — and the page says so plainly
 * instead of pretending checkout exists.
 */
export function MembershipPage(): ReactNode {
  usePageMeta({
    title: "Membership Plans | Raritone",
    description:
      "Choose the Raritone plan that fits your style habit — Starter, Plus, or VIP — with monthly or annual billing in Indian rupees.",
    path: "/membership",
  });

  const [selected, setSelected] = useState<{ plan: PlanTier; cycle: MembershipCycle } | null>(null);
  const [email, setEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptError, setAcceptError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const choose = (plan: PlanTier, cycle: MembershipCycle): void => {
    setSelected({ plan, cycle });
    setStatus(null);
    setMessage("");
    document.getElementById("join")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!selected) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(undefined);
    if (!acceptTerms) {
      setAcceptError("Please accept the subscription terms to continue.");
      return;
    }
    setAcceptError(undefined);
    setBusy(true);
    try {
      await joinWaitlist({ email: trimmed, plan: selected.plan, cycle: selected.cycle });
      setStatus("success");
      setMessage(
        `You're on the list for the ${selected.plan} plan (${selected.cycle}). We'll email ${trimmed} the moment checkout opens — no charge has been made.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">Membership</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-coal sm:text-5xl">
            Your Style. Your Streak. <span className="italic text-gold-deep">Your Rewards.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Every membership unlocks the 30-day Style Streak challenge and its eligible rewards. A subscription covers
            exactly the benefits listed for the plan — it is never a promise of a free product.
          </p>
        </Reveal>
      </section>

      <section className="border-t border-coal/8 bg-white">
        <div className="st-container py-16 sm:py-24">
          <PricingTable onChoose={choose} headline="Find Your Style. Choose Your Plan." />
        </div>
      </section>

      <section className="border-t border-coal/8">
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight text-coal">Before you subscribe</h2>
            <ul className="st-prose mt-6">
              {[
                "Renewal frequency is shown at checkout: monthly plans renew every month, annual plans every year, until cancelled.",
                "You can cancel any time; access continues until the end of the paid period.",
                "Refunds follow our Subscription and Refund Policy — annual plans include a 7-day change-of-mind window if no reward has been claimed.",
                "Prices are in Indian rupees; applicable taxes are shown before you pay.",
                "Reward caps, eligibility, and availability sit next to each offer — not only in the terms.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check width={16} height={16} className="mt-1 shrink-0 text-gold-deep" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3 rounded-2xl border border-coal/10 bg-white p-5">
              <ShieldIcon width={20} height={20} className="mt-0.5 shrink-0 text-gold-deep" />
              <p className="text-sm leading-relaxed text-coal-700">
                Payments will be processed by a regulated Indian payment provider, verified server-side with signed
                webhooks. We never trust a frontend success screen alone, and we never charge without your explicit
                authorization.
              </p>
            </div>
            <p className="mt-4 text-sm text-coal-500">
              Questions first?{" "}
              <Link to="/contact" className="font-medium text-coal underline underline-offset-2">
                Talk to us
              </Link>{" "}
              or read the{" "}
              <Link to="/subscription-and-refund-policy" className="font-medium text-coal underline underline-offset-2">
                subscription &amp; refund policy
              </Link>
              .
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div id="join" className="st-card scroll-mt-24 p-7 sm:p-9">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-soft text-gold-deep">
                  <LockIcon width={18} height={18} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-coal">Checkout opens soon</h2>
                  <p className="text-xs text-coal-400">Our payment provider is being connected.</p>
                </div>
              </div>

              {selected ? (
                <div className="mt-6 rounded-2xl border border-coal/10 bg-paper p-5">
                  <p className="text-sm font-semibold capitalize text-coal">
                    {selected.plan} plan · {selected.cycle} billing
                  </p>
                  <p className="mt-1 text-xs text-coal-500">
                    Amount due when checkout opens: shown live on the plan card above (taxes as applicable). Nothing is
                    charged today.
                  </p>
                </div>
              ) : (
                <p className="mt-6 rounded-2xl border border-dashed border-coal/15 bg-paper p-5 text-sm text-coal-500">
                  Pick a plan above and we'll hold your place — you'll choose final details at checkout.
                </p>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <Field label="Email address" required error={emailError}>
                  <input
                    type="email"
                    className="st-input"
                    placeholder="you@example.com"
                    value={email}
                    autoComplete="email"
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(emailError)}
                  />
                </Field>
                <ConsentCheckbox checked={acceptTerms} onChange={setAcceptTerms} error={acceptError}>
                  I accept the{" "}
                  <Link to="/terms-and-conditions" className="font-medium text-coal underline underline-offset-2">
                    Terms
                  </Link>
                  ,{" "}
                  <Link to="/privacy-policy" className="font-medium text-coal underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  , and{" "}
                  <Link to="/subscription-and-refund-policy" className="font-medium text-coal underline underline-offset-2">
                    Subscription &amp; Refund Policy
                  </Link>
                  , and I understand plan benefits and reward availability may change before launch.
                </ConsentCheckbox>
                <FormStatus status={status} message={message} />
                <button type="submit" className="st-btn-accent w-full py-3 text-[15px]" disabled={busy}>
                  {busy ? "Saving…" : "Notify me when checkout opens"}
                </button>
                <p className="text-center text-xs text-coal-400">
                  No payment is taken now. We'll email you once, when checkout is live.
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-coal/8 bg-coal text-white">
        <div className="st-container py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-medium tracking-tight">Still deciding?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/65">
            You don't need a subscription to create an account or explore what's public. Join free, try the experience,
            and upgrade when the streak pulls you in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/sign-up" className="st-btn-accent px-6 py-3 text-[15px]">
              Create a free account <ArrowRight width={16} height={16} />
            </Link>
            <Link to="/faq" className="st-btn px-6 py-3 text-[15px] text-white ring-1 ring-inset ring-white/25 hover:ring-white/50">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
