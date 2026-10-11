import type {
  AdminOverview,
  ContactMessage,
  MembershipCycle,
  PartnerApplication,
  PlanConfig,
  PlanTier,
  SiteUserPublic,
  StreakState,
  WaitlistEntry,
} from "../../shared/site.js";
import type { ApiErrorBody } from "../../shared/site.js";

/**
 * The website's API client. Every call is same-origin /api/site with cookies,
 * and every failure comes back as the one error shape the server emits, so the
 * UI can always show an honest message with a next action.
 */

export class SiteApiError extends Error {
  constructor(
    readonly status: number,
    readonly category: string,
    message: string,
    readonly nextAction: string,
  ) {
    super(message);
    this.name = "SiteApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/site${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SiteApiError(0, "network", "We could not reach the Raritone servers.", "Check your connection and try again.");
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const detail = (data as ApiErrorBody).error;
    throw new SiteApiError(
      response.status,
      detail?.category ?? "internal",
      detail?.message ?? "Something went wrong.",
      detail?.nextAction ?? "Please try again.",
    );
  }
  return data as T;
}

// --- auth -----------------------------------------------------------------

export function signUp(input: { name: string; email: string; password: string }): Promise<{ user: SiteUserPublic }> {
  return request("POST", "/auth/signup", input);
}

export function signIn(input: { email: string; password: string }): Promise<{ user: SiteUserPublic }> {
  return request("POST", "/auth/signin", input);
}

export function signOut(): Promise<{ ok: boolean }> {
  return request("POST", "/auth/signout");
}

export function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  return request("POST", "/auth/forgot-password", { email });
}

export function fetchMe(): Promise<{ user: SiteUserPublic | null }> {
  return request("GET", "/me");
}

export function updateMe(patch: { name?: string; prefs?: { streakReminders: boolean; marketing: boolean } }): Promise<{ user: SiteUserPublic }> {
  return request("PATCH", "/me", patch);
}

export function requestAccountDeletion(reason: string): Promise<{ ok: boolean }> {
  return request("POST", "/account/delete-request", { reason });
}

// --- style streak -----------------------------------------------------------

export function fetchStreak(): Promise<{ streak: StreakState }> {
  return request("GET", "/streak");
}

export function postCheckin(): Promise<{ streak: StreakState; alreadyDone: boolean }> {
  return request("POST", "/checkin");
}

// --- plans & membership -----------------------------------------------------

export function fetchPlans(): Promise<{ plans: Record<PlanTier, PlanConfig> }> {
  return request("GET", "/plans");
}

export function joinWaitlist(input: { email: string; plan: PlanTier; cycle: MembershipCycle }): Promise<{ ok: boolean }> {
  return request("POST", "/waitlist", input);
}

// --- forms ------------------------------------------------------------------

export function submitPartnerApplication(
  input: Omit<PartnerApplication, "id" | "status" | "agreementSigned" | "createdAt" | "updatedAt">,
): Promise<{ ok: true }> {
  return request("POST", "/partner-applications", input);
}

export function submitContactMessage(input: { name: string; email: string; topic: string; message: string }): Promise<{ ok: true }> {
  return request("POST", "/contact", input);
}

// --- admin --------------------------------------------------------------------

export function fetchAdminOverview(): Promise<AdminOverview> {
  return request("GET", "/admin/overview");
}

export function fetchAdminUsers(): Promise<{ users: Array<SiteUserPublic & { createdAt: string; checkinDays: number; currentStreak: number; deletionRequested: boolean }> }> {
  return request("GET", "/admin/users");
}

export function fetchAdminPartners(): Promise<{ applications: PartnerApplication[] }> {
  return request("GET", "/admin/partners");
}

export function updatePartnerApplication(id: string, patch: { status?: PartnerApplication["status"]; agreementSigned?: boolean }): Promise<{ application: PartnerApplication }> {
  return request("PATCH", `/admin/partners/${encodeURIComponent(id)}`, patch);
}

export function fetchAdminMessages(): Promise<{ messages: ContactMessage[] }> {
  return request("GET", "/admin/messages");
}

export function markMessageHandled(id: string, handled: boolean): Promise<{ message: ContactMessage }> {
  return request("PATCH", `/admin/messages/${encodeURIComponent(id)}`, { handled });
}

export function fetchAdminWaitlist(): Promise<{ entries: WaitlistEntry[] }> {
  return request("GET", "/admin/waitlist");
}

export function updatePlanConfig(tier: PlanTier, patch: { monthly?: number; annual?: number; enabled?: boolean; tagline?: string }): Promise<{ plans: Record<PlanTier, PlanConfig> }> {
  return request("PATCH", `/admin/plans/${encodeURIComponent(tier)}`, patch);
}
