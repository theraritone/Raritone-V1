import { readFileSync } from "node:fs";
import type { FeatureFlags } from "../shared/types.js";

/** Load .env without a dependency. Values already in the environment win. */
function readDotEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const candidates = [".env", ".env.local"];
  for (const file of candidates) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) out[key] = value;
    }
  }
  return out;
}

const fileEnv = readDotEnv();

function env(key: string, fallback = ""): string {
  const value = process.env[key] ?? fileEnv[key];
  return value === undefined || value === "" ? fallback : value;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = (process.env[key] ?? fileEnv[key])?.toLowerCase();
  if (value === undefined || value === "") return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function envInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? fileEnv[key] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const supabaseUrl = env("VITE_SUPABASE_URL", env("SUPABASE_URL"));
const supabaseAnonKey = env("VITE_SUPABASE_ANON_KEY", env("SUPABASE_ANON_KEY"));
const supabaseServiceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const supabaseJwtSecret = env("SUPABASE_JWT_SECRET");

/**
 * Persistence is Supabase when it is fully configured, otherwise an on-disk
 * driver. Both satisfy the same repository contract, so nothing upstream of
 * `server/lib/db.ts` knows which one is live.
 */
const supabaseUsable = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceKey);

export const config = {
  env: env("NODE_ENV", "development"),
  isProduction: env("NODE_ENV", "development") === "production",

  port: envInt("PORT", 8787),
  host: env("HOST", "0.0.0.0"),

  /**
   * Optional LAN HTTPS for phone testing: mobile browsers only grant camera
   * (and crypto.randomUUID) in secure contexts, and plain http://192.168.x.x
   * is not one. Set all three to also serve the same app over TLS (a LAN
   * self-signed cert is enough; the phone bypasses the warning once).
   */
  tls: {
    port: envInt("TLS_PORT", 0),
    certPath: env("TLS_CERT_PATH", ""),
    keyPath: env("TLS_KEY_PATH", ""),
  },

  /** Absolute origin used when generating shareable links. */
  publicOrigin: env("PUBLIC_ORIGIN", ""),

  dataDir: env("DATA_DIR", ".data"),

  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceKey,
    /** Needed to mint guest sessions without a password. */
    jwtSecret: supabaseJwtSecret,
    bucketGarments: env("SUPABASE_BUCKET_GARMENTS", "garments"),
    bucketMedia: env("SUPABASE_BUCKET_MEDIA", "media"),
  },

  provider: {
    /**
     * Adapter name from the registry in `server/provider/index.ts`.
     * `live-vto` (the default) brokers real Decart sessions through the
     * raritone-live-vto backend; `mock` composites locally for offline
     * development and hermetic tests. Tokens stay server-side and never reach
     * the client — the permanent Decart key lives in the backend's own .env.
     */
    adapter: env("TRYON_PROVIDER", "live-vto"),
    baseUrl: env("TRYON_PROVIDER_BASE_URL", ""),
    apiKey: env("TRYON_PROVIDER_API_KEY", ""),
    /** FR-106: bounded sessions. */
    liveSessionSeconds: envInt("LIVE_SESSION_SECONDS", 90),
    liveMaxExtensionSeconds: envInt("LIVE_MAX_EXTENSION_SECONDS", 120),
    photoTimeoutMs: envInt("PHOTO_TIMEOUT_MS", 20_000),
    liveStartTimeoutMs: envInt("LIVE_START_TIMEOUT_MS", 12_000),
    fps: envInt("LIVE_FPS", 12),
  },

  liveVto: {
    /**
     * Base URL of the raritone-live-vto backend, which owns Decart session
     * creation, heartbeats and teardown. The PWA never talks to Decart
     * directly. When this backend is unreachable, try-on start fails with a
     * clear "unavailable" error instead of a fake preview.
     */
    baseUrl: env("LIVE_VTO_BASE_URL", "http://127.0.0.1:4000"),
  },

  cost: {
    /** FR-703: global guard, in cents. Stops new work before exceeding it. */
    globalCapCents: envInt("COST_CAP_CENTS", 500),
    photoCents: envInt("COST_PHOTO_CENTS", 2),
    liveCentsPerSecond: envInt("COST_LIVE_CENTS_PER_SECOND", 1),
  },

  guest: {
    /** D-04: one successful try-on for a guest. */
    photoAllowance: envInt("GUEST_PHOTO_ALLOWANCE", 1),
    liveSecondsAllowance: envInt("GUEST_LIVE_SECONDS", 30),
  },

  free: {
    photoAllowance: envInt("FREE_PHOTO_ALLOWANCE", 10),
    liveSecondsAllowance: envInt("FREE_LIVE_SECONDS", 300),
  },

  usageWindowHours: envInt("USAGE_WINDOW_HOURS", 168),

  linkImport: {
    /** PRD: protect server-side fetches against internal-network access. */
    allowedSchemes: ["http:", "https:"] as const,
    timeoutMs: envInt("LINK_FETCH_TIMEOUT_MS", 8000),
    maxBytes: envInt("LINK_MAX_BYTES", 3_000_000),
    maxRedirects: envInt("LINK_MAX_REDIRECTS", 4),
  },

  /**
   * Feature flags before beta (AGENTS.md). `stories` is deliberately OFF: the
   * PRD scopes 24-hour stories to "Could have" and lists a stories feed as an
   * R1 non-goal, so the surface exists but never ships enabled by default.
   */
  flags: {
    liveTryOn: envBool("FLAG_LIVE_TRYON", true),
    clipCapture: envBool("FLAG_CLIP_CAPTURE", true),
    stories: envBool("FLAG_STORIES", false),
    linkImport: envBool("FLAG_LINK_IMPORT", true),
    wardrobeUpload: envBool("FLAG_WARDROBE_UPLOAD", true),
  } satisfies FeatureFlags,

  /** PRD FR-702: a provider can be disabled without releasing a new client. */
  providerKillSwitch: envBool("PROVIDER_KILL_SWITCH", false),

  rateLimit: {
    windowMs: envInt("RATE_LIMIT_WINDOW_MS", 60_000),
    max: envInt("RATE_LIMIT_MAX", 120),
  },

  site: {
    /**
     * Comma-separated emails that are promoted to the administrator role when
     * they sign up on raritone.com. Without this, every site account is a
     * normal user and the admin API always answers 403.
     */
    adminEmails: new Set(
      env("SITE_ADMIN_EMAILS")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
    /** Auth endpoints get a stricter limiter than general API traffic. */
    authRateLimit: { windowMs: envInt("SITE_AUTH_RATE_WINDOW_MS", 600_000), max: envInt("SITE_AUTH_RATE_MAX", 20) },
  },

  get storageDriver(): "supabase" | "local" {
    return supabaseUsable ? "supabase" : "local";
  },

  get supabaseUsable(): boolean {
    return supabaseUsable;
  },
} as const;

export type AppConfig = typeof config;
