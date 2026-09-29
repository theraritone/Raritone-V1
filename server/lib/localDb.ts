import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Repository } from "../../shared/repository.js";
import type {
  LinkImportPreview,
  Look,
  ProfileStats,
  SessionProfile,
  ShareLink,
  Story,
  UsageLedger,
  UserId,
  WardrobeItem,
} from "../../shared/types.js";
import { config } from "../env.js";

/**
 * Zero-config persistence. Same contract as the Supabase driver, backed by JSON
 * files under DATA_DIR and blobs under DATA_DIR/media. This is what runs on a
 * fresh clone so the whole core loop is verifiable on a phone immediately.
 *
 * Writes are serialised through a single promise chain, which is enough for a
 * single-process local driver and keeps the Supabase driver honest.
 */
interface DbShape {
  sessions: Record<string, SessionProfile>;
  deviceIndex: Record<string, string>;
  items: Record<string, WardrobeItem>;
  looks: Record<string, Look>;
  shares: Record<string, ShareLink & { lookId: string }>;
  stories: Record<string, Story>;
  usage: Record<
    string,
    {
      photoUsed: number;
      liveSecondsUsed: number;
      guestTryOnConsumed: boolean;
      costSpentCents: number;
      windowStartedAt: string;
    }
  >;
  activity: Record<string, string[]>;
  imports: Record<string, LinkImportPreview>;
  globalCostCents: number;
}

const EMPTY: DbShape = {
  sessions: {},
  deviceIndex: {},
  items: {},
  looks: {},
  shares: {},
  stories: {},
  usage: {},
  activity: {},
  imports: {},
  globalCostCents: 0,
};

const root = resolve(process.cwd(), config.dataDir);
const dbFile = resolve(root, "db.json");
const mediaDir = resolve(root, "media");

let cache: DbShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function ensureDirs(): void {
  mkdirSync(root, { recursive: true });
  mkdirSync(mediaDir, { recursive: true });
}

