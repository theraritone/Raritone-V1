import { Router } from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import type {
  GarmentCategory,
  LinkImportPreview,
  QualityState,
  UserId,
  WardrobeItem,
} from "../../shared/types.js";
import { GARMENT_CATEGORIES, isLaunchCategory, QUALITY_STATES } from "../../shared/types.js";
import { config } from "../env.js";
import { activeProvider, listProviders } from "../provider/index.js";
import { repo } from "../lib/db.js";
import {
  assertUploadable,
  badRequest,
  dataUrlToBuffer,
  handler,
  HttpError,
  notFound,
  param,
} from "../lib/http.js";
import { extractProductPreview, LinkFetchError, normalizeProductUrl } from "../lib/linkImport.js";
import { ensureSampleItems } from "../lib/samples.js";
import {
  cancelPhotoJob,
  endLiveSession,
  pollLiveFrame,
  pollPhotoJob,
  startLiveSession,
  startPhotoJob,
  switchLiveGarment,
} from "../lib/orchestrator.js";

export const api = Router();

const userOf = (req: { userId?: UserId }): UserId => {
  if (!req.userId) throw new HttpError(401, "permission_denied", "No session.", "Reopen the app.");
  return req.userId;
};

function assertCategory(value: unknown): GarmentCategory {
  if (typeof value === "string" && (GARMENT_CATEGORIES as readonly string[]).includes(value)) {
    return value as GarmentCategory;
  }
  return "tops";
}

function assertQuality(value: unknown): QualityState {
  if (typeof value === "string" && (QUALITY_STATES as readonly string[]).includes(value)) {
    return value as QualityState;
  }
  return "ready";
}

/**
 * A garment outside the launch categories cannot be tried on, and the PRD is
 * explicit that this must be visible rather than silently degraded. So the
 * category — not the caller — decides the floor, and an explicit `qualityState`
 * can only ever downgrade from that floor, never promote past it.
 */
function deriveQualityState(requested: unknown, category: GarmentCategory): QualityState {
  const explicit = assertQuality(requested);
  if (!isLaunchCategory(category)) return "unsupported";
  return explicit === "unsupported" ? "ready" : explicit;
}

/** Garment names are short labels, not free text. */
function assertName(value: unknown): string {
  if (typeof value !== "string") throw badRequest("A garment name is required.", "Give it a short name.");
  const name = value.trim();
  if (name.length === 0) throw badRequest("A garment name is required.", "Give it a short name.");
  if (name.length > 80) {
    throw badRequest("That garment name is too long.", "Use 80 characters or fewer.");
  }
  return name;
}

/** Resolve stored media references into something the browser can load. */
async function publicItem(item: WardrobeItem): Promise<WardrobeItem> {
  return { ...item, imageUrl: await repo.resolveMediaUrl(item.imageUrl) };
}

async function assertEligibleForTryOn(
  userId: UserId,
  itemId: string,
): Promise<{ item: WardrobeItem; imageUrl: string }> {
  const item = await repo.getItem(userId, itemId);
  if (!item) throw notFound("That garment is no longer in your wardrobe.", "Pick another item.");
  const imageUrl = await repo.resolveMediaUrl(item.imageUrl);
  return { item, imageUrl };
}

// --- health & bootstrap --------------------------------------------------

api.get(
  "/health",
  handler(async (_req, res) => {
    const provider = activeProvider();
    res.json({
      ok: true,
      storage: repo.driver,
      provider: { name: provider.name, class: provider.providerClass, available: listProviders() },
      killSwitch: config.providerKillSwitch,
      liveAvailable: provider.capabilities.live && config.flags.liveTryOn,
      photoAvailable: provider.capabilities.photo,
    });
  }),
);

api.get(
  "/bootstrap",
  handler(async (req, res) => {
    const userId = userOf(req);
    const profile =
      (await repo.findByDevice(req.deviceId!)) ?? (await repo.getOrCreateSession(req.deviceId!));
    // The starter carousel is seeded into the account, so a sample is an
    // ordinary wardrobe item from the client's point of view.
    const seeded = await ensureSampleItems(userId);
    const items = await Promise.all(
      [...seeded, ...(await repo.listItems(userId)).filter((i) => i.source !== "sample")].map(publicItem),
    );
    const provider = activeProvider();
    const usage = await repo.readUsage(userId);
    await repo.purgeExpiredStories(userId).catch(() => 0);
    res.json({
      session: profile,
      flags: config.flags,
      usage,
      storageDriver: repo.driver,
      items,
      tryOn: {
        liveAvailable: provider.capabilities.live && config.flags.liveTryOn && !config.providerKillSwitch,
        photoAvailable: provider.capabilities.photo && !config.providerKillSwitch,
        providerClass: provider.providerClass,
        renderMode: provider.capabilities.serverFrames ? "server" : "browser",
      },
    });
  }),
);

