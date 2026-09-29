/**
 * Domain contract shared by the PWA client and the orchestration server.
 * Mirrors `server/supabase/schema.sql`; keep the two in step.
 */

export const GARMENT_CATEGORIES = [
  "tops",
  "jackets",
  "outerwear",
  "bottoms",
  "dresses",
  "accessories",
  "shoes",
] as const;
export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

/**
 * Release 1 try-on covers upper-body garments only. Everything else can still be
 * saved to the wardrobe — it is just honestly marked as having no try-on yet,
 * which is what `LAUNCH_CATEGORIES` drives.
 */
export const LAUNCH_CATEGORIES = ["tops", "jackets", "outerwear"] as const satisfies readonly GarmentCategory[];
export type LaunchCategory = (typeof LAUNCH_CATEGORIES)[number];

export function isLaunchCategory(category: GarmentCategory): category is LaunchCategory {
  return (LAUNCH_CATEGORIES as readonly string[]).includes(category);
}

/** A stable account identifier. Guests get one minted from their device id. */
export type UserId = string;

export const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tops: "Tops",
  jackets: "Jackets",
  outerwear: "Outerwear",
  bottoms: "Bottoms",
  dresses: "Dresses",
  accessories: "Accessories",
  shoes: "Shoes",
};

/** The wardrobe filters shown in Release 1, in carousel order. */
export const WARDROBE_FILTERS = [
  "all",
  "tops",
  "jackets",
  "outerwear",
  "bottoms",
  "dresses",
  "accessories",
  "shoes",
] as const;
export type WardrobeFilter = (typeof WARDROBE_FILTERS)[number];

export const WARDROBE_FILTER_LABEL: Record<WardrobeFilter, string> = {
  all: "All",
  tops: "Tops",
  jackets: "Jackets",
  outerwear: "Outerwear",
  bottoms: "Bottoms",
  dresses: "Dresses",
  accessories: "Accessories",
  shoes: "Shoes",
};

/**
 * PRD "Quality states are visible". `ready` is the only state that may start
 * live generation; `experimental` is photo-mode only.
 */
export const QUALITY_STATES = [
  "ready",
  "experimental",
  "needs_review",
  "unsupported",
] as const;
export type QualityState = (typeof QUALITY_STATES)[number];

export const QUALITY_LABEL: Record<QualityState, string> = {
  ready: "Ready",
  experimental: "Experimental",
  needs_review: "Needs review",
  unsupported: "Unsupported",
};

export const QUALITY_HINT: Record<QualityState, string> = {
  ready: "Passed category and input quality checks.",
  experimental: "Try-on works, but the preview may be less stable.",
  needs_review: "Adjust the crop, category, or source image to continue.",
  unsupported: "No try-on for this item yet. You can still keep it saved.",
};

export const OWNERSHIP_STATES = [
  "owned",
  "considering",
  "inspiration",
  "archived",
] as const;
export type OwnershipState = (typeof OWNERSHIP_STATES)[number];

export const OWNERSHIP_LABEL: Record<OwnershipState, string> = {
  owned: "Owned",
  considering: "Considering",
  inspiration: "Saved inspiration",
  archived: "Archived",
};

export const SOURCE_TYPES = ["sample", "upload", "camera_photo", "link"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABEL: Record<SourceType, string> = {
  sample: "Raritone sample",
  upload: "Uploaded",
  camera_photo: "Camera photo",
  link: "Product link",
};

/** PRD FR-104: the UI must never let a user confuse these. */
export type TryOnMode = "live" | "photo";
export type SessionPhase =
  | "idle"
  | "checking"
  | "connecting"
  | "ready"
  | "switching"
  | "reconnecting"
  | "error"
  | "ended";

export type ErrorCategory =
  | "not_found"
  | "invalid_input"
  | "permission_denied"
  | "device_unsupported"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_error"
  | "policy_blocked"
  | "allowance_exceeded"
  | "cost_cap"
  | "upstream_link"
  | "rate_limited"
  | "internal";

export interface ApiErrorBody {
  error: {
    category: ErrorCategory;
    message: string;
    /** What the user can do next, in plain language. */
    nextAction?: string;
    /** True when retrying will not consume a second allowance. */
    retryIsFree?: boolean;
    traceId?: string;
  };
}

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  category: GarmentCategory;
  source: SourceType;
  qualityState: QualityState;
  ownership: OwnershipState;
  /** PRD FR-207: provenance, kept separate from the garment itself. */
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  isFavorite: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  tryOnCount: number;
}

