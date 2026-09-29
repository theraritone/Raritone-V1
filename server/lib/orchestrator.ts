import type {
  ApiBootstrap,
  FeatureFlags,
  GarmentAssetInput,
  QualityState,
  UserId,
  WardrobeItem,
} from "../../shared/types.js";
import { config } from "../env.js";
import { activeProvider } from "../provider/index.js";
import { ProviderFailure, type LiveSessionHandle, type PhotoJobHandle, type TryOnFrame } from "../provider/types.js";
import { repo } from "./db.js";
import { HttpError } from "./http.js";

/**
 * In-memory orchestration state for live sessions and photo jobs.
 *
 * Provider handles never touch the database and never leave the process. A
 * single-process store is correct for Release 1; a Redis-backed store with the
 * same interface is the swap once there is more than one instance.
 */
interface LiveRecord {
  handle: LiveSessionHandle;
  userId: UserId;
  garment: GarmentAssetInput;
  /** Last frame index handed to a client, so polling is cheap and idempotent. */
  lastFrame: TryOnFrame | null;
  frameProducedAt: number;
  /** Wall-clock seconds of provider compute, for the cost ledger. */
  chargedSeconds: number;
  createdAt: number;
  /**
   * True when the guest's own browser renders the provider's pixels (WebRTC),
   * so this process never holds a frame and meters by elapsed time instead.
   */
  browser: boolean;
}

interface PhotoRecord {
  handle: PhotoJobHandle;
  userId: UserId;
  garment: GarmentAssetInput;
  /** Set once we have taken money for this job. */
  billed: boolean;
  startedAt: number;
  lastResult: string | null;
}

const liveSessions = new Map<string, LiveRecord>();
const photoJobs = new Map<string, PhotoRecord>();
const FRAME_INTERVAL_MS = 900;

export interface StartLiveArgs {
  userId: UserId;
  person: { frameDataUrl: string; width: number; height: number; capturedAt: number };
  garment: GarmentAssetInput;
  clientToken: string;
  networkMbps: number | null;
}

export async function startLiveSession(args: StartLiveArgs): Promise<{
  sessionId: string;
  providerClass: string;
  garment: GarmentAssetInput;
  /** Null only for browser-rendered sessions, which have no server-visible frame. */
  frame: TryOnFrame | null;
  expiresAt: string;
  fps: number;
  maxSeconds: number;
  /** Short-lived SDK credentials, present only for browser-rendered sessions. */
  browser?: { clientToken: string; modelId: string | null };
}> {
  const provider = activeProvider();
  if (!provider.capabilities.live || !config.flags.liveTryOn) {
    throw new HttpError(
      503,
      "device_unsupported",
      "Live try-on is not available on this device or is switched off.",
      "Use photo preview instead — it works the same way.",
      true,
    );
  }

  const eligibility = provider.eligibility(args.garment);
  if (!eligibility.allowsLive) {
    throw new HttpError(
      422,
      eligibility.qualityState === "unsupported" ? "policy_blocked" : "invalid_input",
      eligibility.reason,
      eligibility.qualityState === "unsupported"
        ? "Pick an upper-body garment to try on live."
        : "Fix this item, or use a photo preview.",
      true,
    );
  }

  const usage = await repo.readUsage(args.userId);
  if (usage.liveSecondsRemaining <= 0) {
    throw new HttpError(
      402,
      "allowance_exceeded",
      "You have used your live try-on time for now.",
      "Photo preview still works, or your live time resets when the window does.",
      false,
    );
  }
  await assertUnderGlobalCap();

  const maxSeconds = Math.min(
    config.provider.liveSessionSeconds,
    usage.liveSecondsRemaining,
  );

  const handle = await provider
    .startLive({
      userId: args.userId,
      person: args.person,
      garment: args.garment,
      maxSeconds,
      networkMbps: args.networkMbps,
      clientToken: args.clientToken,
    })
    .catch(mapProviderFailure);

  if (!provider.capabilities.serverFrames) {
    // Realtime providers render in the guest's own browser: person pixels
    // travel browser-to-model over WebRTC and never pass through this server,
    // so there is no frame object to hand back. The session stays open so the
    // client can connect with the short-lived token, switch garments on it, and
    // end it — ending is what records duration and cost. There is no stand-in
    // frame here by design: a fabricated image would be a fake try-on.
    const sessionId = handle.providerSessionId;
    const clientToken =
      typeof handle.internals?.clientToken === "string" ? handle.internals.clientToken : "";
    if (!clientToken) {
      await provider.endLive(handle, "missing_client_token").catch(() => undefined);
      throw new HttpError(
        503,
        "provider_unavailable",
        "Try-on unavailable — check your connection.",
        "Check your connection and try again.",
        true,
      );
    }
    liveSessions.set(sessionId, {
      handle,
      userId: args.userId,
      garment: args.garment,
      lastFrame: null,
      frameProducedAt: Date.now(),
      chargedSeconds: 0,
      createdAt: Date.now(),
      browser: true,
    });
    return {
      sessionId,
      providerClass: provider.providerClass,
      garment: args.garment,
      frame: null,
      expiresAt: new Date(handle.expiresAt).toISOString(),
      fps: config.provider.fps,
      maxSeconds,
      browser: {
        clientToken,
        modelId: typeof handle.internals?.modelId === "string" ? handle.internals.modelId : null,
      },
    };
  }

  const first = await provider.nextLiveFrame(handle);
  const frame: TryOnFrame = first ?? {
    imageUrl: args.person.frameDataUrl,
    frameIndex: 0,
    generatedAt: new Date().toISOString(),
    qualitySignals: { identityStable: true, garmentStable: false, lowConfidence: true },
  };

  const sessionId = handle.providerSessionId;
  liveSessions.set(sessionId, {
    handle,
    userId: args.userId,
    garment: args.garment,
    lastFrame: frame,
    frameProducedAt: Date.now(),
    chargedSeconds: 0,
    createdAt: Date.now(),
    browser: false,
  });

  return {
    sessionId,
    providerClass: provider.providerClass,
    garment: args.garment,
    frame,
    expiresAt: new Date(handle.expiresAt).toISOString(),
    fps: config.provider.fps,
    maxSeconds,
  };
}