// --- profile -------------------------------------------------------------

api.patch(
  "/profile",
  handler(async (req, res) => {
    const userId = userOf(req);
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.slice(0, 40) : undefined;
    const handle = typeof req.body?.handle === "string" ? req.body.handle.slice(0, 32) : undefined;
    if (handle && !/^[a-z0-9_]{3,32}$/.test(handle)) {
      throw badRequest("That handle is not valid.", "Use 3–32 lowercase letters, numbers, or _.");
    }
    const profile = await repo.updateProfile(userId, { displayName, handle });
    res.json({ session: profile });
  }),
);

api.get(
  "/stats",
  handler(async (req, res) => {
    res.json(await repo.stats(userOf(req)));
  }),
);

// --- wardrobe items ------------------------------------------------------

api.get(
  "/items",
  handler(async (req, res) => {
    const items = await repo.listItems(userOf(req));
    res.json({ items: await Promise.all(items.map(publicItem)) });
  }),
);

api.get(
  "/items/:id",
  handler(async (req, res) => {
    const { item } = await assertEligibleForTryOn(userOf(req), param(req, "id"));
    res.json({ item: await publicItem(item) });
  }),
);

api.post(
  "/items",
  handler(async (req, res) => {
    const userId = userOf(req);
    const body = req.body ?? {};

    // Two ways in: a direct multipart upload, or a reference to media we already
    // stored (for example an image mirrored during link import).
    let imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    if (!imageUrl && typeof body.imageDataUrl === "string") {
      const { bytes, contentType } = dataUrlToBuffer(body.imageDataUrl);
      assertUploadable(contentType, bytes.byteLength);
      const stored = await repo.putMedia({ userId, bytes, contentType, kind: "garment" });
      imageUrl = stored.url;
    }
    if (!imageUrl) {
      throw badRequest("A garment image is required.", "Choose a photo, or paste a product link.");
    }

    const category = assertCategory(body.category);
    const item = await repo.createItem({
      userId,
      name: assertName(body.name),
      imageUrl,
      category,
      source:
        body.source === "upload" || body.source === "camera_photo" || body.source === "link"
          ? body.source
          : "upload",
      qualityState: deriveQualityState(body.qualityState, category),
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl.slice(0, 500) : null,
      sourceLabel: typeof body.sourceLabel === "string" ? body.sourceLabel.slice(0, 80) : null,
    });
    res.status(201).json({ item: await publicItem(item) });
  }),
);

api.patch(
  "/items/:id",
  handler(async (req, res) => {
    const userId = userOf(req);
    const patch: Parameters<typeof repo.updateItem>[2] = {};
    if (typeof req.body?.name === "string") patch.name = assertName(req.body.name);
    if (req.body?.category !== undefined) {
      const category = assertCategory(req.body.category);
      patch.category = category;
      if (req.body?.qualityState === undefined) {
        patch.qualityState = deriveQualityState(undefined, category);
      }
    }
    if (req.body?.qualityState !== undefined) {
      patch.qualityState = deriveQualityState(req.body.qualityState, patch.category ?? "tops");
    }
    if (typeof req.body?.isFavorite === "boolean") patch.isFavorite = req.body.isFavorite;
    const item = await repo.updateItem(userId, param(req, "id"), patch);
    if (!item) throw notFound("That garment is no longer in your wardrobe.");
    res.json({ item: await publicItem(item) });
  }),
);

api.delete(
  "/items/:id",
  handler(async (req, res) => {
    const userId = userOf(req);
    // Deleting a garment must not delete saved looks; the response says so
    // explicitly so the UI can explain the effect (FR-304).
    const looks = (await repo.listLooks(userId)).filter((l) => l.itemId === param(req, "id")).length;
    const removed = await repo.deleteItem(userId, param(req, "id"));
    if (!removed) throw notFound("That garment is already gone.");
    res.json({ deleted: true, retainedLooks: looks });
  }),
);

// --- link import (FR-201 … FR-203) ---------------------------------------

