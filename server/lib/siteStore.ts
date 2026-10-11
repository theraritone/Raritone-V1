import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultPlans,
  type ContactMessage,
  type PartnerApplication,
  type PlanConfig,
  type PlanTier,
  type WaitlistEntry,
} from "../../shared/site.js";
import { config } from "../env.js";

/**
 * Persistence for the raritone.com surface: site accounts, sessions, verified
 * Style Streak check-ins, partner applications, contact messages, the
 * membership waitlist, and the plan configuration the admin dashboard edits.
 *
 * Same storage philosophy as the PWA's local driver — JSON under DATA_DIR,
 * writes serialised through a promise chain so a burst of requests cannot
 * interleave and truncate the file. Single-process safety here stands in for
 * the database unique constraints a multi-node deployment needs; that migration
 * is documented in the README.
 */

export interface SiteUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: "user" | "admin";
  emailVerified: boolean;
  status: "active" | "deletion_requested";
  prefs: { streakReminders: boolean; marketing: boolean };
  createdAt: string;
}

export interface SiteSession {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface SiteDb {
  users: Record<string, SiteUser>;
  emailIndex: Record<string, string>;
  sessions: Record<string, SiteSession>;
  /** userId -> sorted array of IST day keys (YYYY-MM-DD). */
  checkins: Record<string, string[]>;
  /** userId -> array of reset requests from users, newest last. */
  accountRequests: Array<{ userId: string; reason: string; createdAt: string; kind: "deletion" | "password_reset"; email: string }>;
  partnerApps: Record<string, PartnerApplication>;
  messages: Record<string, ContactMessage>;
  waitlist: Record<string, WaitlistEntry>;
  plans: Record<PlanTier, PlanConfig>;
}

const EMPTY: SiteDb = {
  users: {},
  emailIndex: {},
  sessions: {},
  checkins: {},
  accountRequests: [],
  partnerApps: {},
  messages: {},
  waitlist: {},
  plans: defaultPlans(),
};

const root = resolve(process.cwd(), config.dataDir);
const dbFile = resolve(root, "site-db.json");

let cache: SiteDb | null = null;
let writeChain: Promise<void> = Promise.resolve();

function load(): SiteDb {
  if (cache) return cache;
  mkdirSync(root, { recursive: true });
  if (!existsSync(dbFile)) {
    cache = structuredClone(EMPTY);
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(dbFile, "utf8")) as Partial<SiteDb>;
    cache = {
      ...structuredClone(EMPTY),
      ...parsed,
      plans: { ...defaultPlans(), ...(parsed.plans ?? {}) },
    };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

function persist(): void {
  const snapshot = JSON.stringify(load(), null, 2);
  writeChain = writeChain.then(() => {
    mkdirSync(root, { recursive: true });
    writeFileSync(dbFile, snapshot, "utf8");
  });
}

export const siteStore = {
  // --- users ---------------------------------------------------------------

  findUserByEmail(email: string): SiteUser | null {
    const id = load().emailIndex[email.toLowerCase()];
    return id ? (load().users[id] ?? null) : null;
  },

  getUser(userId: string): SiteUser | null {
    return load().users[userId] ?? null;
  },

  createUser(user: SiteUser): SiteUser {
    const db = load();
    db.users[user.id] = user;
    db.emailIndex[user.email.toLowerCase()] = user.id;
    persist();
    return user;
  },

  updateUser(userId: string, patch: Partial<Pick<SiteUser, "name" | "prefs" | "status">>): SiteUser | null {
    const db = load();
    const existing = db.users[userId];
    if (!existing) return null;
    const next: SiteUser = { ...existing, ...patch };
    db.users[userId] = next;
    persist();
    return next;
  },

  listUsers(): SiteUser[] {
    return Object.values(load().users).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  // --- sessions --------------------------------------------------------------

  createSession(token: string, userId: string, ttlMs: number): void {
    load().sessions[token] = {
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
    persist();
  },

  getSession(token: string): { session: SiteSession; user: SiteUser } | null {
    const db = load();
    const session = db.sessions[token];
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      delete db.sessions[token];
      persist();
      return null;
    }
    const user = db.users[session.userId];
    if (!user) return null;
    return { session, user };
  },

  deleteSession(token: string): void {
    delete load().sessions[token];
    persist();
  },

  // --- style streak check-ins -------------------------------------------------

  /**
   * Records a qualifying check-in for `dayKey` (an IST calendar day). The key
   * is unique per user — a second insert for the same day returns `added:
   * false`, which is the single-process stand-in for the database unique
   * constraint described in the README.
   */
  addCheckin(userId: string, dayKey: string): { added: boolean } {
    const db = load();
    const days = (db.checkins[userId] ??= []);
    if (days.includes(dayKey)) return { added: false };
    days.push(dayKey);
    days.sort();
    persist();
    return { added: true };
  },

  getCheckins(userId: string): string[] {
    return load().checkins[userId] ?? [];
  },

  allCheckins(): Record<string, string[]> {
    return load().checkins;
  },

  // --- account requests ---------------------------------------------------------

  addAccountRequest(entry: SiteDb["accountRequests"][number]): void {
    load().accountRequests.push(entry);
    persist();
  },

  listAccountRequests(): SiteDb["accountRequests"] {
    return [...load().accountRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // --- partner applications -------------------------------------------------------

  createPartnerApplication(app: PartnerApplication): void {
    load().partnerApps[app.id] = app;
    persist();
  },

  getPartnerApplication(id: string): PartnerApplication | null {
    return load().partnerApps[id] ?? null;
  },

  updatePartnerApplication(id: string, patch: Partial<PartnerApplication>): PartnerApplication | null {
    const db = load();
    const existing = db.partnerApps[id];
    if (!existing) return null;
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    db.partnerApps[id] = next;
    persist();
    return next;
  },

  listPartnerApplications(): PartnerApplication[] {
    return Object.values(load().partnerApps).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // --- contact messages ---------------------------------------------------------------

  createMessage(message: ContactMessage): void {
    load().messages[message.id] = message;
    persist();
  },

  getMessage(id: string): ContactMessage | null {
    return load().messages[id] ?? null;
  },

  updateMessage(id: string, handled: boolean): ContactMessage | null {
    const db = load();
    const existing = db.messages[id];
    if (!existing) return null;
    const next = { ...existing, handled };
    db.messages[id] = next;
    persist();
    return next;
  },

  listMessages(): ContactMessage[] {
    return Object.values(load().messages).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // --- waitlist -------------------------------------------------------------------------

  addWaitlistEntry(entry: WaitlistEntry): { added: boolean } {
    const db = load();
    const existing = Object.values(db.waitlist).find((item) => item.email === entry.email && item.plan === entry.plan);
    if (existing) return { added: false };
    db.waitlist[entry.id] = entry;
    persist();
    return { added: true };
  },

  listWaitlist(): WaitlistEntry[] {
    return Object.values(load().waitlist).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // --- plan configuration ----------------------------------------------------------------

  getPlans(): Record<PlanTier, PlanConfig> {
    return load().plans;
  },

  updatePlan(tier: PlanTier, patch: Partial<Omit<PlanConfig, "label" | "updatedAt">>): Record<PlanTier, PlanConfig> {
    const db = load();
    db.plans[tier] = { ...db.plans[tier], ...patch, updatedAt: new Date().toISOString() };
    persist();
    return db.plans;
  },
};

/** Used by tests and the smoke check to start from a clean slate. */
export function resetSiteStoreForTests(): void {
  cache = structuredClone(EMPTY);
}