/**
 * FR-105: swap the garment inside the running session. The session id, the
 * provider handle and the client's connection all stay exactly as they are.
 */
export async function switchLiveGarment(
  userId: UserId,
  sessionId: string,
  garment: GarmentAssetInput,
): Promise<{ frame: TryOnFrame | null; garment: GarmentAssetInput }> {
  const record = liveSessions.get(sessionId);
  if (!record || record.userId !== userId) {
    throw new HttpError(404, "not_found", "That try-on session has ended.", "Start a new try-on.", true);
  }
  if (record.handle.closed) {
    throw new HttpError(
      409,
      "provider_unavailable",
      "That try-on session has already ended.",
      "Start a new try-on to switch garments.",
      true,
    );
  }
  const provider = activeProvider();
  const eligibility = provider.eligibility(garment);
  if (!eligibility.allowsLive) {
    throw new HttpError(
      422,
      eligibility.qualityState === "unsupported" ? "policy_blocked" : "invalid_input",
      eligibility.reason,
      "Pick an upper-body garment, or use a photo preview.",
      true,
    );
  }

  try {
    await provider.switchLiveGarment(record.handle, garment);
  } catch (error) {
    if (error instanceof ProviderFailure) {
      throw new HttpError(502, "provider_error", error.detail.message, error.detail.nextAction, true);
    }
    throw error;
  }

  record.garment = garment;
  record.handle.garmentItemId = garment.itemId;
  // Force the next poll to re-render rather than wait out the frame interval.
  record.frameProducedAt = 0;
  return { frame: null, garment };
}

/** Returns a new frame, or null when the caller already has the latest one. */
export async function pollLiveFrame(
  userId: UserId,
  sessionId: string,
  after: number,
): Promise<{ frame: TryOnFrame | null; state: LiveStateSummary }> {
  const record = liveSessions.get(sessionId);
  if (!record || record.userId !== userId) {
    throw new HttpError(404, "not_found", "That try-on session has ended.", "Start a new try-on.", true);
  }
  if (Date.now() > record.handle.expiresAt) {
    await endLiveSession(userId, sessionId, "expired");
    return { frame: null, state: summary(record, "expired") };
  }

  const stale = Date.now() - record.frameProducedAt >= FRAME_INTERVAL_MS;
  if (stale) {
    const next = await activeProvider().nextLiveFrame(record.handle);
    if (next) {
      record.lastFrame = next;
      record.frameProducedAt = Date.now();
      // Charge provider time as it is actually consumed.
      const elapsed = Math.round((FRAME_INTERVAL_MS / 1000) * 10) / 10;
      record.chargedSeconds += elapsed;
      if (record.chargedSeconds >= 1) {
        const whole = Math.floor(record.chargedSeconds);
        record.chargedSeconds -= whole;
        await repo.consumeLiveSeconds(userId, whole);
        await repo.addCostCents(
          userId,
          Math.ceil(whole * config.cost.liveCentsPerSecond),
        );
      }
    }
    // A null frame is not an ended session. Adapters that cannot see pixels
    // (realtime-stream) return null while open and mark their own handle closed
    // when the session truly ends upstream; that is what ends polling here.
  }

  const frame =
    record.lastFrame && record.lastFrame.frameIndex > after ? record.lastFrame : null;
  return { frame, state: summary(record, record.handle.closed ? "ended" : "ready") };
}