api.post(
  "/imports/link",
  handler(async (req, res) => {
    if (!config.flags.linkImport) {
      throw new HttpError(
        503,
        "provider_unavailable",
        "Link import is switched off right now.",
        "Upload a screenshot of the garment instead.",
        true,
      );
    }
    const rawUrl = typeof req.body?.url === "string" ? req.body.url : "";
    let canonical: string;
    try {
      canonical = normalizeProductUrl(rawUrl).canonicalUrl;
    } catch (error) {
      if (error instanceof LinkFetchError) {
        res.status(422).json({
          failure: {
            category: error.category,
            message: error.message,
            nextAction: error.nextAction,
            attemptedUrl: rawUrl,
          },
        });
        return;
      }
      throw error;
    }

    // A failed lookup is cached as "nothing found" so a retry does not hammer
    // the origin, and the user keeps the address for the screenshot fallback.
    const preview = await extractProductPreview(canonical).catch(async (error: unknown) => {
      if (error instanceof LinkFetchError) {
        await repo.cacheImportPreview(req.deviceId!, canonical, {
          canonicalUrl: canonical,
          siteName: new URL(canonical).hostname,
          productName: "",
          imageUrl: "",
          candidates: [],
          suggestedCategory: "tops",
          qualityState: "needs_review",
        }).catch(() => undefined);
        res.status(422).json({
          failure: {
            category: error.category,
            message: error.message,
            nextAction: error.nextAction,
            attemptedUrl: canonical,
          },
        });
        return null;
      }
      throw error;
    });
    if (!preview) return;

    await repo.cacheImportPreview(req.deviceId!, canonical, preview);
    res.json({ preview: await withResolvedImage(preview) });
  }),
);

/** Mirror the chosen product image into our own storage so hotlink protection
 *  on the merchant CDN cannot break the wardrobe later. */
async function withResolvedImage(preview: LinkImportPreview): Promise<LinkImportPreview> {
  return { ...preview, imageUrl: preview.imageUrl };
}

api.post(
  "/imports/confirm",
  handler(async (req, res) => {
    const userId = userOf(req);
    const body = req.body ?? {};
    const rawUrl = typeof body.url === "string" ? body.url : "";
    const cached = rawUrl
      ? await repo.readCachedImportPreview(req.deviceId!, rawUrl)
      : null;

    const productName =
      (typeof body.name === "string" && body.name.trim()) || cached?.productName || "Imported garment";
    const externalImage =
      (typeof body.imageUrl === "string" && body.imageUrl) || cached?.imageUrl || "";
    if (!externalImage) {
      throw badRequest("No product image was found for that link.", "Upload a screenshot instead.");
    }

    const category = assertCategory(body.category ?? cached?.suggestedCategory);
    // A category outside the launch set is saved honestly as Experimental rather
    // than pretending it can be tried on.
    const qualityState: QualityState =
      (typeof body.qualityState === "string" && assertQuality(body.qualityState)) ||
      (category === "tops" ? "ready" : "experimental");

    let imageUrl = externalImage;
    try {
      // Snapshot the merchant image so the wardrobe does not depend on a hotlink.
      const response = await fetch(externalImage, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        if (contentType.startsWith("image/")) {
          const bytes = Buffer.from(await response.arrayBuffer());
          assertUploadable(contentType, bytes.byteLength);
          const normalized = await sharp(bytes).rotate().resize(1200, 1600, {
            fit: "inside",
            withoutEnlargement: true,
          }).jpeg({ quality: 88 }).toBuffer();
          const stored = await repo.putMedia({
            userId,
            bytes: normalized,
            contentType: "image/jpeg",
            kind: "garment",
          });
          imageUrl = stored.url;
        }
      }
    } catch {
      // Keep the remote URL. It still previews; the wardrobe is not blocked.
    }

    const item = await repo.createItem({
      userId,
      name: productName,
      imageUrl,
      category,
      source: "link",
      qualityState,
      sourceUrl: cached?.canonicalUrl ?? rawUrl,
      sourceLabel: cached?.siteName ?? null,
    });
    res.status(201).json({ item: await publicItem(item) });
  }),
);

// --- photo try-on (FR-107) ----------------------------------------------

