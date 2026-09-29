import { config } from "../env.js";
import type { GarmentLoader } from "./mock.js";
import {
  ProviderFailure,
  type GarmentAssetInput,
  type LiveSessionHandle,
  type LiveStartInput,
  type PhotoJobHandle,
  type PhotoProgress,
  type PhotoStartInput,
  type PersonInput,
  type ReadinessCheck,
  type ReadinessInput,
  type TryOnFrame,
  type TryOnProvider,
} from "./types.js";

/**
 * Template adapter for a hosted virtual try-on vendor.
 *
 * This is the seam a real provider plugs into: implement six calls, register it
 * in `server/provider/index.ts`, set `TRYON_PROVIDER=http` plus
 * `TRYON_PROVIDER_BASE_URL` and `TRYON_PROVIDER_API_KEY`, and the whole app
 * switches over. The API key is read here and never leaves the server.
 *
 * The endpoint shape below is deliberately a documented contract of *our* own
 * orchestrator-facing surface, not a claim about any specific vendor's API. Map
 * the four calls inside each method to whatever the vendor documents.
 */
export interface HttpProviderOptions {
  baseUrl: string;
  apiKey: string;
  loadGarment: GarmentLoader;
}

interface HttpSessionResponse {
  id: string;
  websocketUrl?: string;
  expiresAt?: string;
}

interface HttpJobResponse {
  id: string;
  status: "queued" | "processing" | "ready" | "failed" | "blocked";
  progress?: number;
  stage?: string;
  resultUrl?: string;
  error?: { category?: string; message?: string; nextAction?: string };
}

