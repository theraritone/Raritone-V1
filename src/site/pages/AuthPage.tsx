import { useState, type FormEvent, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link, navigate } from "../router";
import { Field, FormStatus, apiErrorMessage } from "../components/forms";
import { Logo } from "../components/Logo";
import { signIn, signUp } from "../api";
import type { SiteUserPublic } from "../../../shared/site.js";

type Mode = "sign-in" | "sign-up";

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; switch: string; switchTo: Mode }> = {
  "sign-in": {
    title: "Welcome back.",
    subtitle: "Sign in to see your streak, calendar, and rewards.",
    cta: "Sign in",
    switch: "New to Raritone?",
    switchTo: "sign-up",
  },
  "sign-up": {
    title: "Start your streak.",
    subtitle: "Create a free account — no subscription needed to explore.",
    cta: "Create account",
    switch: "Already have an account?",
    switchTo: "sign-in",
  },
};

export function AuthPage({ mode }: { mode: Mode }): ReactNode {
  const isSignUp = mode === "sign-up";
  usePageMeta({
    title: isSignUp ? "Sign Up | Raritone" : "Sign In | Raritone",
    description: isSignUp
      ? "Create a free Raritone account — no subscription needed to explore. Your Style Streak starts with your first saved look."
      : "Sign in to Raritone to see your Style Streak, calendar, rewards, and membership.",
    path: isSignUp ? "/sign-up" : "/sign-in",
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (isSignUp && name.trim().length < 2) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Passwords need at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const result: { user: SiteUserPublic } = isSignUp
        ? await signUp({ name: name.trim(), email: email.trim(), password })
        : await signIn({ email: email.trim(), password });
      setStatus("success");
      setMessage(result.user.role === "admin" ? "Signed in — opening the admin dashboard." : "Signed in — opening your dashboard.");
      navigate(result.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(apiErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <section className="st-container grid min-h-[calc(100dvh-4rem)] place-items-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/" aria-label="Raritone home" className="rounded-xl">
            <Logo size="lg" />
          </Link>
        </div>
        <div className="st-card p-7 sm:p-9">
          <h1 className="font-display text-3xl font-medium tracking-tight text-coal">{copy.title}</h1>
          <p className="mt-2 text-sm text-coal-500">{copy.subtitle}</p>

          <form onSubmit={submit} noValidate className="mt-7 space-y-4">
            {isSignUp && (
              <Field label="Name" required error={errors.name}>
                <input
                  className="st-input"
                  value={name}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                />
              </Field>
            )}
            <Field label="Email address" required error={errors.email}>
              <input
                type="email"
                className="st-input"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field
              label="Password"
              required
              error={errors.password}
              hint={isSignUp ? "At least 8 characters." : undefined}
            >
              <input
                type="password"
                className="st-input"
                value={password}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
              />
            </Field>
            <FormStatus status={status} message={message} />
            <button type="submit" className="st-btn-primary w-full py-3 text-[15px]" disabled={busy}>
              {busy ? "Please wait…" : copy.cta}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-coal-500">
            {copy.switch}{" "}
            <Link to={copy.switchTo === "sign-up" ? "/sign-up" : "/sign-in"} className="font-medium text-coal underline underline-offset-2">
              {copy.switchTo === "sign-up" ? "Sign up" : "Sign in"}
            </Link>
          </p>
          {mode === "sign-in" && (
            <p className="mt-2 text-center text-sm text-coal-500">
              <Link to="/forgot-password" className="font-medium text-coal-500 hover:text-coal">
                Forgot your password?
              </Link>
            </p>
          )}
          {isSignUp && (
            <p className="mt-6 text-xs leading-relaxed text-coal-400">
              By creating an account you accept the{" "}
              <Link to="/terms-and-conditions" className="underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              . Email verification is sent once our email service is connected; your account works before that.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