function load(): DbShape {
  if (cache) return cache;
  ensureDirs();
  if (!existsSync(dbFile)) {
    cache = structuredClone(EMPTY);
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(dbFile, "utf8")) as Partial<DbShape>;
    cache = { ...structuredClone(EMPTY), ...parsed };
  } catch {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

/**
 * Writes are queued so a burst of concurrent requests cannot interleave and
 * produce a truncated db.json. A single-process local driver only needs this
 * much; the Supabase driver has none of this to worry about.
 */
function persist(): void {
  const snapshot = JSON.stringify(load(), null, 2);
  writeChain = writeChain.then(() => {
    ensureDirs();
    writeFileSync(dbFile, snapshot, "utf8");
  });
}

function allowanceFor(userId: UserId) {
  const isGuest = load().sessions[userId]?.isGuest ?? true;
  return isGuest
    ? { photo: config.guest.photoAllowance, live: config.guest.liveSecondsAllowance }
    : { photo: config.free.photoAllowance, live: config.free.liveSecondsAllowance };
}

function usageFor(userId: UserId): NonNullable<DbShape["usage"][string]> {
  const db = load();
  db.usage[userId] ??= {
    photoUsed: 0,
    liveSecondsUsed: 0,
    guestTryOnConsumed: false,
    costSpentCents: 0,
    windowStartedAt: new Date().toISOString(),
  };
  return db.usage[userId];
}

function toLedger(userId: UserId): UsageLedger {
  const usage = usageFor(userId);
  const { photo, live } = allowanceFor(userId);
  return {
    photoRemaining: Math.max(0, photo - usage.photoUsed),
    photoAllowance: photo,
    liveSecondsRemaining: Math.max(0, live - usage.liveSecondsUsed),
    liveSecondsAllowance: live,
    windowResetsAt: new Date(
      new Date(usage.windowStartedAt).getTime() + config.usageWindowHours * 3600_000,
    ).toISOString(),
    guestTryOnConsumed: usage.guestTryOnConsumed,
    costCapCents: config.cost.globalCapCents,
    costSpentCents: usage.costSpentCents,
  };
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function randomName(): string {
  return randomUUID();
}

function randomHandle(): string {
  return `guest_${randomUUID().slice(0, 8)}`;
}

export function createLocalRepository(): Repository {
  const mediaUrl = (storagePath: string) => `/media/${storagePath}`;

  return {
    driver: "local",

    async getOrCreateSession(deviceId) {
      const db = load();
      const existing = db.deviceIndex[deviceId];
      if (existing && db.sessions[existing]) return db.sessions[existing];

      const userId = deviceId;
      const profile: SessionProfile = {
        userId,
        deviceId,
        displayName: "Guest",
        handle: randomHandle(),
        avatarUrl: null,
        isGuest: true,
        createdAt: new Date().toISOString(),
        storageDriver: "local",
      };
      db.sessions[userId] = profile;
      db.deviceIndex[deviceId] = userId;
      persist();
      return profile;
    },

    async findByDevice(deviceId) {
      const db = load();
      const userId = db.deviceIndex[deviceId];
      return userId ? (db.sessions[userId] ?? null) : null;
    },

    async updateProfile(userId, patch) {
      const db = load();
      const existing = db.sessions[userId];
      if (!existing) throw new Error("session_not_found");
      const next: SessionProfile = {
        ...existing,
        displayName: patch.displayName?.trim() || existing.displayName,
        handle: patch.handle?.trim() || existing.handle,
        avatarUrl: patch.avatarUrl === undefined ? existing.avatarUrl : patch.avatarUrl,
      };
      db.sessions[userId] = next;
      persist();
      return next;
    },

    async touchActivity(userId, day) {
      const db = load();
      const days = (db.activity[userId] ??= []);
      if (!days.includes(day)) {
        days.push(day);
        days.sort();
        persist();
      }
    },

    async readActivity(userId) {
      return load().activity[userId] ?? [];
    },

    async listItems(userId) {
      return Object.values(load().items)
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getItem(userId, itemId) {
      const item = load().items[itemId];
      return item && item.userId === userId ? item : null;
    },

    async createItem(input) {
      const db = load();
      const item: WardrobeItem = {
        id: randomName(),
        userId: input.userId,
        name: input.name.trim() || "Untitled garment",
        imageUrl: input.imageUrl,
        category: input.category,
        source: input.source,
        qualityState: input.qualityState,
        ownership: input.ownership ?? "considering",
        sourceUrl: input.sourceUrl ?? null,
        sourceLabel: input.sourceLabel ?? null,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        tryOnCount: 0,
      };
      db.items[item.id] = item;
      persist();
      return item;
    },

    async updateItem(userId, itemId, patch) {
      const db = load();
      const existing = db.items[itemId];
      if (!existing || existing.userId !== userId) return null;
      const next: WardrobeItem = { ...existing, ...patch };
      db.items[itemId] = next;
      persist();
      return next;
    },

    async deleteItem(userId, itemId) {
      const db = load();
      const existing = db.items[itemId];
      if (!existing || existing.userId !== userId) return false;
      delete db.items[itemId];
      // A look is deleted independently; removing a garment must not silently
      // delete generated output the user kept.
      persist();
      return true;
    },

    async markItemUsed(userId, itemId) {
      const db = load();
      const existing = db.items[itemId];
      if (!existing || existing.userId !== userId) return;
      existing.lastUsedAt = new Date().toISOString();
      existing.tryOnCount += 1;
      persist();
    },

    async saveLook(input) {
      const db = load();
      const look: Look = {
        id: randomName(),
        userId: input.userId,
        itemId: input.itemId,
        imageUrl: input.imageUrl,
        kind: input.kind,
        aiLabel: "AI try-on",
        createdAt: new Date().toISOString(),
        isFavorite: false,
      };
      db.looks[look.id] = look;
      persist();
      return look;
    },

    async listLooks(userId, limit = 60) {
      return Object.values(load().looks)
        .filter((look) => look.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async setLookFavorite(userId, lookId, isFavorite) {
      const db = load();
      const existing = db.looks[lookId];
      if (!existing || existing.userId !== userId) return null;
      existing.isFavorite = isFavorite;
      persist();
      return existing;
    },

    async deleteLook(userId, lookId) {
      const db = load();
      const existing = db.looks[lookId];
      if (!existing || existing.userId !== userId) return false;
      delete db.looks[lookId];
      persist();
      return true;
    },

    async createShareLink(userId, lookId, ttlHours) {
      const db = load();
      // A share link is only meaningful for a look this account actually owns.
      const look = db.looks[lookId];
      if (!look || look.userId !== userId) throw new Error("look_not_found");
      const token = randomUUID().replace(/-/g, "");
      const share: ShareLink & { lookId: string } = {
        id: randomName(),
        lookId,
        token,
        url: `${config.publicOrigin || ""}/s/${token}`,
        expiresAt: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
        revokedAt: null,
      };
      db.shares[share.id] = share;
      persist();
      return share;
    },

    async revokeShareLink(userId, shareId) {
      const db = load();
      const share = db.shares[shareId];
      if (!share) return false;
      const look = db.looks[share.lookId];
      if (!look || look.userId !== userId) return false;
      share.revokedAt = new Date().toISOString();
      persist();
      return true;
    },

    async createStory(input) {
      const db = load();
      const story: Story = {
        id: randomName(),
        userId: input.userId,
        imageUrl: input.imageUrl,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + input.ttlHours * 3600_000).toISOString(),
        aiLabel: "AI try-on",
      };
      db.stories[story.id] = story;
      persist();
      return story;
    },

    async listStories(userId) {
      const now = Date.now();
      const db = load();
      return Object.values(db.stories)
        .filter((s) => s.userId === userId && new Date(s.expiresAt).getTime() > now)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async purgeExpiredStories(userId) {
      const db = load();
      const now = Date.now();
      let removed = 0;
      for (const [id, story] of Object.entries(db.stories)) {
        if (story.userId === userId && new Date(story.expiresAt).getTime() <= now) {
          delete db.stories[id];
          removed += 1;
        }
      }
      if (removed) persist();
      return removed;
    },

    async readUsage(userId) {
      return toLedger(userId);
    },

    async consumePhoto(userId) {
      const usage = usageFor(userId);
      usage.photoUsed += 1;
      usage.guestTryOnConsumed = true;
      persist();
      return toLedger(userId);
    },

    async consumeLiveSeconds(userId, seconds) {
      const usage = usageFor(userId);
      usage.liveSecondsUsed += Math.max(0, Math.round(seconds));
      persist();
      return toLedger(userId);
    },

    async refundPhoto(userId) {
      const usage = usageFor(userId);
      usage.photoUsed = Math.max(0, usage.photoUsed - 1);
      persist();
      return toLedger(userId);
    },

    async addCostCents(userId, cents) {
      const db = load();
      usageFor(userId).costSpentCents += cents;
      db.globalCostCents += cents;
      persist();
    },

    async globalCostSpentCents() {
      return load().globalCostCents;
    },

    async putMedia({ userId, bytes, contentType, kind }) {
      ensureDirs();
      const ext = EXT[contentType] ?? "bin";
      const dir = resolve(mediaDir, userId, kind);
      mkdirSync(dir, { recursive: true });
      const name = `${randomName()}.${ext}`;
      writeFileSync(resolve(dir, name), bytes);
      const storagePath = `${userId}/${kind}/${name}`;
      return { url: mediaUrl(storagePath), storagePath };
    },

    async readMedia(storagePath) {
      const safe = storagePath.replace(/\\/g, "/").replace(/\.\./g, "");
      const file = resolve(mediaDir, safe);
      if (!file.startsWith(mediaDir) || !existsSync(file)) return null;
      const ext = file.split(".").pop() ?? "bin";
      const contentType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
      return { bytes: readFileSync(file), contentType };
    },

    async deleteMedia(storagePath) {
      const safe = storagePath.replace(/\\/g, "/").replace(/\.\./g, "");
      const file = resolve(mediaDir, safe);
      if (!file.startsWith(mediaDir) || !existsSync(file)) return false;
      unlinkSync(file);
      return true;
    },

    async resolveMediaUrl(url) {
      // Local media is already served from a same-origin path.
      return url;
    },

    async cacheImportPreview(deviceId, url, preview) {
      load().imports[`${deviceId}:${createHash("sha1").update(url).digest("hex")}`] = preview;
      persist();
    },

    async readCachedImportPreview(deviceId, url) {
      return load().imports[`${deviceId}:${createHash("sha1").update(url).digest("hex")}`] ?? null;
    },

    async stats(userId) {
      const db = load();
      const items = Object.values(db.items).filter((i) => i.userId === userId);
      const looks = Object.values(db.looks).filter((l) => l.userId === userId);
      const weekAgo = Date.now() - 7 * 24 * 3600_000;
      const days = (db.activity[userId] ?? []).slice().sort().reverse();
      let streak = 0;
      for (let i = 0; i < days.length; i += 1) {
        const expected = new Date();
        expected.setHours(0, 0, 0, 0);
        expected.setDate(expected.getDate() - (i === 0 ? 0 : i));
        const iso = expected.toISOString().slice(0, 10);
        if (days[i] === iso) streak += 1;
        else if (i === 0) continue;
        else break;
      }
      const tryOnsThisWeek = items.reduce(
        (sum, item) => sum + (item.lastUsedAt && new Date(item.lastUsedAt).getTime() > weekAgo ? 1 : 0),
        0,
      );
      return {
        tryOnsThisWeek,
        wardrobeCount: items.length,
        favoritesCount: items.filter((i) => i.isFavorite).length,
        dayStreak: streak,
        looksThisWeek: looks.filter(
          (l) => new Date(l.createdAt).getTime() > weekAgo,
        ).length,
      } satisfies ProfileStats;
    },
  };
}

/** Used by the dev-only media route and by the Supabase migration notes. */
export function localMediaRoot(): string {
  ensureDirs();
  return mediaDir;
}

export function listLocalMedia(): string[] {
  ensureDirs();
  return readdirSync(mediaDir);
}
