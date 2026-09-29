import type { ReactNode } from "react";
import { ApiError } from "../state/api";
import { Icon } from "./ui";

/**
 * Failure surfaces.
 *
 * The PRD is emphatic that an error must say what happened, what to do next, and
 * whether a retry is free. `ErrorPanel` is the single place that renders an
 * `ApiError`, so no screen can invent softer copy for a real failure.
 */
export function ErrorPanel({
  error,
  onRetry,
  onDismiss,
  tone = "dark",
}: {
  error: ApiError | { message: string; nextAction?: string | null; category?: string };
  onRetry?: () => void;
  onDismiss?: () => void;
  tone?: "dark" | "light";
}): ReactNode {
  const message = error.message;
  const nextAction =
    "nextAction" in error && typeof error.nextAction === "string" ? error.nextAction : null;
  const canRetry = onRetry && (!("status" in error) || (error as ApiError).isRetryable);
  const dark = tone === "dark";

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 ${
        dark ? "border-amber-300/25 bg-ink-950/85 text-white" : "border-amber-300/40 bg-amber-50 text-ink-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon name="alert" className={`mt-0.5 size-5 shrink-0 ${dark ? "text-amber-300" : "text-amber-600"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{message}</p>
          {nextAction ? <p className={`mt-1 text-xs ${dark ? "text-white/70" : "text-ink-600"}`}>{nextAction}</p> : null}
          {canRetry || onDismiss ? (
            <div className="mt-3 flex gap-2">
              {canRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    dark ? "bg-white text-ink-900" : "bg-ink-900 text-white"
                  }`}
                >
                  Try again
                </button>
              ) : null}
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                    dark ? "border-white/25 text-white" : "border-ink-200 text-ink-700"
                  }`}
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A full-screen loader for the first bootstrap, before anything is known. */
export function BootScreen({ label }: { label: string }): ReactNode {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950 text-white" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <span className="size-10 rounded-2xl border-2 border-ink-100 motion-safe:animate-pulse" />
        <p className="text-sm text-white/70">{label}</p>
      </div>
    </div>
  );
}

/** A skeleton card used while a list loads, so layout does not jump. */
export function Skeleton({ className = "" }: { className?: string }): ReactNode {
  return <div className={`animate-pulse rounded-2xl bg-white/8 ${className}`} />;
}
