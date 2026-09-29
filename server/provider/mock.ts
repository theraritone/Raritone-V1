import sharp from "sharp";
import { SAMPLE_GARMENTS, garmentPath } from "../../shared/garmentArt.js";
import { config } from "../env.js";
import {
  ProviderFailure,
  type EligibilityDecision,
  type GarmentAssetInput,
  type LiveSessionHandle,
  type LiveStartInput,
  type PhotoJobHandle,
  type PhotoProgress,
  type PhotoStartInput,
  type PersonInput,
  type ProviderError,
  type ReadinessCheck,
  type ReadinessInput,
  type TryOnProvider,
  type TryOnFrame,
} from "./types.js";
import type { QualityState } from "../../shared/types.js";

/**
 * The reference implementation of `TryOnProvider`.
 *
 * It stands in for a generation vendor so the whole Release 1 loop is verifiable
 * without provider credentials, and so a real adapter has an exact contract to
 * match. It performs genuine compositing with sharp: the person's frame is
 * blended with the garment's silhouette, graded toward the Raritone accent pair,
 * and returned as a JPEG the client can display and capture.
 *
 * The output is deliberately visibly *generated* — a colour grade and edge
 * treatment that never appear in a raw camera frame — because the PRD requires
 * the user to be able to tell camera preview from AI output at a glance.
 */

export interface GarmentBytes {
  bytes: Buffer;
  contentType: string;
}

/** Injected by the orchestrator so the provider never talks to storage directly. */
export type GarmentLoader = (imageUrl: string) => Promise<GarmentBytes | null>;

export interface MockProviderOptions {
  loadGarment: GarmentLoader;
  /** Preview resolution for live frames. Smaller is faster and still legible. */
  liveWidth: number;
  photoWidth: number;
}

const PREVIEW_HEIGHT = 1280;

type MaskMode = "alpha" | "flat" | "photo";

interface GarmentCacheEntry {
  /** RGBA garment, already cut out and sized to the target width. */
  body: Buffer;
  width: number;
  height: number;
  mode: MaskMode;
}

