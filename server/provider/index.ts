import { config } from "../env.js";
import { repo } from "../lib/db.js";
import { createMockProvider } from "./mock.js";
import type { GarmentLoader, MockProviderOptions } from "./mock.js";
import type { TryOnProvider } from "./types.js";
import { createHttpTryOnProvider } from "./httpProvider.js";
import { createLiveVtoProvider } from "./liveVto.js";

/**
 * Provider registry. The camera UI talks to the orchestrator, never to a vendor,
 * so switching generation vendors is a server-side change (AGENTS.md: "Provider
 * flexibility: never lock the product to one generation vendor").
 *
 * `PROVIDER_KILL_SWITCH=true` disables generation globally without a client
 * release (FR-702); the client then falls back to the garment picker.
 */
const garmentLoader: GarmentLoader = async (imageUrl) => {
  if (imageUrl.startsWith("data:")) {
    const comma = imageUrl.indexOf(",");
    return {
      bytes: Buffer.from(imageUrl.slice(comma + 1), "base64"),
      contentType: imageUrl.slice(5, imageUrl.indexOf(";") >= 0 ? imageUrl.indexOf(";") : comma),
    };
  }
  if (imageUrl.startsWith("supabase://")) {
    const media = await repo.readMedia(imageUrl.slice("supabase://".length));
    return media ? { bytes: media.bytes, contentType: media.contentType } : null;
  }
  if (imageUrl.startsWith("/media/")) {
    const media = await repo.readMedia(imageUrl.slice("/media/".length));
    return media ? { bytes: media.bytes, contentType: media.contentType } : null;
  }
  // An imported product image that lives on the merchant's CDN.
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    return { bytes: Buffer.from(await response.arrayBuffer()), contentType };
  } catch {
    return null;
  }
};

const mockOptions: MockProviderOptions = {
  loadGarment: garmentLoader,
  liveWidth: 540,
  photoWidth: 720,
};

const providers = new Map<string, TryOnProvider>([
  ["mock", createMockProvider(mockOptions)],
  [
    "http",
    createHttpTryOnProvider({
      baseUrl: config.provider.baseUrl,
      apiKey: config.provider.apiKey,
      loadGarment: garmentLoader,
    }),
  ],
  [
    // Real Decart sessions, brokered through the raritone-live-vto backend.
    // The permanent Decart key lives in that backend's .env, never here.
    "live-vto",
    createLiveVtoProvider({
      baseUrl: config.liveVto.baseUrl,
      connectTimeoutMs: config.provider.liveStartTimeoutMs,
    }),
  ],
]);

/** A concrete vendor adapter can be registered here without touching the routes. */
export function registerProvider(name: string, provider: TryOnProvider): void {
  providers.set(name, provider);
}

export function activeProvider(): TryOnProvider {
  if (config.providerKillSwitch) {
    // A disabled provider still resolves so the client receives a structured
    // "unavailable" error with a photo-mode fallback, not a 500.
    return providers.get(config.provider.adapter) ?? providers.get("mock")!;
  }
  const provider = providers.get(config.provider.adapter);
  if (provider) return provider;
  process.stdout.write(
    `[raritone] unknown provider "${config.provider.adapter}", falling back to mock\n`,
  );
  return providers.get("mock")!;
}

export function listProviders(): { name: string; providerClass: string }[] {
  return [...providers.values()].map((p) => ({ name: p.name, providerClass: p.providerClass }));
}