export interface LiveStateSummary {
  phase: "ready" | "ended" | "expired";
  frameCount: number;
  secondsRemaining: number;
  garmentItemId: string;
}

function summary(record: LiveRecord, phase: LiveStateSummary["phase"]): LiveStateSummary {
  return {
    phase,
    frameCount: record.handle.frameCount,
    secondsRemaining: Math.max(0, Math.round((record.handle.expiresAt - Date.now()) / 1000)),
    garmentItemId: record.garment.itemId,
  };
}

/** FR-106: ending a session must terminate provider compute and settle the ledger. */
export async function endLiveSession(userId: UserId, sessionId: string, reason: string): Promise<void> {
  const record = liveSessions.get(sessionId);
  if (!record || record.userId !== userId) return;
  try {
    await activeProvider().endLive(record.handle, reason);
    // A browser-rendered session produces no server-visible frames, so there is
    // nothing to meter per poll. Its time is settled here instead, at the one
    // moment the wall clock is authoritative and the provider has reported its
    // own duration. Without this the guest's live allowance would never move.
    if (record.browser) await settleBrowserLive(record).catch(() => undefined);
  } finally {
    liveSessions.delete(sessionId);
  }
}

/** Charge a browser-rendered session for the wall time it actually held. */
async function settleBrowserLive(record: LiveRecord): Promise<void> {
  const boundedEnd = Math.min(Date.now(), record.handle.expiresAt);
  const elapsed = Math.floor((boundedEnd - record.createdAt) / 1000);
  if (elapsed < 1) return;
  const whole = Math.min(elapsed, config.provider.liveSessionSeconds);
  await repo.consumeLiveSeconds(record.userId, whole);
  await repo.addCostCents(record.userId, Math.ceil(whole * config.cost.liveCentsPerSecond));
}

export async function liveUsageFor(userId: UserId): Promise<void> {
  const now = Date.now();
  for (const record of [...liveSessions.values()]) {
    if (record.userId !== userId) continue;
    const expired = now > record.handle.expiresAt;
    // A session the client abandoned is closed rather than left accruing cost.
    const stale = now - record.createdAt > config.provider.liveSessionSeconds * 1000;
    if (expired || stale) {
      liveSessions.delete(record.handle.providerSessionId);
    }
  }
}

// --- photo jobs ----------------------------------------------------------

export async function startPhotoJob(args: {
  userId: UserId;
  person: { frameDataUrl: string; width: number; height: number; capturedAt: number };
  garment: GarmentAssetInput;
  clientToken: string;
}): Promise<{ jobId: string; garment: GarmentAssetInput; alreadyBilled: boolean }> {
  const provider = activeProvider();
  const eligibility = provider.eligibility(args.garment);
  if (!eligibility.allowsPhoto) {
    throw new HttpError(
      422,
      eligibility.qualityState === "unsupported" ? "policy_blocked" : "invalid_input",
      eligibility.reason,
      eligibility.qualityState === "unsupported"
        ? "This item cannot be tried on yet. It stays saved in your wardrobe."
        : "Fix the crop or category, then try again.",
      true,
    );
  }

  const jobId = `job_${args.clientToken}`;
  const existing = photoJobs.get(jobId);
  if (existing) {
    // Idempotent: the same client token never starts a second provider job.
    return { jobId, garment: existing.garment, alreadyBilled: existing.billed };
  }

  const usage = await repo.readUsage(args.userId);
  if (usage.photoRemaining <= 0) {
    throw new HttpError(
      402,
      "allowance_exceeded",
      "You have used your try-ons for now.",
      "Your wardrobe is still here — try again when your allowance resets.",
      false,
    );
  }
  await assertUnderGlobalCap();

  const handle = await provider
    .startPhoto({
      userId: args.userId,
      person: args.person,
      garment: args.garment,
      clientToken: args.clientToken,
    })
    .catch(mapProviderFailure);
  photoJobs.set(jobId, {
    handle,
    userId: args.userId,
    garment: args.garment,
    billed: false,
    startedAt: Date.now(),
    lastResult: null,
  });
  return { jobId, garment: args.garment, alreadyBilled: false };
}