export function createHttpTryOnProvider(options: HttpProviderOptions): TryOnProvider {
  const base = options.baseUrl.replace(/\/+$/, "");

  function headers(): Record<string, string> {
    if (!options.apiKey) {
      throw new ProviderFailure({
        category: "provider_unavailable",
        message: "The try-on service is not configured on this server.",
        nextAction: "Use the built-in preview, or ask an admin to set the provider key.",
      });
    }
    return {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    };
  }

  async function garmentDataUrl(imageUrl: string): Promise<string> {
    const bytes = await options.loadGarment(imageUrl);
    if (!bytes) {
      throw new ProviderFailure({
        category: "provider_error",
        message: "That garment image could not be read for try-on.",
        nextAction: "Re-upload the garment, or pick another item.",
      });
    }
    return `data:${bytes.contentType};base64,${bytes.bytes.toString("base64")}`;
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.provider.photoTimeoutMs);
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 429) {
        throw new ProviderFailure({
          category: "provider_unavailable",
          message: "The try-on service is busy right now.",
          nextAction: "Wait a moment and retry — this will not use a second allowance.",
        });
      }
      if (!response.ok) {
        throw new ProviderFailure({
          category: "provider_error",
          message: `The try-on service returned ${response.status}.`,
          nextAction: "Retry in a moment. Your garment is still saved.",
        });
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProviderFailure) throw error;
      throw new ProviderFailure({
        category: "provider_timeout",
        message: "The try-on service did not respond in time.",
        nextAction: "Retry — this will not use a second allowance.",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "http",
    providerClass: "realtime-stream",

    capabilities: { live: true, photo: true, maxCategory: "upper_body", serverFrames: true },

    async checkReadiness(input: ReadinessInput): Promise<ReadinessCheck> {
      // Client-side gates are authoritative for framing; a vendor round-trip on
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

    eligibility(input: GarmentAssetInput) {
      if (input.category !== "tops") {
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
      return {
        qualityState: input.qualityState,
        allowsLive: input.qualityState === "ready",
        allowsPhoto: true,
        reason: "Ready for try-on.",
      };
    },

    async startLive(input: LiveStartInput): Promise<LiveSessionHandle> {
      const garmentImage = await garmentDataUrl(input.garment.imageUrl);
      const session = await post<HttpSessionResponse>("/v1/live/sessions", {
        personFrame: input.person.frameDataUrl,
        garmentImage,
        category: input.garment.category,
        maxSeconds: input.maxSeconds,
        clientToken: input.clientToken,
      });
      const now = Date.now();
      return {
        providerSessionId: session.id,
        provider: "http",
        garmentItemId: input.garment.itemId,
        startedAt: now,
        expiresAt: session.expiresAt ? new Date(session.expiresAt).getTime() : now + input.maxSeconds * 1000,
        frameCount: 0,
        closed: false,
        internals: { websocketUrl: session.websocketUrl, lastFrame: input.person.frameDataUrl, personWidth: input.person.width },
      };
    },

    async switchLiveGarment(handle: LiveSessionHandle, garment: GarmentAssetInput) {
      await post(`/v1/live/sessions/${handle.providerSessionId}/garment`, {
        garmentImage: await garmentDataUrl(garment.imageUrl),
        category: garment.category,
      });
      handle.garmentItemId = garment.itemId;
    },

    async nextLiveFrame(handle: LiveSessionHandle): Promise<TryOnFrame | null> {
      if (handle.closed || Date.now() >= handle.expiresAt) {
        handle.closed = true;
        return null;
      }
      // A real vendor streams over a websocket. Polling a frame endpoint is the
      // simplest transport-agnostic placeholder; swap the body for the socket
      // reader without changing any caller.
      const response = await fetch(
        `${base}/v1/live/sessions/${handle.providerSessionId}/frame`,
        { headers: headers(), signal: AbortSignal.timeout(5000) },
      ).catch(() => null);
      if (!response || !response.ok) {
        handle.frameCount += 1;
        return handle.frameCount < 3
          ? null
          : {
              imageUrl: handle.internals?.lastFrame as string,
              frameIndex: handle.frameCount,
              generatedAt: new Date().toISOString(),
              qualitySignals: {
                identityStable: true,
                garmentStable: false,
                lowConfidence: true,
              },
            };
      }
      const { frame } = (await response.json()) as { frame: string };
      handle.internals = { ...handle.internals, lastFrame: frame };
      handle.frameCount += 1;
      return {
        imageUrl: frame,
        frameIndex: handle.frameCount,
        generatedAt: new Date().toISOString(),
        qualitySignals: { identityStable: true, garmentStable: true, lowConfidence: false },
      };
    },

    async endLive(handle: LiveSessionHandle, _reason: string) {
      handle.closed = true;
      await fetch(`${base}/v1/live/sessions/${handle.providerSessionId}`, {
        method: "DELETE",
        headers: headers(),
      }).catch(() => undefined);
    },

    async startPhoto(input: PhotoStartInput): Promise<PhotoJobHandle> {
      const garmentImage = await garmentDataUrl(input.garment.imageUrl);
      const job = await post<HttpJobResponse>("/v1/tryons", {
        personFrame: input.person.frameDataUrl,
        garmentImage,
        category: input.garment.category,
        clientToken: input.clientToken,
      });
      return {
        providerJobId: job.id,
        provider: "http",
        garmentItemId: input.garment.itemId,
        startedAt: Date.now(),
        closed: false,
        internals: { person: input.person satisfies PersonInput, garment: input.garment },
      };
    },

    async pollPhoto(handle: PhotoJobHandle): Promise<PhotoProgress> {
      const response = await fetch(`${base}/v1/tryons/${handle.providerJobId}`, {
        headers: headers(),
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      if (!response || !response.ok) {
        return { status: "processing", progress: 0.5, stage: "Processing", costCents: 0 };
      }
      const job = (await response.json()) as HttpJobResponse;
      if (job.status === "ready" && job.resultUrl) {
        handle.closed = true;
        return {
          status: "ready",
          progress: 1,
          stage: "Ready",
          resultUrl: job.resultUrl,
          qualityState: "ready",
          costCents: config.cost.photoCents,
        };
      }
      if (job.status === "failed" || job.status === "blocked") {
        handle.closed = true;
        return {
          status: job.status,
          progress: 1,
          stage: job.status === "blocked" ? "Blocked" : "Failed",
          error: {
            category:
              job.error?.category === "policy_blocked"
                ? "policy_blocked"
                : job.status === "blocked"
                  ? "policy_blocked"
                  : "provider_error",
            message: job.error?.message ?? "The try-on could not be finished.",
            nextAction: job.error?.nextAction ?? "Retry — this will not use a second allowance.",
          },
          costCents: 0,
        };
      }
      return {
        status: job.status === "queued" ? "queued" : "processing",
        progress: job.progress ?? 0.4,
        stage: job.stage ?? "Processing",
        costCents: 0,
      };
    },

    async cancelPhoto(handle: PhotoJobHandle, _reason: string) {
      handle.closed = true;
      await fetch(`${base}/v1/tryons/${handle.providerJobId}`, {
        method: "DELETE",
        headers: headers(),
      }).catch(() => undefined);
    },

    estimateCost({ mode, seconds }) {
      return mode === "live"
        ? Math.ceil((seconds ?? 0) * config.cost.liveCentsPerSecond)
        : config.cost.photoCents;
    },
  };
}