api.post(
  "/tryons",
  handler(async (req, res) => {
    const userId = userOf(req);
    const body = req.body ?? {};
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const { item, imageUrl } = await assertEligibleForTryOn(userId, itemId);

    const personFrame = typeof body.personFrame === "string" ? body.personFrame : "";
    if (!personFrame.startsWith("data:image/")) {
      throw badRequest("A camera frame is required for a try-on.", "Allow the camera and try again.");
    }
    if (personFrame.length > 24 * 1024 * 1024) {
      throw badRequest("That camera frame was too large to send.", "Try a photo try-on instead.");
    }

    const clientToken =
      typeof body.clientToken === "string" && body.clientToken.length >= 8
        ? body.clientToken
        : randomUUID();

    const started = await startPhotoJob({
      userId,
      person: {
        frameDataUrl: personFrame,
        width: Number(body.personWidth) || 720,
        height: Number(body.personHeight) || 1280,
        capturedAt: Date.now(),
      },
      garment: {
        itemId: item.id,
        imageUrl,
        category: item.category,
        qualityState: item.qualityState,
      },
      clientToken,
    });
    res.status(202).json({ jobId: started.jobId, garment: started.garment });
  }),
);

api.get(
  "/tryons/:id",
  handler(async (req, res) => {
    res.json(await pollPhotoJob(userOf(req), param(req, "id")));
  }),
);

api.delete(
  "/tryons/:id",
  handler(async (req, res) => {
    await cancelPhotoJob(userOf(req), param(req, "id"));
    res.json({ cancelled: true });
  }),
);

// --- live try-on (FR-104 … FR-106) ---------------------------------------

api.post(
  "/live/sessions",
  handler(async (req, res) => {
    const userId = userOf(req);
    const body = req.body ?? {};
    const { item, imageUrl } = await assertEligibleForTryOn(
      userId,
      typeof body.itemId === "string" ? body.itemId : "",
    );
    const personFrame = typeof body.personFrame === "string" ? body.personFrame : "";
    // A browser-rendered (WebRTC) session takes the person frame straight from
    // the camera to the model, so this server neither asks for nor accepts one.
    // Server-rendered providers still need the frame they composite onto.
    if (activeProvider().capabilities.serverFrames && !personFrame.startsWith("data:image/")) {
      throw badRequest("A camera frame is required to start a try-on.", "Allow the camera and try again.");
    }
    const readiness = await activeProvider().checkReadiness({
      person: {
        frameDataUrl: personFrame,
        width: Number(body.personWidth) || 720,
        height: Number(body.personHeight) || 1280,
        capturedAt: Date.now(),
      },
      hasGarment: true,
      deviceTier: body.deviceTier === "low" || body.deviceTier === "high" ? body.deviceTier : "mid",
      networkMbps: typeof body.networkMbps === "number" ? body.networkMbps : null,
      supportsLive: true,
    });
    if (!readiness.ok) {
      throw new HttpError(422, "invalid_input", readiness.message, readiness.nextAction, true);
    }

    const clientToken =
      typeof body.clientToken === "string" && body.clientToken.length >= 8
        ? body.clientToken
        : randomUUID();

    const session = await startLiveSession({
      userId,
      person: {
        frameDataUrl: personFrame,
        width: Number(body.personWidth) || 720,
        height: Number(body.personHeight) || 1280,
        capturedAt: Date.now(),
      },
      garment: {
        itemId: item.id,
        imageUrl,
        category: item.category,
        qualityState: item.qualityState,
      },
      clientToken,
      networkMbps: typeof body.networkMbps === "number" ? body.networkMbps : null,
    });
    res.status(201).json({
      sessionId: session.sessionId,
      providerClass: session.providerClass,
      garment: session.garment,
      // null for browser-rendered sessions: their pixels never reach this server.
      frame: session.frame,
      expiresAt: session.expiresAt,
      fps: session.fps,
      // Short-lived SDK credentials. Present only when the guest's own browser
      // is the renderer, and never logged or persisted on this side.
      ...(session.browser ? { browser: session.browser } : {}),
    });
  }),
);

api.post(
  "/live/sessions/:id/garment",
  handler(async (req, res) => {
    const userId = userOf(req);
    const itemId = typeof req.body?.itemId === "string" ? req.body.itemId : "";
    const { item, imageUrl } = await assertEligibleForTryOn(userId, itemId);
    const result = await switchLiveGarment(userId, param(req, "id"), {
      itemId: item.id,
      imageUrl,
      category: item.category,
      qualityState: item.qualityState,
    });
    res.json(result);
  }),
);

api.get(
  "/live/sessions/:id/frame",
  handler(async (req, res) => {
    const after = Number(req.query.after ?? 0) || 0;
    const result = await pollLiveFrame(userOf(req), param(req, "id"), after);
    // 204 when the client already holds the newest frame: cheap polling.
    if (!result.frame) res.status(204).end();
    else res.json(result);
  }),
);