export async function pollPhotoJob(
  userId: UserId,
  jobId: string,
): Promise<{
  status: "queued" | "processing" | "ready" | "failed" | "blocked";
  progress: number;
  stage: string;
  resultUrl?: string;
  qualityState?: QualityState;
  error?: { category: string; message: string; nextAction: string; retryIsFree: boolean };
}> {
  const record = photoJobs.get(jobId);
  if (!record || record.userId !== userId) {
    throw new HttpError(404, "not_found", "That try-on job has expired.", "Start it again.", true);
  }
  if (Date.now() - record.startedAt > config.provider.photoTimeoutMs * 4) {
    photoJobs.delete(jobId);
    throw new HttpError(
      504,
      "provider_timeout",
      "That try-on took too long and was stopped.",
      "Retry — nothing was charged.",
      true,
    );
  }

  const progress = await activeProvider().pollPhoto(record.handle);

  if (progress.status === "ready" && progress.resultUrl) {
    if (!record.billed) {
      record.billed = true;
      await repo.consumePhoto(userId);
      if (progress.costCents > 0) await repo.addCostCents(userId, progress.costCents);
    }
    record.lastResult = progress.resultUrl;
    // Mirroring the garment is cached, but the wardrobe "last used" signal and
    // the funnel both need this.
    await repo.markItemUsed(userId, record.garment.itemId);
    return {
      status: "ready",
      progress: 1,
      stage: "Ready",
      resultUrl: progress.resultUrl,
      qualityState: "ready",
    };
  }

  if (progress.status === "failed" || progress.status === "blocked") {
    photoJobs.delete(jobId);
    return {
      status: progress.status,
      progress: 1,
      stage: progress.stage,
      error: {
        category: progress.error?.category ?? "provider_error",
        message: progress.error?.message ?? "The try-on could not be finished.",
        nextAction: progress.error?.nextAction ?? "Retry — nothing was charged.",
        retryIsFree: !record.billed,
      },
    };
  }

  return { status: progress.status, progress: progress.progress, stage: progress.stage };
}

export async function cancelPhotoJob(userId: UserId, jobId: string): Promise<void> {
  const record = photoJobs.get(jobId);
  if (!record || record.userId !== userId) return;
  try {
    await activeProvider().cancelPhoto(record.handle, "user_cancelled");
  } finally {
    // Allowance is only ever taken on success, so a cancel cannot burn it.
    photoJobs.delete(jobId);
  }
}

/**
 * A provider failure already carries user-facing copy, so it becomes the HTTP
 * error directly instead of degrading into a generic 502: unreachable reads as
 * 503, a slow provider as 504, anything else as 502. Retries are always free
 * because no allowance is consumed before a session exists.
 */
function mapProviderFailure(error: unknown): never {
  if (error instanceof ProviderFailure) {
    const status =
      error.detail.category === "provider_unavailable"
        ? 503
        : error.detail.category === "provider_timeout"
          ? 504
          : 502;
    throw new HttpError(
      status,
      error.detail.category,
      error.detail.message,
      error.detail.nextAction,
      true,
    );
  }
  throw error;
}

/** FR-703: stop new work before the configured global ceiling is exceeded. */
async function assertUnderGlobalCap(): Promise<void> {
  const spent = await repo.globalCostSpentCents();
  if (spent >= config.cost.globalCapCents) {
    throw new HttpError(
      402,
      "cost_cap",
      "Try-on generation is paused because a usage limit was reached.",
      "Your wardrobe is safe. Try again later.",
      true,
    );
  }
}

export function activeSessionCount(): number {
  return liveSessions.size + photoJobs.size;
}

export type { WardrobeItem, FeatureFlags, ApiBootstrap };
