import { useState, type FormEvent, type ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Field, FormStatus, apiErrorMessage } from "../components/forms";
import { Logo } from "../components/Logo";
import { requestPasswordReset } from "../api";

/**
 * Password reset. Without an email provider connected we do not pretend to
 * send anything: the request is recorded as a support item and verified
 * manually, and the page says exactly that.
 */
export function ForgotPasswordPage(): ReactNode {
  usePageMeta({
    title: "Reset your password | Raritone",
    description: "Request a password reset for your Raritone account.",
    path: "/forgot-password",
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
      setStatus("success");
      setMessage(
        `If ${email.trim()} is registered, your reset request has been recorded. Our team verifies reset requests manually while automated email is being connected, and will send instructions to this address.`,
      );
    } catch (err) {
      setStatus("error");
      setMessage(apiErrorMessage(err));
    } finally {
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
          <h1 className="font-display text-3xl font-medium tracking-tight text-coal">Reset your password.</h1>
          <p className="mt-2 text-sm text-coal-500">
            Enter the email on your account and we'll record a verified reset request.
          </p>
          {sent ? (
            <div className="mt-7">
              <FormStatus status={status} message={message} />
              <p className="mt-6 text-center text-sm text-coal-500">
                <Link to="/sign-in" className="font-medium text-coal underline underline-offset-2">
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-7 space-y-4">
              <Field label="Email address" required error={error}>
                <input
                  type="email"
                  className="st-input"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error)}
                />
              </Field>
              <FormStatus status={status} message={message} />
              <button type="submit" className="st-btn-primary w-full py-3 text-[15px]" disabled={busy}>
                {busy ? "Recording request…" : "Request reset"}
              </button>
              <p className="text-center text-sm text-coal-500">
                <Link to="/sign-in" className="font-medium text-coal-500 hover:text-coal">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
