import { config } from "../env.js";
import { isLaunchCategory } from "../../shared/types.js";
import {
  ProviderFailure,
  type EligibilityDecision,
  type GarmentAssetInput,
  type LiveSessionHandle,
  type LiveStartInput,
  type PhotoJobHandle,
  type PhotoProgress,
  type PhotoStartInput,
  type ProviderError,
  type ReadinessInput,
  type TryOnFrame,
  type TryOnProvider,
} from "./types.js";

/**
 * The real inference adapter.
 *
 * It brokers Decart live sessions through the raritone-live-vto backend instead
 * of implementing Decart integration itself: session creation, heartbeats and
 * teardown are that backend's session logic, reused here over HTTP. The
 * permanent Decart API key lives in the backend's own .env — this process never
 * sees it. The short-lived client token comes back inside the session handle
 * for the future browser-SDK integration; it is never logged.
 *
 * The one thing this adapter deliberately cannot do is return pixels. Decart
 * renders browser-to-Decart over WebRTC, so the PWA server never sees a frame
 * and `nextLiveFrame` returns null rather than inventing one. The orchestrator
 * refuses to mint app-facing sessions for a provider with `serverFrames: false`
 * for exactly this reason: a real session the client cannot render must end
 * immediately, never render a stand-in.
 */

export interface LiveVtoProviderOptions {
  /** Base URL of the raritone-live-vto backend, e.g. http://127.0.0.1:4000. */
  baseUrl: string;
  /** How long session creation may take before it counts as a failure. */
  connectTimeoutMs: number;
}

interface BackendSessionCreated {
  sessionId: string;
  clientToken: string;
  modelId?: string;
  expiresAt?: string;
  sessionMaxDurationSec?: number;
}

interface BackendSessionStatus {
  sessionId?: string;
  provider?: string;
  modelId?: string;
  status?: string;
  expiresAt?: string;
  elapsedSec?: number;
}

interface BackendSessionEnded {
  ok?: boolean;
  durationSec?: number;
  estimatedCostUsd?: number;
}

/** Backend errors look like { error: CODE, message: text }. */
interface BackendErrorBody {
  error?: string;
  message?: string;
}

const STATUS_TIMEOUT_MS = 4000;

/** Requirement: when the backend is unreachable, say exactly this. */
function connectionFailure(): ProviderFailure {
  return new ProviderFailure({
    category: "provider_unavailable",
    message: "Try-on unavailable — check your connection.",
    nextAction: "Check your connection and try again.",
  });
}

function timeoutFailure(): ProviderFailure {
  return new ProviderFailure({
    category: "provider_timeout",
    message: "The try-on service is taking too long.",
    nextAction: "Retry — this will not use a second allowance.",
  });
}

function notConfiguredFailure(backendMessage: string | null): ProviderFailure {
  return new ProviderFailure({
    category: "provider_unavailable",
    message: backendMessage ?? "The try-on service is not set up yet.",
    nextAction: "Try again later — nothing was charged.",
  });
}

function busyFailure(): ProviderFailure {
  return new ProviderFailure({
    category: "provider_unavailable",
    message: "The try-on service is busy right now.",
    nextAction: "Wait a moment and retry — this will not use a second allowance.",
  });
}

function errorFailure(status: number): ProviderFailure {
  return new ProviderFailure({
    category: "provider_error",
    message: `The try-on service returned ${status}.`,
    nextAction: "Retry in a moment. Your garment is still saved.",
  });
}

function endedFailure(): ProviderFailure {
  return new ProviderFailure({
    category: "provider_unavailable",
    message: "That try-on session already ended.",
    nextAction: "Start a new try-on to switch garments.",
  });
}