export function createMockProvider(options: MockProviderOptions): TryOnProvider {
  const garmentCache = new Map<string, GarmentCacheEntry>();
  /** Provider job id → the result we already billed for. */
  const settledJobs = new Map<string, string>();

  async function loadGarmentAsset(
    imageUrl: string,
    targetWidth: number,
  ): Promise<GarmentCacheEntry> {
    const key = `${targetWidth}:${imageUrl}`;
    const cached = garmentCache.get(key);
    if (cached) return cached;

    const fetched = await options.loadGarment(imageUrl);
    if (!fetched) {
      throw new ProviderFailure({
        category: "provider_error",
        message: "That garment image could not be read for try-on.",
        nextAction: "Re-upload the garment, or pick another item.",
      });
    }

    const entry = await prepareGarment(fetched.bytes, targetWidth);
    garmentCache.set(key, entry);
    // Bound the cache: a long session with many garments must not grow forever.
    if (garmentCache.size > 24) {
      const oldest = garmentCache.keys().next().value;
      if (oldest) garmentCache.delete(oldest);
    }
    return entry;
  }

  async function composite(
    person: PersonInput,
    garment: GarmentAssetInput,
    width: number,
    seed: number,
  ): Promise<string> {
    const target = await loadGarmentAsset(garment.imageUrl, Math.round(width * 0.62));
    const height = Math.round(PREVIEW_HEIGHT * (width / 720));

    const personBuf = Buffer.from(stripDataUrl(person.frameDataUrl), "base64");
    const personMeta = await sharp(personBuf).metadata();
    if (!personMeta.width || !personMeta.height) {
      throw new ProviderFailure({
        category: "provider_error",
        message: "That camera frame could not be read.",
        nextAction: "Hold the phone steady and try again.",
      });
    }

    // A short deterministic sway keeps the live layer feeling alive without
    // pretending to track the body.
    const sway = seed === 0 ? 0 : Math.round(Math.sin(seed / 9) * width * 0.006);
    const breathe = seed === 0 ? 0 : Math.round(Math.sin(seed / 6.5) * height * 0.0035);

    const garmentTop = Math.round(height * 0.155 + breathe);
    const garmentLeft = Math.round((width - target.width) / 2 + sway);
    const bottom = garmentTop + target.height;
    if (garmentLeft > width || garmentTop > height || bottom > height * 1.35) {
      throw new ProviderFailure({
        category: "provider_error",
        message: "The garment did not fit inside the frame.",
        nextAction: "Step back a little so your upper body fits, then retry.",
      });
    }

    const frame = await sharp(personBuf)
      .rotate() // honour EXIF orientation from a phone capture
      .resize(width, height, { fit: "cover", position: "top" })
      .modulate({ saturation: 0.94, brightness: 1.02 })
      .composite([
        { input: target.body, left: Math.max(0, garmentLeft), top: Math.max(0, garmentTop) },
      ])
      // Unifying grade. This is what makes the frame read as generated output
      // rather than an untouched camera preview.
      .tint({ r: 236, g: 226, b: 255 })
      .modulate({ saturation: 1.04 })
      .jpeg({ quality: 88, progressive: false })
      .toBuffer();

    return `data:image/jpeg;base64,${frame.toString("base64")}`;
  }

  return {
    name: "mock",
    providerClass: "mock",

    capabilities: {
      live: true,
      photo: true,
      maxCategory: "upper_body",
      serverFrames: true,
    },

    async checkReadiness(input: ReadinessInput): Promise<ReadinessCheck> {
      if (!input.hasGarment) {
        return {
          ok: false,
          code: "no_person",
          message: "Choose a garment first.",
          nextAction: "Pick a garment from the carousel below.",
        };
      }
      if (!input.person.frameDataUrl) {
        return {
          ok: false,
          code: "no_person",
          message: "The camera is not sending frames yet.",
          nextAction: "Keep the app in the foreground and try again.",
        };
      }
      // Portrait framing check: a landscape frame means the phone was rotated.
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
      if (input.deviceTier === "low" && input.supportsLive) {
        return {
          ok: true,
          code: "ok",
          message: "Ready.",
          nextAction: "Photo preview will be steadier on this device.",
        };
      }
      if (input.networkMbps !== null && input.networkMbps < 1.2) {
        return {
          ok: true,
          code: "ok",
          message: "Ready, on a slow connection.",
          nextAction: "Photo preview will be more reliable here.",
        };
      }
      return { ok: true, code: "ok", message: "Ready.", nextAction: "Tap to try on." };
    },

    eligibility(input: GarmentAssetInput): EligibilityDecision {
      // PRD D-02: launch category is upper body only. Anything else is saved but
      // never sent to inference, so we do not spend on inputs likely to fail.
      if (input.category !== "tops") {
        return {
          qualityState: "unsupported",
          allowsLive: false,
          allowsPhoto: false,
          reason: "Only upper-body garments have visual try-on in Release 1.",
        };
      }
      if (input.qualityState === "needs_review") {
        return {
          qualityState: "needs_review",
          allowsLive: false,
          allowsPhoto: false,
          reason: "Fix the crop or category before trying this on.",
        };
      }
      if (input.qualityState === "unsupported") {
        return {
          qualityState: "unsupported",
          allowsLive: false,
          allowsPhoto: false,
          reason: "This item has no try-on support yet.",
        };
      }
      const allowsLive = input.qualityState === "ready";
      return {
        qualityState: input.qualityState,
        allowsLive,
        allowsPhoto: true,
        reason: allowsLive
          ? "Ready for live and photo try-on."
          : "Photo try-on only; the preview may be less stable.",
      };
    },

    async startLive(input: LiveStartInput): Promise<LiveSessionHandle> {
      if (config.providerKillSwitch) {
        throw new ProviderFailure({
          category: "provider_unavailable",
          message: "Live try-on is switched off right now.",
          nextAction: "Use a photo preview instead — it works the same way.",
        });
      }
      // Render the first frame before the session is considered started, so the
      // client's "connecting" shimmer covers real work (NFR-05: live start ≤ 8s).
      const first = await composite(input.person, input.garment, options.liveWidth, 0);
      const now = Date.now();
      return {
        providerSessionId: `live_${input.clientToken}`,
        provider: "mock",
        garmentItemId: input.garment.itemId,
        startedAt: now,
        expiresAt: now + input.maxSeconds * 1000,
        frameCount: 1,
        closed: false,
        internals: { lastFrame: first, personWidth: input.person.width, liveWidth: options.liveWidth },
      };
    },

    async switchLiveGarment(handle: LiveSessionHandle, garment: GarmentAssetInput) {
      if (handle.closed) {
        throw new ProviderFailure({
          category: "provider_unavailable",
          message: "That try-on session already ended.",
          nextAction: "Start a new try-on to switch garments.",
        });
      }
      // Swap the garment reference only. No reconnect, no re-negotiation: the
      // client keeps the same session id and just gets the next frame.
      handle.garmentItemId = garment.itemId;
      handle.internals = { ...(handle.internals ?? {}), pendingGarment: garment };
    },

    async nextLiveFrame(handle: LiveSessionHandle): Promise<TryOnFrame | null> {
      if (handle.closed) return null;
      if (Date.now() >= handle.expiresAt) {
        handle.closed = true;
        return null;
      }

      const internals = handle.internals ?? {};
      const pending = internals.pendingGarment as GarmentAssetInput | undefined;
      const previous = internals.lastFrame as string | undefined;

      if (pending) {
        if (previous) {
          const personWidth = (internals.personWidth as number) ?? 390;
          try {
            // Re-render onto the last emitted frame. Same session id, same
            // connection — the client just sees the new garment.
            const composited = await composite(
              {
                frameDataUrl: previous,
                width: personWidth,
                height: Math.round((personWidth / 720) * PREVIEW_HEIGHT),
                capturedAt: Date.now(),
              },
              pending,
              options.liveWidth,
              handle.frameCount,
            );
            internals.lastFrame = composited;
          } catch {
            // A garment that will not fit leaves the previous frame in place
            // rather than tearing the session down.
          }
        }
        delete internals.pendingGarment;
        handle.internals = internals;
      }

      handle.frameCount += 1;
      const imageUrl = internals.lastFrame as string | undefined;
      if (!imageUrl) return null;
      return {
        imageUrl,
        frameIndex: handle.frameCount,
        generatedAt: new Date().toISOString(),
        qualitySignals: {
          identityStable: true,
          garmentStable: handle.frameCount > 2,
          lowConfidence: false,
        },
      };
    },

    async endLive(handle: LiveSessionHandle, _reason: string) {
      handle.closed = true;
      handle.internals = {};
    },

    async startPhoto(input: PhotoStartInput): Promise<PhotoJobHandle> {
      if (config.providerKillSwitch) {
        throw new ProviderFailure({
          category: "provider_unavailable",
          message: "Visual try-on is switched off right now.",
          nextAction: "Your garment is still saved — try again in a moment.",
        });
      }
      const key = `photo_${input.clientToken}`;
      const alreadySettled = settledJobs.get(key);
      if (alreadySettled) {
        // A retry after a client timeout returns the already-paid result rather
        // than starting a second provider job (PRD: retry without double charge).
        return {
          providerJobId: key,
          provider: "mock",
          garmentItemId: input.garment.itemId,
          startedAt: Date.now(),
          closed: false,
          internals: { settledResult: alreadySettled },
        };
      }
      return {
        providerJobId: key,
        provider: "mock",
        garmentItemId: input.garment.itemId,
        startedAt: Date.now(),
        closed: false,
        internals: { person: input.person, garment: input.garment, cached: false },
      };
    },

    async pollPhoto(handle: PhotoJobHandle): Promise<PhotoProgress> {
      if (handle.closed) {
        return {
          status: "failed",
          progress: 0,
          stage: "cancelled",
          error: {
            category: "provider_unavailable",
            message: "That try-on was cancelled.",
            nextAction: "Start it again whenever you like.",
          },
          costCents: 0,
        };
      }
      const settledResult = handle.internals?.settledResult as string | undefined;
      if (settledResult) {
        handle.closed = true;
        return {
          status: "ready",
          progress: 1,
          stage: "Ready",
          resultUrl: settledResult,
          qualityState: "ready" satisfies QualityState,
          // Already charged on the first attempt. Reporting zero here is what
          // keeps a retry from consuming a second allowance.
          costCents: 0,
        };
      }

      const person = (handle.internals?.person as PersonInput | undefined) ?? null;
      const garment = (handle.internals?.garment as GarmentAssetInput | undefined) ?? null;
      if (!person || !garment) {
        return { status: "queued", progress: 0.1, stage: "Queued", costCents: 0 };
      }
      try {
        const resultUrl = await composite(person, garment, options.photoWidth, 0);
        settledJobs.set(handle.providerJobId, resultUrl);
        if (settledJobs.size > 64) {
          const oldest = settledJobs.keys().next().value;
          if (oldest) settledJobs.delete(oldest);
        }
        handle.closed = true;
        return {
          status: "ready",
          progress: 1,
          stage: "Ready",
          resultUrl,
          qualityState: "ready" satisfies QualityState,
          costCents: estimatePhotoCost(),
        };
      } catch (error) {
        handle.closed = true;
        const detail: ProviderError =
          error instanceof ProviderFailure
            ? error.detail
            : {
                category: "provider_error",
                message: "The try-on could not be finished.",
                nextAction: "Retry — this will not use a second allowance.",
              };
        return {
          status: detail.category === "policy_blocked" ? "blocked" : "failed",
          progress: 1,
          stage: detail.category === "policy_blocked" ? "Blocked" : "Failed",
          error: detail,
          costCents: 0,
        };
      }
    },

    async cancelPhoto(handle: PhotoJobHandle, _reason: string) {
      handle.closed = true;
    },

    estimateCost({ mode, seconds }) {
      return mode === "live"
        ? Math.ceil((seconds ?? 0) * config.cost.liveCentsPerSecond)
        : estimatePhotoCost();
    },
  };
}

