import { useId, type ReactNode } from "react";
import { SiteApiError } from "../api";
import { Check, CloseIcon } from "./icons";

export function Field({
  label,
  hint,
  error,
  children,
  required = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}): ReactNode {
  return (
    <div>
      <span className="st-label">
        {label}
        {required && <span className="text-coal-400"> *</span>}
      </span>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-coal-400">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** One honest status surface for every form outcome. */
export function FormStatus({ status, message }: { status: "success" | "error" | null; message: string }): ReactNode {
  if (!status) return null;
  return (
    <div
      role={status === "success" ? "status" : "alert"}
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
        status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      {status === "success" ? (
        <Check width={17} height={17} className="mt-0.5 shrink-0" />
      ) : (
        <CloseIcon width={17} height={17} className="mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof SiteApiError) {
    return error.nextAction ? `${error.message} ${error.nextAction}` : error.message;
  }
  return "Something went wrong on our side. Nothing was saved — please try again.";
}

/** Checkbox with label + optional linked page, used for consent. */
export function ConsentCheckbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  error?: string;
}): ReactNode {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 shrink-0 rounded border-coal/25 accent-[#181611]"
          style={{ width: 18, height: 18 }}
          aria-invalid={Boolean(error)}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-coal-700">
          {children}
        </label>
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }): ReactNode {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-coal-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-coal/15 border-t-coal" />
      {label}
    </div>
  );
}
