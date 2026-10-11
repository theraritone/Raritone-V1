import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type {
  AdminOverview,
  MembershipCycle,
  PartnerApplication,
  PlanTier,
  SiteUserPublic,
} from "../../shared/site.js";
import { PARTNERSHIP_TYPES, PLAN_TIERS } from "../../shared/site.js";
import { config } from "../env.js";
import {
  assertEmail,
  assertName,
  assertPassword,
  assertText,
  attachSiteUser,
  clearSessionCookie,
  computeStreak,
  hashPassword,
  istDayKey,
  newId,
  newSessionToken,
  requireSiteAdmin,
  setSessionCookie,
  siteUserOf,
  verifyPassword,
} from "../lib/siteAuth.js";
import { siteStore } from "../lib/siteStore.js";
import { badRequest, handler, HttpError } from "../lib/http.js";

/**
 * The raritone.com API. Mounted at /api/site BEFORE the PWA's guest-session
 * middleware, because signing up must work without any prior device session.
 *
 * Every endpoint validates on the server, all streak math happens here, and
 * admin endpoints are role-gated by requireSiteAdmin.
 */

export const siteApi = Router();
siteApi.use(attachSiteUser);

function toPublicUser(user: ReturnType<typeof siteStore.getUser>): SiteUserPublic {
  if (!user) throw new HttpError(401, "permission_denied", "You need to sign in first.", "Sign in and try again.");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    prefs: user.prefs,
    status: user.status,
  };
}

// --- stricter limiter for auth + form endpoints -------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();