function estimatePhotoCost(): number {
  return config.cost.photoCents;
}

// --- compositing internals ----------------------------------------------

/**
 * Turns a garment image into a cut-out sized for compositing.
 *
 * Three cases, because Release 1 accepts whatever the user has to hand:
 *  - `alpha`  a flat product render with transparency (the built-in samples)
 *  - `flat`   a product shot on a plain white background
 *  - `photo`  a real photo — fall back to a garment-shaped mask weighted by the
 *             photo's own luminance, so fabric colour and texture carry over
 */
async function prepareGarment(bytes: Buffer, targetWidth: number): Promise<GarmentCacheEntry> {
  const source = sharp(bytes, { failOn: "none" });
  const meta = await source.metadata();
  const srcW = meta.width ?? 300;
  const srcH = meta.height ?? 360;
  const hasAlpha = Boolean(meta.hasAlpha);

  // Resize the garment so it occupies a sensible share of the frame width while
  // keeping its aspect ratio.
  const scale = targetWidth / srcW;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const rgba = await sharp(bytes, { failOn: "none" })
    .resize(width, height, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = rgba;
  const px = info.width;
  const py = info.height;
  const channels = info.channels;

  const alphaCoverage = measureAlpha(data, px, py, channels);
  if (hasAlpha && alphaCoverage < 0.985) {
    return { body: await sharp(data, { raw: info }).png().toBuffer(), width: px, height: py, mode: "alpha" };
  }

  const whiteCoverage = measureWhiteBorder(data, px, py, channels);
  if (whiteCoverage > 0.5) {
    // Cut out the product: anything that is clearly not the flat backdrop.
    for (let i = 0; i < px * py; i += 1) {
      const o = i * channels;
      const [r, g, b] = [data[o], data[o + 1], data[o + 2]];
      const isBackdrop = r > 238 && g > 238 && b > 238;
      data[o + 3] = isBackdrop ? 0 : 255;
    }
    return { body: await sharp(data, { raw: info }).png().toBuffer(), width: px, height: py, mode: "flat" };
  }

  // Real photo: keep the luminance detail, mask it to a garment silhouette.
  const silhouette = await rasterizeSilhouette(px, py);
  for (let i = 0; i < px * py; i += 1) {
    const o = i * channels;
    const luma = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
    const shape = silhouette[i];
    // A soft edge so the garment does not look like a sticker.
    const edge = Math.min(1, Math.max(0, (shape - 0.06) / 0.22));
    data[o + 3] = Math.round(255 * edge * Math.min(1, 0.42 + luma * 0.78));
  }
  return { body: await sharp(data, { raw: info }).png().toBuffer(), width: px, height: py, mode: "photo" };
}

function measureAlpha(data: Buffer, w: number, h: number, channels: number): number {
  let transparent = 0;
  const step = Math.max(1, Math.floor((w * h) / 40_000));
  let sampled = 0;
  for (let i = 0; i < w * h; i += step) {
    sampled += 1;
    if (data[i * channels + 3] < 250) transparent += 1;
  }
  return sampled === 0 ? 1 : transparent / sampled;
}

/** Fraction of the outer border that is plain backdrop. */
function measureWhiteBorder(data: Buffer, w: number, h: number, channels: number): number {
  let white = 0;
  let total = 0;
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.06));
  const check = (x: number, y: number) => {
    const o = (y * w + x) * channels;
    total += 1;
    if (data[o] > 236 && data[o + 1] > 236 && data[o + 2] > 236) white += 1;
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < band; x += 1) {
      check(x, y);
      check(w - 1 - x, y);
    }
  }
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < band; y += 1) {
      check(x, y);
      check(x, h - 1 - y);
    }
  }
  return total === 0 ? 0 : white / total;
}

