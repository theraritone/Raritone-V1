import type {
  GarmentAssetInput,
  QualityState,
  ReadinessCheck,
  TryOnFrame,
  UserId,
} from "../../shared/types.js";

/**
 * Re-exported from the shared contract so the orchestrator, the adapters and the
 * client all agree on these shapes without a circular import.
 */
export type { GarmentAssetInput, QualityState, ReadinessCheck, TryOnFrame, UserId };

/**
 * The provider contract (PRD "Provider abstraction"). The orchestrator hands the
 * adapter a normalized person input, a prepared garment, a category, a mode and
 * constraints, and gets back job/session state, normalized progress, output
 * media, cost metadata, quality signals and structured errors.
 *
 * Everything vendor-specific — endpoints, tokens, payload shapes, polling
 * cadence — lives behind this interface. Provider tokens stay server-side.
 */
export interface TryOnProvider {
  /** Stable identifier used for support traces (FR-704). Never a secret. */
  readonly name: string;
  /**
   * Coarse class for cost routing: "mock" | "photo-diffusion" | "realtime-stream".
   * Exposed to the client so operators can disable a class without a release.
   */
  readonly providerClass: string;

  /** Whether this provider can serve a bounded live session at all. */
  readonly capabilities: {
    live: boolean;
    photo: boolean;
    maxCategory: "upper_body" | "full_body" | "any";
    /**
     * True when the provider delivers composited pixels back to THIS server, so
     * the orchestrator can poll frames. A realtime-stream vendor renders
     * client-side (browser to vendor over WebRTC) and the server never sees a
     * pixel — false there, which is what stops the orchestrator from minting a
     * session it could only fake.
     */
    serverFrames: boolean;
  };

  /**
   * FR-103: pre-generation readiness. Must not store the frame, and must return
   * exactly one correction at a time.
   */
  checkReadiness(input: ReadinessInput): Promise<ReadinessCheck>;

  /** FR-205: category eligibility, decided before any paid inference. */
  eligibility(input: GarmentAssetInput): EligibilityDecision;

  /** Bounded live session (FR-104). */
  startLive(input: LiveStartInput): Promise<LiveSessionHandle>;
  /** FR-105: swap the garment without tearing the session down. */
  switchLiveGarment(handle: LiveSessionHandle, garment: GarmentAssetInput): Promise<void>;
  /** Pull the next composited frame. Returns null when the session has ended. */
  nextLiveFrame(handle: LiveSessionHandle): Promise<TryOnFrame | null>;
  /** FR-106: cancel must terminate provider compute. */
  endLive(handle: LiveSessionHandle, reason: string): Promise<void>;

  /** Photo mode job (FR-107). */
  startPhoto(input: PhotoStartInput): Promise<PhotoJobHandle>;
  pollPhoto(handle: PhotoJobHandle): Promise<PhotoProgress>;
  cancelPhoto(handle: PhotoJobHandle, reason: string): Promise<void>;

  /** Cost metadata in cents; used for the usage ledger and the global cap. */
  estimateCost(input: { mode: "live" | "photo"; seconds?: number }): number;
}

export interface PersonInput {
  /** A video frame as a JPEG data URL. Never logged, never persisted by the adapter. */
  frameDataUrl: string;
  width: number;
  height: number;
  /** Milliseconds since the caller's epoch; used to key frame ordering. */
  capturedAt: number;
}

export interface ReadinessInput {
  person: PersonInput;
  hasGarment: boolean;
  deviceTier: "low" | "mid" | "high";
  networkMbps: number | null;
  supportsLive: boolean;
}

export interface EligibilityDecision {
  /** Only `ready` may start live generation. */
  qualityState: QualityState;
  allowsLive: boolean;
  allowsPhoto: boolean;
  reason: string;
}

export interface LiveStartInput {
  userId: UserId;
  person: PersonInput;
  garment: GarmentAssetInput;
  /** Hard bound. The provider may end earlier but must never exceed it. */
  maxSeconds: number;
  /** Connection quality, used by providers that adapt output resolution. */
  networkMbps: number | null;
  clientToken: string;
}

export interface LiveSessionHandle {
  providerSessionId: string;
  provider: string;
  garmentItemId: string;
  startedAt: number;
  expiresAt: number;
  /** Frames already emitted, so the client can detect a stall. */
  frameCount: number;
  /** Cleaned up when true; the orchestrator must not poll a dead handle. */
  closed: boolean;
  /** Local scratch space for an adapter that needs to hold a stream. */
  internals?: Record<string, unknown>;
}

export interface PhotoStartInput {
  userId: UserId;
  person: PersonInput;
  garment: GarmentAssetInput;
  clientToken: string;
}

export interface PhotoJobHandle {
  providerJobId: string;
  provider: string;
  garmentItemId: string;
  startedAt: number;
  closed: boolean;
  internals?: Record<string, unknown>;
}

export interface PhotoProgress {
  status: "queued" | "processing" | "ready" | "failed" | "blocked";
  progress: number;
  stage: string;
  resultUrl?: string;
  qualityState?: QualityState;
  error?: ProviderError;
  costCents: number;
}

export interface ProviderError {
  category:
    | "provider_unavailable"
    | "provider_timeout"
    | "provider_error"
    | "policy_blocked"
    | "device_unsupported";
  message: string;
  nextAction: string;
}

export class ProviderFailure extends Error {
  constructor(readonly detail: ProviderError) {
    super(detail.message);
    this.name = "ProviderFailure";
  }
}