export interface Look {
  id: string;
  userId: string;
  itemId: string | null;
  imageUrl: string;
  kind: "photo" | "clip";
  /** Mandatory AI disclosure, stamped server-side. */
  aiLabel: string;
  createdAt: string;
  isFavorite: boolean;
}

export interface Story {
  id: string;
  userId: string;
  imageUrl: string;
  /** ISO timestamp; the server enforces the 24h window. */
  expiresAt: string;
  createdAt: string;
  aiLabel: string;
}

export interface ShareLink {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface UsageLedger {
  /** Remaining photo try-ons in the current window. */
  photoRemaining: number;
  photoAllowance: number;
  /** Remaining live session seconds. */
  liveSecondsRemaining: number;
  liveSecondsAllowance: number;
  windowResetsAt: string;
  /** AGENTS.md: guests get exactly one successful try-on (D-04). */
  guestTryOnConsumed: boolean;
  costCapCents: number;
  costSpentCents: number;
}

export interface SessionProfile {
  userId: string;
  deviceId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  isGuest: boolean;
  createdAt: string;
  storageDriver: "supabase" | "local";
}

export interface LinkImportPreview {
  canonicalUrl: string;
  siteName: string;
  productName: string;
  imageUrl: string;
  /** Every candidate we found, so the user can pick (FR-203). */
  candidates: { imageUrl: string; label: string }[];
  suggestedCategory: GarmentCategory;
  qualityState: QualityState;
}

export interface LinkImportFailure {
  category: ErrorCategory;
  message: string;
  nextAction: string;
  /** The URL is preserved so the user is not asked to retype it. */
  attemptedUrl: string;
}

export interface TryOnFrame {
  /** Data URL or object/media URL of the composited AI preview. */
  imageUrl: string;
  frameIndex: number;
  generatedAt: string;
  qualitySignals: {
    identityStable: boolean;
    garmentStable: boolean;
    lowConfidence: boolean;
  };
}

export interface LiveSessionState {
  sessionId: string;
  mode: "live";
  phase: SessionPhase;
  providerClass: string;
  garmentItemId: string;
  startedAt: string;
  expiresAt: string;
  fps: number;
  frameCount: number;
}

export interface PhotoJobState {
  jobId: string;
  mode: "photo";
  phase: "queued" | "processing" | "ready" | "failed" | "blocked";
  progress: number;
  stage: string;
  resultUrl?: string;
  qualityState?: QualityState;
  error?: { category: ErrorCategory; message: string; nextAction: string; retryIsFree: boolean };
  createdAt: string;
}

export interface FeatureFlags {
  liveTryOn: boolean;
  clipCapture: boolean;
  stories: boolean;
  linkImport: boolean;
  wardrobeUpload: boolean;
}

export interface ReadinessCheck {
  ok: boolean;
  /** Exactly one correction at a time, per the PRD's poor-framing copy. */
  code:
    | "ok"
    | "no_person"
    | "too_close"
    | "too_dark"
    | "landscape"
    | "multiple_people"
    | "device_unsupported";
  message: string;
  nextAction: string;
}

export interface GarmentAssetInput {
  itemId: string;
  imageUrl: string;
  category: GarmentCategory;
  qualityState: QualityState;
}

export interface ApiBootstrap {
  session: SessionProfile;
  flags: FeatureFlags;
  usage: UsageLedger;
  storageDriver: "supabase" | "local";
  tryOn: {
    liveAvailable: boolean;
    photoAvailable: boolean;
    providerClass: string;
    /**
     * "browser" = the provider's video is rendered here, in the guest's own
     * WebRTC connection, so no frame ever travels through our server. "server"
     * = the provider composites frames that we poll back. The camera screen
     * needs to know which before it starts, because only one of them is real.
     */
    renderMode: "browser" | "server";
  };
  /**
   * The starter carousel, already seeded. It arrives with bootstrap so the
   * camera screen has something to select on the very first frame — there is no
   * empty state between opening the app and the camera being usable.
   */
  items: WardrobeItem[];
}

export interface ProfileStats {
  tryOnsThisWeek: number;
  wardrobeCount: number;
  favoritesCount: number;
  dayStreak: number;
  looksThisWeek: number;
}