/** Alpha coverage of the sample silhouettes, scaled to the target raster. */
async function rasterizeSilhouette(w: number, h: number): Promise<Float32Array> {
  const masks = await Promise.all(
    SAMPLE_GARMENTS.map(async (spec) => {
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" ` +
        `width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">` +
        `<path d="${garmentPath(spec.cut)}" fill="#fff"/></svg>`;
      const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      const out = new Float32Array(w * h);
      for (let i = 0; i < w * h; i += 1) out[i] = data[i * 4 + 3] / 255;
      return out;
    }),
  );
  // Average the cuts: for a real photo we want a generic garment region, not
  // whichever sample happens to be first.
  const out = new Float32Array(w * h);
  for (const mask of masks) for (let i = 0; i < w * h; i += 1) out[i] += mask[i] / masks.length;
  // Separable blur so the mask edge is soft. A nested box blur here is O(n·r²)
  // and turns a 440px garment into tens of millions of operations.
  return boxBlur(out, w, h, Math.max(1, Math.round(Math.min(w, h) * 0.02)));
}

/** Two-pass separable box blur. */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  for (let y = 0; y < h; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) {
      sum += src[y * w + clamp(x, 0, w - 1)];
    }
    const width = radius * 2 + 1;
    for (let x = 0; x < w; x += 1) {
      tmp[y * w + x] = sum / width;
      sum += src[y * w + clamp(x + radius + 1, 0, w - 1)] - src[y * w + clamp(x - radius, 0, w - 1)];
    }
  }

  for (let x = 0; x < w; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) {
      sum += tmp[clamp(y, 0, h - 1) * w + x];
    }
    const height = radius * 2 + 1;
    for (let y = 0; y < h; y += 1) {
      out[y * w + x] = sum / height;
      sum += tmp[clamp(y + radius + 1, 0, h - 1) * w + x] - tmp[clamp(y - radius, 0, h - 1) * w + x];
    }
  }
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