async function readBackendError(response: Response): Promise<BackendErrorBody | null> {
  try {
    const body = (await response.json()) as BackendErrorBody;
    if (body && (typeof body.message === "string" || typeof body.error === "string")) return body;
    return null;
  } catch {
    return null;
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

export function createLiveVtoProvider(options: LiveVtoProviderOptions): TryOnProvider {
  const base = options.baseUrl.replace(/\/+$/, "");

  async function postSession(userId: string, garmentId: string): Promise<BackendSessionCreated> {
    let response: Response;
    try {
      response = await fetch(`${base}/api/live-vto/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, garmentId }),
        signal: AbortSignal.timeout(options.connectTimeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) throw timeoutFailure();
      throw connectionFailure();
    }

    if (response.status === 503) {
      const body = await readBackendError(response);
      throw notConfiguredFailure(body?.message ?? null);
    }
    if (response.status === 429) throw busyFailure();
    if (!response.ok) throw errorFailure(response.status);

    const body = (await response.json().catch(() => null)) as BackendSessionCreated | null;
    if (!body?.sessionId || typeof body.clientToken !== "string" || !body.clientToken) {
      throw errorFailure(response.status);
    }
    return body;
  }

  async function backendStatus(sessionId: string): Promise<BackendSessionStatus | null> {
    let response: Response;
    try {
      response = await fetch(`${base}/api/live-vto/session/${sessionId}`, {
        signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
      });
    } catch {
      // A transient network blip is not a dead session; stay open and retry.
      return null;
    }
    if (!response.ok) return { status: response.status === 404 ? "ended" : undefined };
    return (await response.json().catch(() => null)) as BackendSessionStatus | null;
  }

  return {
    name: "live-vto",
    providerClass: "realtime-stream",

    capabilities: { live: true, photo: false, maxCategory: "upper_body", serverFrames: false },

    async checkReadiness(input: ReadinessInput) {
      // Client-side gates are authoritative for framing; a backend round-trip on
      // every tap would be slower than the correction it is meant to prevent.
      if (!input.hasGarment) {
        return {
          ok: false,
          code: "no_person",
          message: "Choose a garment first.",
          nextAction: "Pick a garment from the carousel below.",
        };
      }
      if (input.person.width > input.person.height) {
        return {
          ok: false,
          code: "landscape",
          message: "The frame is sideways.",
          nextAction: "Hold the phone upright.",
        };
      }
      if (input.person.height < 320) {
        return {
          ok: false,
          code: "too_close",
          message: "Your upper body is not fully in view.",
          nextAction: "Move back until your upper body is visible.",
        };
      }
      return { ok: true, code: "ok", message: "Ready.", nextAction: "Tap to try on." };
    },

    eligibility(input: GarmentAssetInput): EligibilityDecision {
      if (!isLaunchCategory(input.category)) {
        return {
          qualityState: "unsupported",
          allowsLive: false,
          allowsPhoto: false,
          reason: "Only upper-body garments have visual try-on in Release 1.",
        };
      }
      if (input.qualityState === "needs_review" || input.qualityState === "unsupported") {
        return {
          qualityState: input.qualityState,
          allowsLive: false,
          allowsPhoto: false,
          reason: "Fix this item before trying it on.",
        };
      }
      const allowsLive = input.qualityState === "ready";
      return {
        qualityState: input.qualityState,
        allowsLive,
        allowsPhoto: false,
        reason: allowsLive
          ? "Ready for live try-on."
          : "Only ready items can start live try-on.",
      };
    },

    async startLive(input: LiveStartInput): Promise<LiveSessionHandle> {
      // One HTTP call reuses the backend's whole session logic: limit checks,
      // the session record, the Decart token mint and the usage log. The person
      // frame is intentionally NOT sent — pixels travel browser-to-Decart over
      // WebRTC once the client integrates the browser SDK; the server must
      // never see or store them.
      const created = await postSession(input.userId, input.garment.itemId);
      const now = Date.now();
      const backendExpiry = created.expiresAt ? Date.parse(created.expiresAt) : NaN;
      const expiresAt = Number.isFinite(backendExpiry)
        ? Math.min(backendExpiry, now + input.maxSeconds * 1000)
        : now + input.maxSeconds * 1000;

      // Cost guardrail: every session start is logged with a timestamp. The
      // matching end line carries the burned seconds (see endLive). The client
      // token is never logged.
      process.stdout.write(
        `[live-vto] live session start backend=${created.sessionId} ` +
          `item=${input.garment.itemId} model=${created.modelId ?? "unknown"} ` +
          `at=${new Date(now).toISOString()}\n`,
      );

      return {
        providerSessionId: created.sessionId,
        provider: "live-vto",
        garmentItemId: input.garment.itemId,
        startedAt: now,
        expiresAt,
        frameCount: 0,
        closed: false,
        internals: {
          clientToken: created.clientToken,
          modelId: created.modelId,
          baseUrl: base,
        },
      };
    },

    async switchLiveGarment(handle: LiveSessionHandle, garment: GarmentAssetInput) {
      if (handle.closed) throw endedFailure();
      // Garment switching needs no reconnect and no new token: the backend
      // session stays exactly as it is. The heartbeat proves it is still alive
      // (and refreshes its usage record); a 404 means it died upstream.
      let response: Response;
      try {
        response = await fetch(`${base}/api/live-vto/session/${handle.providerSessionId}/heartbeat`, {
          method: "POST",
          signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        });
      } catch (error) {
        if (isTimeout(error)) throw timeoutFailure();
        throw connectionFailure();
      }
      if (response.status === 404) throw endedFailure();
      if (!response.ok) throw errorFailure(response.status);
      handle.garmentItemId = garment.itemId;
    },

    async nextLiveFrame(handle: LiveSessionHandle): Promise<TryOnFrame | null> {
      if (handle.closed) return null;
      if (Date.now() >= handle.expiresAt) {
        handle.closed = true;
        return null;
      }
      // There are no server-visible pixels by design, so there is never a frame
      // to return. What this CAN report honestly is liveness: if the backend
      // session is gone, mark the handle so the orchestrator stops polling it.
      const status = await backendStatus(handle.providerSessionId);
      if (status && status.status !== undefined && status.status !== "active") {
        handle.closed = true;
      }
      return null;
    },

    async endLive(handle: LiveSessionHandle, _reason: string) {
      if (handle.closed) return;
      handle.closed = true;
      const endedAt = Date.now();
      const wallSeconds = Math.max(0, Math.round((endedAt - handle.startedAt) / 1000));
      let backendSeconds: number | null = null;
      try {
        const response = await fetch(`${base}/api/live-vto/session/${handle.providerSessionId}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        });
        if (response.ok) {
          const body = (await response.json().catch(() => null)) as BackendSessionEnded | null;
          if (typeof body?.durationSec === "number") backendSeconds = body.durationSec;
        }
      } catch {
        // Best-effort teardown: the backend session expires on its own cap, so
        // a failed DELETE must never fail the caller's cleanup path.
      }
      // Cost guardrail: the authoritative burned seconds for this session. The
      // backend number is inference time; the wall number bounds it.
      process.stdout.write(
        `[live-vto] live session end backend=${handle.providerSessionId} ` +
          `at=${new Date(endedAt).toISOString()} ` +
          `backend_duration_s=${backendSeconds ?? "n/a"} wall_s=${wallSeconds}\n`,
      );
      handle.internals = {};
    },

    async startPhoto(_input: PhotoStartInput): Promise<PhotoJobHandle> {
      // The live backend mints realtime sessions only; there is no photo
      // endpoint to reuse, so photo fails closed instead of compositing one.
      throw new ProviderFailure({
        category: "provider_unavailable",
        message: "Photo try-on isn't available with the live provider.",
        nextAction: "Your garment is still saved — try again later.",
      });
    },

    async pollPhoto(handle: PhotoJobHandle): Promise<PhotoProgress> {
      handle.closed = true;
      const detail: ProviderError = {
        category: "provider_error",
        message: "Unknown photo job.",
        nextAction: "Start the try-on again.",
      };
      return { status: "failed", progress: 1, stage: "Failed", error: detail, costCents: 0 };
    },

    async cancelPhoto(handle: PhotoJobHandle, _reason: string) {
      handle.closed = true;
    },

    estimateCost({ mode, seconds }) {
      return mode === "live"
        ? Math.ceil((seconds ?? 0) * config.cost.liveCentsPerSecond)
        : config.cost.photoCents;
    },
  };
}
