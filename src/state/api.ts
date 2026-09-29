import { deviceId } from "./device";

/**
 * The single place the client talks to the server.
 *
 * Every failure the server can produce is an `ApiError` carrying a category, a
 * human message, and a next action, which is what the UI renders. Screens never
 * invent their own error text for a network failure, so the copy stays
 * consistent between an offline device and a refused try-on.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly category: ApiErrorCategory;
  readonly nextAction: string | null;
  readonly traceId: string | null;
  readonly retryIsFree: boolean;

  constructor(details: {
    status: number;
    category: ApiErrorCategory;
    message: string;
    nextAction?: string | null;
    traceId?: string | null;
    retryIsFree?: boolean;
  }) {
    super(details.message);
    this.name = "ApiError";
    this.status = details.status;
    this.category = details.category;
    this.nextAction = details.nextAction ?? null;
    this.traceId = details.traceId ?? null;
    this.retryIsFree = details.retryIsFree ?? false;
  }

  /** True when trying again cannot cost the user anything. */
  get isRetryable(): boolean {
    return this.retryIsFree || this.status >= 500 || this.category === "offline";
  }
}

export type ApiErrorCategory =
  | "offline"
  | "invalid_input"
  | "permission_denied"
  | "not_found"
  | "policy_blocked"
  | "rate_limited"
  | "provider_unavailable"
  | "provider_failed"
  | "allowance_exhausted"
  | "cost_cap_reached"
  | "rate_limited_provider"
  | "internal";

const OFFLINE: ApiErrorCategory = "offline";

/**
 * Where the API lives. Web builds keep this empty so every call stays
 * same-origin (`/api/...`). Native builds (Capacitor) run from
 * `capacitor://localhost` / `https://localhost`, where a relative `/api`
 * would hit the phone itself — so the native bundle bakes in the server
 * origin at build time, e.g. `VITE_API_BASE_URL=https://192.168.0.249:8443`.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? "").replace(/\/+$/, "");

/**
 * Make any app URL absolute for the current runtime. Full URLs (http, data,
 * blob) pass through untouched; root-relative app paths (`/api/...`,
 * `/media/...`) gain the API origin on native and stay relative on web.
 */
export function resolveAppUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|data:|blob:|capacitor:)/i.test(url)) return url;
  if (url.startsWith("/") && API_BASE) return `${API_BASE}${url}`;
  return url;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(resolveAppUrl(`/api${path}`), {
      ...init,
      headers: {
        // The guest credential. The server derives the account from it.
        "x-device-id": deviceId(),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError({
      status: 0,
      category: OFFLINE,
      message: "Can't reach Raritone right now.",
      nextAction: "Check your connection and try again.",
      retryIsFree: true,
    });
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const error = (body as { error?: Record<string, unknown> } | null)?.error;
    throw new ApiError({
      status: response.status,
      category: (error?.category as ApiErrorCategory) ?? "internal",
      message: (error?.message as string) ?? "Something went wrong on our side.",
      nextAction: (error?.nextAction as string) ?? null,
      traceId: (error?.traceId as string) ?? null,
      retryIsFree: Boolean(error?.retryIsFree),
    });
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