function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = `site-auth:${req.ip ?? "anon"}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.site.authRateLimit.windowMs });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > config.site.authRateLimit.max) {
    res.status(429).json({
      error: {
        category: "rate_limited",
        message: "Too many attempts in a short time.",
        nextAction: "Wait a few minutes and try again.",
      },
    });
    return;
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, config.site.authRateLimit.windowMs).unref();

// --- auth -----------------------------------------------------------------------

siteApi.post(
  "/auth/signup",
  authRateLimit,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = assertName(body.name);
    const email = assertEmail(body.email);
    const password = assertPassword(body.password);

    if (siteStore.findUserByEmail(email)) {
      throw new HttpError(409, "invalid_input", "An account with that email already exists.", "Sign in instead, or reset your password.");
    }
    const { hash, salt } = hashPassword(password);
    const user = siteStore.createUser({
      id: newId("usr"),
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: config.site.adminEmails.has(email) ? "admin" : "user",
      // Email verification turns on with the transactional email provider; the
      // account is fully usable meanwhile and the flag is surfaced honestly.
      emailVerified: false,
      status: "active",
      prefs: { streakReminders: true, marketing: false },
      createdAt: new Date().toISOString(),
    });
    const token = newSessionToken();
    siteStore.createSession(token, user.id, 30 * 24 * 3600_000);
    setSessionCookie(res, token);
    res.status(201).json({ user: toPublicUser(user) });
  }),
);

siteApi.post(
  "/auth/signin",
  authRateLimit,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = assertEmail(body.email);
    if (typeof body.password !== "string" || body.password.length === 0) {
      throw badRequest("A password is required.", "Enter your password.");
    }
    const user = siteStore.findUserByEmail(email);
    if (!user || !verifyPassword(body.password, user.passwordSalt, user.passwordHash)) {
      // One message for both cases: never reveal whether an email is registered.
      throw new HttpError(401, "permission_denied", "That email and password don't match.", "Try again, or reset your password.");
    }
    const token = newSessionToken();
    siteStore.createSession(token, user.id, 30 * 24 * 3600_000);
    setSessionCookie(res, token);
    res.json({ user: toPublicUser(user) });
  }),
);

siteApi.post(
  "/auth/signout",
  handler(async (req, res) => {
    if (req.siteSessionToken) siteStore.deleteSession(req.siteSessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

/**
 * Password reset, honestly implemented for this stage: the request is stored
 * as a support item and verified manually while the transactional email
 * provider is being connected. The response never reveals whether the email
 * exists.
 */
siteApi.post(
  "/auth/forgot-password",
  authRateLimit,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = assertEmail(body.email);
    const user = siteStore.findUserByEmail(email);
    if (user) {
      siteStore.addAccountRequest({
        userId: user.id,
        email: user.email,
        reason: `Password reset requested via the website (requested for ${email}).`,
        createdAt: new Date().toISOString(),
        kind: "password_reset",
      });
    }
    res.json({ ok: true });
  }),
);

// --- current user -----------------------------------------------------------------

siteApi.get(
  "/me",
  handler(async (req, res) => {
    const user = req.siteUser;
    res.json({ user: user ? toPublicUser(user) : null });
  }),
);

siteApi.patch(
  "/me",
  handler(async (req, res) => {
    const user = siteUserOf(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Parameters<typeof siteStore.updateUser>[1] = {};
    if (body.name !== undefined) patch.name = assertName(body.name);
    if (body.prefs !== undefined) {
      const prefs = (body.prefs ?? {}) as Record<string, unknown>;
      patch.prefs = {
        streakReminders: Boolean(prefs.streakReminders),
        marketing: Boolean(prefs.marketing),
      };
    }
    res.json({ user: toPublicUser(siteStore.updateUser(user.id, patch)) });
  }),
);

siteApi.post(
  "/account/delete-request",
  handler(async (req, res) => {
    const user = siteUserOf(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = assertText(body.reason, "Reason", 2000, false);
    siteStore.addAccountRequest({
      userId: user.id,
      email: user.email,
      reason: reason || "No reason given.",
      createdAt: new Date().toISOString(),
      kind: "deletion",
    });
    siteStore.updateUser(user.id, { status: "deletion_requested" });
    res.json({ ok: true });
  }),
);

// --- style streak --------------------------------------------------------------------

siteApi.get(
  "/streak",
  handler(async (req, res) => {
    const user = req.siteUser;
    if (!user) {
      // Public pages render the labelled demo state when nobody is signed in.
      res.json({ streak: null });
      return;
    }
    res.json({ streak: computeStreak(siteStore.getCheckins(user.id)) });
  }),
);

siteApi.post(
  "/checkin",
  handler(async (req, res) => {
    const user = siteUserOf(req);
    if (user.status === "deletion_requested") {
      throw new HttpError(403, "permission_denied", "This account has a pending deletion request.", "Contact support to restore it first.");
    }
    const { added } = siteStore.addCheckin(user.id, istDayKey());
    const streak = computeStreak(siteStore.getCheckins(user.id));
    res.json({ streak, alreadyDone: !added });
  }),
);

// --- plans and waitlist -----------------------------------------------------------------

siteApi.get(
  "/plans",
  handler(async (_req, res) => {
    res.json({ plans: siteStore.getPlans() });
  }),
);

siteApi.post(
  "/waitlist",
  authRateLimit,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = assertEmail(body.email);
    const plan = body.plan;
    const cycle = body.cycle;
    if (typeof plan !== "string" || !(PLAN_TIERS as readonly string[]).includes(plan)) {
      throw badRequest("Choose a plan.", "Pick Starter, Plus, or VIP.");
    }
    if (cycle !== "monthly" && cycle !== "annual") {
      throw badRequest("Choose a billing cycle.", "Pick monthly or annual.");
    }
    siteStore.addWaitlistEntry({
      id: newId("wl"),
      email,
      plan: plan as PlanTier,
      cycle: cycle as MembershipCycle,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  }),
);

// --- contact messages -----------------------------------------------------------------

siteApi.post(
  "/contact",
  authRateLimit,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = {
      id: newId("msg"),
      name: assertName(body.name),
      email: assertEmail(body.email),
      topic: assertText(body.topic, "Topic", 80),
      message: assertText(body.message, "Message", 4000),
      handled: false,
      createdAt: new Date().toISOString(),
    };
    siteStore.createMessage(message);
    res.status(201).json({ ok: true, id: message.id });
  }),
);

// --- partner applications ----------------------------------------------------------------

const PHONE_MIN_DIGITS = 10;

siteApi.post(
  "/partner-applications",
  authRateLimit,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const types = Array.isArray(body.partnershipTypes)
      ? body.partnershipTypes.filter((t): t is string => typeof t === "string" && (PARTNERSHIP_TYPES as readonly string[]).includes(t))
      : [];
    if (types.length === 0) throw badRequest("Choose at least one partnership type.", "Select what you have in mind.");
    if (body.consent !== true) throw badRequest("We need your consent to process this application.", "Accept the privacy notice.");
    const digits = assertText(body.phone, "Phone number", 20).replace(/\D/g, "");
    if (digits.length < PHONE_MIN_DIGITS) throw badRequest("That phone number looks too short.", "Check it and try again.");

    const now = new Date().toISOString();
    const application: PartnerApplication = {
      id: newId("par"),
      businessName: assertText(body.businessName, "Business name", 120),
      contactName: assertText(body.contactName, "Contact name", 120),
      email: assertEmail(body.email),
      phone: assertText(body.phone, "Phone number", 20),
      website: assertText(body.website, "Website or Instagram URL", 300),
      category: assertText(body.category, "Brand category", 80),
      city: assertText(body.city, "City", 80),
      catalogueSize: assertText(body.catalogueSize, "Catalogue size", 80, false),
      partnershipTypes: types,
      proposedOffer: assertText(body.proposedOffer, "Proposed offer", 1000, false),
      notes: assertText(body.notes, "Additional information", 2000, false),
      consent: true,
      status: "new",
      agreementSigned: false,
      createdAt: now,
      updatedAt: now,
    };
    siteStore.createPartnerApplication(application);
    res.status(201).json({ ok: true, id: application.id });
  }),
);

// --- admin ---------------------------------------------------------------------------------

function adminOverview(): AdminOverview {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600_000;
  const users = siteStore.listUsers();
  const checkins = siteStore.allCheckins();
  const today = istDayKey();
  const partners = siteStore.listPartnerApplications();
  const messages = siteStore.listMessages();

  let checkinsToday = 0;
  let checkinsTotal = 0;
  let activeStreaks = 0;
  let completedChallenges = 0;
  for (const days of Object.values(checkins)) {
    checkinsTotal += days.length;
    if (days.includes(today)) checkinsToday += 1;
    const streak = computeStreak(days);
    if (streak.currentStreak >= 2) activeStreaks += 1;
    if (streak.status === "completed") completedChallenges += 1;
  }

  const byTier: AdminOverview["byTier"] = { starter: 0, plus: 0, vip: 0 };

  return {
    totals: {
      users: users.length,
      newUsers7d: users.filter((user) => new Date(user.createdAt).getTime() > weekAgo).length,
      checkinsToday,
      checkinsTotal,
      activeStreaks,
      completedChallenges,
      subscribers: 0,
      partnerApplications: partners.length,
      newPartnerApplications: partners.filter((app) => app.status === "new").length,
      contactMessages: messages.length,
      unhandledContactMessages: messages.filter((message) => !message.handled).length,
      waitlist: siteStore.listWaitlist().length,
    },
    byTier,
    plans: siteStore.getPlans(),
    payments: {
      gatewayConnected: false,
      mrrRupees: 0,
      annualSalesRupees: 0,
      cancellations: 0,
    },
  };
}

siteApi.get(
  "/admin/overview",
  requireSiteAdmin,
  handler(async (_req, res) => {
    res.json(adminOverview());
  }),
);

siteApi.get(
  "/admin/users",
  requireSiteAdmin,
  handler(async (_req, res) => {
    const users = siteStore.listUsers().map((user) => {
      const days = siteStore.getCheckins(user.id);
      return {
        ...toPublicUser(user),
        checkinDays: days.length,
        currentStreak: computeStreak(days).currentStreak,
        deletionRequested: user.status === "deletion_requested",
      };
    });
    res.json({ users });
  }),
);

siteApi.get(
  "/admin/partners",
  requireSiteAdmin,
  handler(async (_req, res) => {
    res.json({ applications: siteStore.listPartnerApplications() });
  }),
);

siteApi.patch(
  "/admin/partners/:id",
  requireSiteAdmin,
  handler(async (req, res) => {
    const id = String(req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<PartnerApplication> = {};
    if (body.status !== undefined) {
      const allowed: PartnerApplication["status"][] = ["new", "reviewing", "info_requested", "approved", "rejected"];
      if (typeof body.status !== "string" || !allowed.includes(body.status as PartnerApplication["status"])) {
        throw badRequest("That status isn't valid.", "Pick one of the listed statuses.");
      }
      patch.status = body.status as PartnerApplication["status"];
    }
    if (body.agreementSigned !== undefined) patch.agreementSigned = Boolean(body.agreementSigned);
    const application = siteStore.updatePartnerApplication(id, patch);
    if (!application) throw new HttpError(404, "not_found", "That application no longer exists.", "Refresh the list.");
    res.json({ application });
  }),
);

siteApi.get(
  "/admin/messages",
  requireSiteAdmin,
  handler(async (_req, res) => {
    res.json({ messages: siteStore.listMessages() });
  }),
);

siteApi.patch(
  "/admin/messages/:id",
  requireSiteAdmin,
  handler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = siteStore.updateMessage(String(req.params.id), Boolean(body.handled));
    if (!message) throw new HttpError(404, "not_found", "That message no longer exists.", "Refresh the list.");
    res.json({ message });
  }),
);

siteApi.get(
  "/admin/waitlist",
  requireSiteAdmin,
  handler(async (_req, res) => {
    res.json({ entries: siteStore.listWaitlist() });
  }),
);

siteApi.patch(
  "/admin/plans/:tier",
  requireSiteAdmin,
  handler(async (req, res) => {
    const tier = String(req.params.tier);
    if (!(PLAN_TIERS as readonly string[]).includes(tier)) throw badRequest("Unknown plan.", "Pick Starter, Plus, or VIP.");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Parameters<typeof siteStore.updatePlan>[1] = {};
    for (const key of ["monthly", "annual"] as const) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isInteger(value) || value < 1 || value > 10_000_000) {
          throw badRequest("Prices must be whole rupees.", "Enter a realistic whole-rupee price.");
        }
        patch[key] = value;
      }
    }
    if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
    if (body.tagline !== undefined) patch.tagline = assertText(body.tagline, "Tagline", 120);
    res.json({ plans: siteStore.updatePlan(tier as PlanTier, patch) });
  }),
);

// --- admin: account requests (deletion + password-reset support queue) -----------

siteApi.get(
  "/admin/account-requests",
  requireSiteAdmin,
  handler(async (_req, res) => {
    res.json({ requests: siteStore.listAccountRequests() });
  }),
);
