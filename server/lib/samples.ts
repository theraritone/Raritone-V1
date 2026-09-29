import sharp from "sharp";
import { SAMPLE_GARMENTS, garmentSvg, type GarmentArtSpec } from "../../shared/garmentArt.js";
import { repo } from "./db.js";
import type { WardrobeItem } from "../../shared/types.js";

/**
 * The starter carousel.
 *
 * The PRD calls for "a small starter set [that] explains the garment carousel
 * using generic or licensed items". These are original vector garments authored
 * in this repo, rasterized here and seeded into each account's wardrobe on first
 * launch, so a sample behaves exactly like an imported item: same row, same
 * storage, same try-on path, same favourite toggle. Nothing in the UI special-
 * cases "sample".
 *
 * Seeding is idempotent — it runs on every bootstrap but only inserts when the
 * account has no sample items yet.
 */

const SAMPLE_WIDTH = 600;
const SAMPLE_HEIGHT = 720;

let rasterCache: Map<string, string> | null = null;

/** Rasterized PNG data URLs, keyed by sample id. Rendered once per process. */
export async function sampleImageDataUrls(): Promise<Map<string, string>> {
  if (rasterCache) return rasterCache;
  rasterCache = new Map();
  for (const spec of SAMPLE_GARMENTS) {
    const png = await sharp(Buffer.from(garmentSvg(spec)))
      .resize(SAMPLE_WIDTH, SAMPLE_HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    rasterCache.set(spec.id, `data:image/png;base64,${png.toString("base64")}`);
  }
  return rasterCache;
}

export function sampleSpecs(): GarmentArtSpec[] {
  return SAMPLE_GARMENTS;
}

/** Ensures the account has the starter set. Returns the seeded items. */
export async function ensureSampleItems(userId: string): Promise<WardrobeItem[]> {
  const existing = await repo.listItems(userId);
  const alreadySeeded = existing.filter((item) => item.source === "sample");
  if (alreadySeeded.length > 0) return alreadySeeded;

  const images = await sampleImageDataUrls();
  const created: WardrobeItem[] = [];
  for (const spec of SAMPLE_GARMENTS) {
    const imageUrl = images.get(spec.id);
    if (!imageUrl) continue;
    created.push(
      await repo.createItem({
        userId,
        name: spec.name,
        imageUrl,
        category: spec.category,
        source: "sample",
        // Samples are drawn by us, so they are known-good inputs: the launch
        // category, passed quality checks, nothing to review.
        qualityState: "ready",
        sourceUrl: null,
        sourceLabel: "Raritone sample",
      }),
    );
  }
  return created;
}
