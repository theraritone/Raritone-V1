import { useState, type FormEvent, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";
import { Field, FormStatus, apiErrorMessage } from "../components/forms";
import { ChatIcon, ShieldIcon } from "../components/icons";
import { submitContactMessage } from "../api";

const TOPICS = ["General question", "Account support", "Membership and billing", "Style Streak or rewards", "Brand partnership", "Privacy or data request"];

/**
 * Contact. We deliberately show no invented office address, phone number, or
 * registration number — messages are saved to the backend and answered by the
 * team on the email you provide.
 */
export function ContactPage(): ReactNode {
  usePageMeta({
    title: "Contact | Raritone",
    description: "Questions about Raritone, your account, membership, streaks, rewards, or partnerships — write to the team.",
    path: "/contact",
  });

  const [form, setForm] = useState({ name: "", email: "", topic: TOPICS[0], message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message2, setMessage2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) next.message = "Give us a little more detail (at least 10 characters).";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        topic: form.topic,
        message: form.message.trim(),
      });
      setStatus("success");
      setMessage2("Message received — it's saved with our team and we'll reply to your email.");
      setForm({ name: "", email: "", topic: TOPICS[0], message: "" });
    } catch (error) {
      setStatus("error");
      setMessage2(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="st-container py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="st-eyebrow">Contact</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-coal sm:text-5xl">
            Talk to the team.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-coal-500">
            Whether it's your account, a streak that broke during an outage, a membership question, or a partnership
            idea — we read everything.
          </p>
        </Reveal>
      </section>

      <section className="border-t border-coal/8 bg-white">
        <div className="st-container grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <div className="space-y-4">
              <div className="st-card flex gap-4 p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-coal">
                  <ChatIcon />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-coal">Support and questions</h2>
                  <p className="mt-1 text-sm leading-relaxed text-coal-500">
                    Use the form. It reaches the Raritone team directly and we reply to the email you provide — usually
                    within a few working days.
                  </p>
                </div>
              </div>
              <div className="st-card flex gap-4 p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-coal">
                  <ShieldIcon />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-coal">Privacy and data requests</h2>
                  <p className="mt-1 text-sm leading-relaxed text-coal-500">
                    For data export or deletion, pick “Privacy or data request” as the topic. Signed-in users can also
                    start these from Account Settings in the{" "}
                    <Link to="/dashboard" className="font-medium text-coal underline underline-offset-2">
                      dashboard
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-coal/15 bg-paper p-6">
                <h2 className="text-[15px] font-semibold text-coal">Brands</h2>
                <p className="mt-1 text-sm leading-relaxed text-coal-500">
                  Partnership inquiries are faster through the{" "}
                  <Link to="/brands#apply" className="font-medium text-coal underline underline-offset-2">
                    partner application form
                  </Link>
                  .
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <form onSubmit={submit} noValidate className="st-card space-y-5 p-6 sm:p-9">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your name" required error={errors.name}>
                  <input
                    className="st-input"
                    value={form.name}
                    autoComplete="name"
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>
                <Field label="Email address" required error={errors.email}>
                  <input
                    type="email"
                    className="st-input"
                    value={form.email}
                    autoComplete="email"
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    aria-invalid={Boolean(errors.email)}
                  />
                </Field>
              </div>
              <Field label="Topic">
                <select
                  className="st-input"
                  value={form.topic}
                  onChange={(event) => setForm({ ...form, topic: event.target.value })}
                >
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Message" required error={errors.message}>
                <textarea
                  className="st-input min-h-32"
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  aria-invalid={Boolean(errors.message)}
                />
              </Field>
              <FormStatus status={status} message={message2} />
              <button type="submit" className="st-btn-primary w-full py-3 text-[15px]" disabled={busy}>
                {busy ? "Sending…" : "Send message"}
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