api.delete(
  "/live/sessions/:id",
  handler(async (req, res) => {
    await endLiveSession(userOf(req), param(req, "id"), "user_ended");
    res.json({ ended: true });
  }),
);

// --- looks, shares, stories ---------------------------------------------

api.post(
  "/looks",
  handler(async (req, res) => {
    const userId = userOf(req);
    const body = req.body ?? {};
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!imageDataUrl.startsWith("data:image/")) {
      throw badRequest("There is nothing to save yet.", "Capture a try-on first.");
    }
    const { bytes, contentType } = dataUrlToBuffer(imageDataUrl);
    assertUploadable(contentType, bytes.byteLength);
    const stored = await repo.putMedia({ userId, bytes, contentType, kind: "media" });

    let itemId: string | null = null;
    if (typeof body.itemId === "string" && body.itemId) {
      itemId = (await repo.getItem(userId, body.itemId)) ? body.itemId : null;
    }
    const look = await repo.saveLook({
      userId,
      itemId,
      imageUrl: stored.url,
      kind: body.kind === "clip" ? "clip" : "photo",
    });
    res.status(201).json({ look: { ...look, imageUrl: await repo.resolveMediaUrl(look.imageUrl) } });
  }),
);

api.get(
  "/looks",
  handler(async (req, res) => {
    const looks = await repo.listLooks(userOf(req));
    res.json({
      looks: await Promise.all(
        looks.map(async (look) => ({ ...look, imageUrl: await repo.resolveMediaUrl(look.imageUrl) })),
      ),
    });
  }),
);

api.patch(
  "/looks/:id/favorite",
  handler(async (req, res) => {
    const look = await repo.setLookFavorite(
      userOf(req),
      param(req, "id"),
      Boolean(req.body?.isFavorite),
    );
    if (!look) throw notFound("That look has already been deleted.");
    res.json({ look: { ...look, imageUrl: await repo.resolveMediaUrl(look.imageUrl) } });
  }),
);

api.delete(
  "/looks/:id",
  handler(async (req, res) => {
    const removed = await repo.deleteLook(userOf(req), param(req, "id"));
    if (!removed) throw notFound("That look has already been deleted.");
    res.json({ deleted: true });
  }),
);

api.post(
  "/shares",
  handler(async (req, res) => {
    const userId = userOf(req);
    const lookId = typeof req.body?.lookId === "string" ? req.body.lookId : "";
    const looks = await repo.listLooks(userId);
    if (!looks.some((l) => l.id === lookId)) {
      throw notFound("Save this look before sharing it.", "Tap the heart first.");
    }
    const ttlHours = Number(req.body?.ttlHours) > 0 ? Math.min(Number(req.body.ttlHours), 720) : 24;
    res.status(201).json({ share: await repo.createShareLink(userId, lookId, ttlHours) });
  }),
);

api.delete(
  "/shares/:id",
  handler(async (req, res) => {
    const revoked = await repo.revokeShareLink(userOf(req), param(req, "id"));
    if (!revoked) throw notFound("That share link has already been revoked.");
    res.json({ revoked: true });
  }),
);

api.get(
  "/stories",
  handler(async (req, res) => {
    const userId = userOf(req);
    await repo.purgeExpiredStories(userId);
    const stories = await repo.listStories(userId);
    res.json({
      stories: await Promise.all(
        stories.map(async (s) => ({ ...s, imageUrl: await repo.resolveMediaUrl(s.imageUrl) })),
      ),
    });
  }),
);

api.post(
  "/stories",
  handler(async (req, res) => {
    const userId = userOf(req);
    // Feature-flagged. The PRD scopes 24-hour stories to "Could have" and lists a
    // stories feed as an R1 non-goal, so this route 404s unless FLAG_STORIES=true.
    if (!config.flags.stories) {
      throw new HttpError(
        404,
        "not_found",
        "Stories are not available in this release.",
        "Use Share to send this to someone directly.",
        true,
      );
    }
    const body = req.body ?? {};
    const lookId = typeof body.lookId === "string" ? body.lookId : "";
    const looks = await repo.listLooks(userId);
    const look = looks.find((l) => l.id === lookId);
    if (!look) throw notFound("Save this look before posting it to your story.");
    const story = await repo.createStory({
      userId,
      imageUrl: look.imageUrl,
      ttlHours: 24,
    });
    res.status(201).json({ story: { ...story, imageUrl: await repo.resolveMediaUrl(story.imageUrl) } });
  }),
);
