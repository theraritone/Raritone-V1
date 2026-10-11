import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { SiteUser } from "./siteStore.js";
import { siteStore } from "./siteStore.js";
import { badRequest, HttpError } from "./http.js";
import { config } from "../env.js";

/**
 * Server-side authentication for raritone.com: scrypt password hashing,
 * random bearer session tokens in httpOnly cookies, and role checks for the
 * admin dashboard. No plain-text passwords ever exist beyond the request that
 * created them.
 */

const SESSION_COOKIE = "rt_site";
const SESSION_TTL_MS = 30 * 24 * 3600_000;

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function serializeCookie(token: string, maxAgeSeconds: number): string {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (config.isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function setSessionCookie(res: Response, token: string): void {
  res.setHeader("set-cookie", serializeCookie(token, SESSION_TTL_MS / 1000));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("set-cookie", serializeCookie("", 0));
}

declare module "express-serve-static-core" {
  interface Request {
    siteUser?: SiteUser;
  }
}

export function siteUserOf(req: Request): SiteUser {
  if (!req.siteUser) throw new HttpError(401, "permission_denied", "You need to sign in first.", "Sign in and try again.");
  return req.siteUser;
}

export function requireSiteAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.siteUser;
  if (!user) {
    res.status(401).json({
      error: { category: "permission_denied", message: "Sign in first.", nextAction: "Sign in and try again." },
    });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({
      error: {
        category: "permission_denied",
        message: "This area is restricted to Raritone administrators.",
        nextAction: "If you believe this is wrong, contact the team.",
      },
    });
    return;
  }
  next();
}

/** Middleware: attach req.siteUser when a valid session cookie is present. */
export function attachSiteUser(req: Request, _res: Response, next: NextFunction): void {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) {
    const found = siteStore.getSession(token);
    if (found) {
      req.siteUser = found.user;
      req.siteSessionToken = token;
    }
  }
  next();
}

declare module "express-serve-static-core" {
  interface Request {
    siteSessionToken?: string;
  }
}

// --- validation helpers ------------------------------------------------------

export function assertEmail(value: unknown): string {
  if (typeof value !== "string") throw badRequest("An email address is required.", "Enter your email.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw badRequest("That email address doesn't look valid.", "Check it and try again.");
  }
  return email;
}

export function assertPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 200) {
    throw badRequest("Passwords need at least 8 characters.", "Pick a longer password.");
  }
  return value;
}

export function assertName(value: unknown, max = 80): string {
  if (typeof value !== "string") throw badRequest("A name is required.", "Enter your name.");
  const name = value.trim();
  if (name.length < 2 || name.length > max) throw badRequest(`Names need 2–${max} characters.`, "Adjust it and try again.");
  return name;
}

export function assertText(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== "string") {
    if (required) throw badRequest(`${field} is required.`, "Fill it in and try again.");
    return "";
  }
  const text = value.trim();
  if (required && text.length === 0) throw badRequest(`${field} is required.`, "Fill it in and try again.");
  if (text.length > max) throw badRequest(`${field} is too long (max ${max} characters).`, "Shorten it and try again.");
  return text;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

/** The IST calendar day, which is the unit a Style Streak counts in. */
export function istDayKey(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function shiftDay(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export interface StreakComputation {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  daysRemaining: number;
  status: "not_started" | "in_progress" | "completed" | "broken";
  today: string;
  checkedInToday: boolean;
  days: string[];
  milestones: Array<{ day: number; label: string; achieved: boolean }>;
}

const MILESTONES: Array<{ day: number; label: string }> = [
  { day: 1, label: "Start your streak" },
  { day: 7, label: "One week of style" },
  { day: 15, label: "Halfway there" },
  { day: 30, label: "Challenge complete" },
];

/**
 * Recomputes streak state from the stored day keys — always on the server,
 * never from client-claimed numbers. A streak is alive only if the newest
 * qualifying day is today or yesterday; anything older means the run broke.
 */
export function computeStreak(days: string[], now = new Date()): StreakComputation {
  const today = istDayKey(now);
  const yesterday = shiftDay(today, -1);
  const set = new Set(days);

  let currentStreak = 0;
  if (set.has(today) || set.has(yesterday)) {
    let cursor = set.has(today) ? today : yesterday;
    while (set.has(cursor)) {
      currentStreak += 1;
      cursor = shiftDay(cursor, -1);
    }
  }

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const status: StreakComputation["status"] =
    days.length === 0
      ? "not_started"
      : currentStreak >= 30
        ? "completed"
        : set.has(today) || set.has(yesterday)
          ? "in_progress"
          : "broken";

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalDays: days.length,
    daysRemaining: Math.max(0, 30 - currentStreak),
    status,
    today,
    checkedInToday: set.has(today),
    days: days.slice(-90),
    milestones: MILESTONES.map((milestone) => ({
      ...milestone,
      achieved: currentStreak >= milestone.day,
    })),
  };
}
