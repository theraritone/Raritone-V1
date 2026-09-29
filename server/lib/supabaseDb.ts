import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository } from "../../shared/repository.js";
import type {
  GarmentCategory,
  LinkImportPreview,
  Look,
  OwnershipState,
  ProfileStats,
  QualityState,
  SessionProfile,
  ShareLink,
  SourceType,
  Story,
  UsageLedger,
  WardrobeItem,
} from "../../shared/types.js";
import { config } from "../env.js";

/**
 * Postgres + Storage implementation. Every query is scoped by `user_id`, and the
 * RLS policies in `server/supabase/schema.sql` enforce the same rule, so a
 * mistake here still cannot read another user's wardrobe.
 *
 * Media is never stored as a permanent public URL. `putMedia` records a
 * `supabase://bucket/path` reference; `resolveMediaUrl` mints a short-lived
 * signed URL at the API boundary (PRD "Security requirements").
 */
type Row = Record<string, unknown>;

const SIGNED_URL_TTL_SECONDS = 3600;

export function createSupabaseRepository(): Repository {
  const service: SupabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = () => new Date().toISOString();
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");

  function mapItem(row: Row): WardrobeItem {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name ?? "Untitled garment"),
      imageUrl: String(row.image_url),
      category: row.category as GarmentCategory,
      source: row.source as SourceType,
      qualityState: row.quality_state as QualityState,
      ownership: (row.ownership as OwnershipState) ?? "considering",
      sourceUrl: (row.source_url as string | null) ?? null,
      sourceLabel: (row.source_label as string | null) ?? null,
      isFavorite: Boolean(row.is_favorite),
      createdAt: String(row.created_at),
      lastUsedAt: (row.last_used_at as string | null) ?? null,
      tryOnCount: Number(row.try_on_count ?? 0),
    };
  }

  function mapLook(row: Row): Look {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      itemId: (row.item_id as string | null) ?? null,
      imageUrl: String(row.image_url),
      kind: row.kind as "photo" | "clip",
      aiLabel: String(row.ai_label ?? "AI try-on"),
      createdAt: String(row.created_at),
      isFavorite: Boolean(row.is_favorite),
    };
  }

  function mapStory(row: Row): Story {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      imageUrl: String(row.image_url),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      aiLabel: String(row.ai_label ?? "AI try-on"),
    };
  }

  /**
   * supabase-js builders are invariant in their response generics, so this takes
   * the awaited shape and re-applies the caller's expectation.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function must<T>(p: PromiseLike<any>): Promise<T> {
    const { data, error } = (await p) as {
      data: unknown;
      error: { message: string } | null;
    };
    if (error) throw new Error(`supabase: ${error.message}`);
    return data as T;
  }

  async function ensureAuthUser(userId: string): Promise<void> {
    // Guests have no password. The auth row only has to exist so a token
    // carrying `sub` is accepted by PostgREST under the `authenticated` role.
    const { data } = await service.auth.admin.getUserById(userId);
    if (data?.user) return;
    await service.auth.admin
      .createUser({ id: userId, email: `${userId}@guest.raritone.invalid`, email_confirm: true })
      .then(() => undefined)
      .catch(() => undefined);
  }

  async function resolveUserIdForDevice(deviceId: string): Promise<string> {
    const { data } = await service
      .from("profiles")
      .select("id")
      .eq("device_id", deviceId)
      .maybeSingle();
    return data ? String(data.id) : randomUUID();
  }

  async function loadProfile(userId: string, deviceId: string | null): Promise<SessionProfile> {
    const { data } = await service.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) return mapProfile(data);
    if (!deviceId) throw new Error("profile_not_found");

    const row = await must<Row>(
      service
        .from("profiles")
        .upsert(
          {
            id: userId,
            device_id: deviceId,
            display_name: "Guest",
            handle: `guest_${userId.slice(0, 8)}`,
            is_guest: true,
            created_at: nowIso(),
          },
          { onConflict: "id" },
        )
        .select(),
    );
    await ensureAuthUser(userId);
    return mapProfile((row[0] as Row));
  }

  function mapProfile(row: Row): SessionProfile {
    const userId = String(row.id);
    return {
      userId,
      deviceId: String(row.device_id),
      displayName: String(row.display_name ?? "Guest"),
      handle: String(row.handle ?? `guest_${userId.slice(0, 8)}`),
      avatarUrl: (row.avatar_url as string | null) ?? null,
      isGuest: Boolean(row.is_guest),
      createdAt: String((row.created_at as string | undefined) ?? nowIso()),
      storageDriver: "supabase",
    };
  }

  return {
    driver: "supabase",

    async getOrCreateSession(deviceId) {
      const userId = await resolveUserIdForDevice(deviceId);
      return loadProfile(userId, deviceId);
    },

    async findByDevice(deviceId) {
      const { data } = await service
        .from("profiles")
        .select("*")
        .eq("device_id", deviceId)
        .maybeSingle();
      return data ? mapProfile(data) : null;
    },

    async updateProfile(userId, patch) {
      const body: Row = {};
      if (patch.displayName !== undefined) body.display_name = patch.displayName.trim();
      if (patch.handle !== undefined) body.handle = patch.handle.trim();
      if (patch.avatarUrl !== undefined) body.avatar_url = patch.avatarUrl;
      await must(service.from("profiles").update(body).eq("id", userId).select());
      return loadProfile(userId, null);
    },

    async touchActivity(userId, day) {
      await must(
        service
          .from("user_activity")
          .upsert(
            { user_id: userId, day },
            { onConflict: "user_id,day", ignoreDuplicates: true },
          ),
      );
    },

    async readActivity(userId) {
      const rows = await must<{ day: string }[]>(
        service.from("user_activity").select("day").eq("user_id", userId).order("day"),
      );
      return rows.map((r) => r.day);
    },

    async listItems(userId) {
      const rows = await must<Row[]>(
        service
          .from("wardrobe_items")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      );
      return rows.map(mapItem);
    },

    async getItem(userId, itemId) {
      const { data } = await service
        .from("wardrobe_items")
        .select("*")
        .eq("user_id", userId)
        .eq("id", itemId)
        .maybeSingle();
      return data ? mapItem(data) : null;
    },

    async createItem(input) {
      const row = await must<Row>(
        service
          .from("wardrobe_items")
          .insert({
            id: randomUUID(),
            user_id: input.userId,
            name: input.name.trim() || "Untitled garment",
            image_url: input.imageUrl,
            category: input.category,
            source: input.source,
            quality_state: input.qualityState,
            ownership: input.ownership ?? "considering",
            source_url: input.sourceUrl ?? null,
            source_label: input.sourceLabel ?? null,
            created_at: nowIso(),
          })
          .select(),
      );
      return mapItem(row[0] as Row);
    },

    async updateItem(userId, itemId, patch) {
      const body: Row = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.category !== undefined) body.category = patch.category;
      if (patch.qualityState !== undefined) body.quality_state = patch.qualityState;
      if (patch.ownership !== undefined) body.ownership = patch.ownership;
      if (patch.isFavorite !== undefined) body.is_favorite = patch.isFavorite;
      const { data } = await service
        .from("wardrobe_items")
        .update(body)
        .eq("user_id", userId)
        .eq("id", itemId)
        .select()
        .maybeSingle();
      return data ? mapItem(data) : null;
    },

    async deleteItem(userId, itemId) {
      const { data } = await service
        .from("wardrobe_items")
        .delete()
        .eq("user_id", userId)
        .eq("id", itemId)
        .select("id");
      return (data?.length ?? 0) > 0;
    },

    async markItemUsed(userId, itemId) {
      const { data: row } = await service
        .from("wardrobe_items")
        .select("try_on_count")
        .eq("user_id", userId)
        .eq("id", itemId)
        .maybeSingle();
      await must(
        service
          .from("wardrobe_items")
          .update({
            last_used_at: nowIso(),
            try_on_count: Number(row?.try_on_count ?? 0) + 1,
          })
          .eq("user_id", userId)
          .eq("id", itemId),
      );
    },

    async saveLook(input) {
      const row = await must<Row>(
        service
          .from("looks")
          .insert({
            id: randomUUID(),
            user_id: input.userId,
            item_id: input.itemId,
            image_url: input.imageUrl,
            kind: input.kind,
            ai_label: "AI try-on",
            created_at: nowIso(),
          })
          .select(),
      );
      return mapLook(row[0] as Row);
    },

    async listLooks(userId, limit = 60) {
      const rows = await must<Row[]>(
        service
          .from("looks")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit),
      );
      return rows.map(mapLook);
    },

    async setLookFavorite(userId, lookId, isFavorite) {
      const { data } = await service
        .from("looks")
        .update({ is_favorite: isFavorite })
        .eq("user_id", userId)
        .eq("id", lookId)
        .select()
        .maybeSingle();
      return data ? mapLook(data) : null;
    },

    async deleteLook(userId, lookId) {
      const { data } = await service
        .from("looks")
        .delete()
        .eq("user_id", userId)
        .eq("id", lookId)
        .select("id");
      return (data?.length ?? 0) > 0;
    },

    async createShareLink(userId, lookId, ttlHours) {
      // A share link is only meaningful for a look this account actually owns.
      const owned = await must<Row[]>(
        service.from("looks").select("id").eq("user_id", userId).eq("id", lookId),
      );
      if (owned.length === 0) throw new Error("look_not_found");
      const token = randomUUID().replace(/-/g, "");
      const row = await must<Row>(
        service
          .from("share_links")
          .insert({
            id: randomUUID(),
            user_id: userId,
            look_id: lookId,
            token,
            url: `${config.publicOrigin || ""}/s/${token}`,
            expires_at: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
            created_at: nowIso(),
          })
          .select(),
      );
      const r = row[0] as Row;
      return {
        id: String(r.id),
        token: String(r.token),
        url: String(r.url),
        expiresAt: String(r.expires_at),        revokedAt: null,
      } satisfies ShareLink;
    },

    async revokeShareLink(userId, shareId) {
      const { data } = await service
        .from("share_links")
        .update({ revoked_at: nowIso() })
        .eq("user_id", userId)
        .eq("id", shareId)
        .select("id");
      return (data?.length ?? 0) > 0;
    },

    async createStory(input) {
      const row = await must<Row>(
        service
          .from("stories")
          .insert({
            id: randomUUID(),
            user_id: input.userId,
            image_url: input.imageUrl,
            ai_label: "AI try-on",
            created_at: nowIso(),
            expires_at: new Date(Date.now() + input.ttlHours * 3600_000).toISOString(),
          })
          .select(),
      );
      return mapStory(row[0] as Row);
    },

    async listStories(userId) {
      const rows = await must<Row[]>(
        service
          .from("stories")
          .select("*")
          .eq("user_id", userId)
          .gt("expires_at", nowIso())
          .order("created_at", { ascending: false }),
      );
      return rows.map(mapStory);
    },

    async purgeExpiredStories(userId) {
      const { data } = await service
        .from("stories")
        .delete()
        .eq("user_id", userId)
        .lte("expires_at", nowIso())
        .select("id");
      return data?.length ?? 0;
    },

    async readUsage(userId) {
      return toLedger(await readUsageRow(service, userId));
    },

    async consumePhoto(userId) {
      const row = await readUsageRow(service, userId);
      row.photo_used += 1;
      row.guest_try_on_consumed = true;
      await must(service.from("usage_ledger").upsert(row, { onConflict: "user_id" }));
      return toLedger(row);
    },

    async consumeLiveSeconds(userId, seconds) {
      const row = await readUsageRow(service, userId);
      row.live_seconds_used += Math.max(0, Math.round(seconds));
      await must(service.from("usage_ledger").upsert(row, { onConflict: "user_id" }));
      return toLedger(row);
    },

    async refundPhoto(userId) {
      const row = await readUsageRow(service, userId);
      row.photo_used = Math.max(0, row.photo_used - 1);
      await must(service.from("usage_ledger").upsert(row, { onConflict: "user_id" }));
      return toLedger(row);
    },

    async addCostCents(userId, cents) {
      const row = await readUsageRow(service, userId);
      row.cost_spent_cents += cents;
      await must(service.from("usage_ledger").upsert(row, { onConflict: "user_id" }));
      await service
        .from("cost_ledger")
        .insert({ id: randomUUID(), user_id: userId, cents, created_at: nowIso() });
    },

    async globalCostSpentCents() {
      const { data } = await service.from("cost_ledger").select("cents");
      return ((data ?? []) as Row[]).reduce((sum, r) => sum + Number(r.cents ?? 0), 0);
    },

    async putMedia({ userId, bytes, contentType, kind }) {
      const bucket = kind === "garment" ? config.supabase.bucketGarments : config.supabase.bucketMedia;
      const storagePath = `${userId}/${kind}/${randomUUID()}`;
      const { error } = await service.storage.from(bucket).upload(storagePath, bytes, {
        contentType,
        upsert: false,
      });
      if (error) throw new Error(`supabase storage: ${error.message}`);
      // Private buckets: only the reference is persisted.
      return { url: `supabase://${bucket}/${storagePath}`, storagePath: `${bucket}/${storagePath}` };
    },

    async readMedia(storagePath) {
      const slash = storagePath.indexOf("/");
      if (slash <= 0) return null;
      const { data, error } = await service.storage
        .from(storagePath.slice(0, slash))
        .download(storagePath.slice(slash + 1));
      if (error || !data) return null;
      return {
        bytes: Buffer.from(await data.arrayBuffer()),
        contentType: data.type || "application/octet-stream",
      };
    },

    async deleteMedia(storagePath) {
      const slash = storagePath.indexOf("/");
      if (slash <= 0) return false;
      const { error } = await service.storage
        .from(storagePath.slice(0, slash))
        .remove([storagePath.slice(slash + 1)]);
      return !error;
    },

    async resolveMediaUrl(url) {
      if (!url.startsWith("supabase://")) return url;
      const rest = url.slice("supabase://".length);
      const slash = rest.indexOf("/");
      if (slash <= 0) return url;
      const bucket = rest.slice(0, slash);
      const path = rest.slice(slash + 1);
      const { data, error } = await service.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return error ? url : data.signedUrl;
    },

    async cacheImportPreview(deviceId, url, preview) {
      await must(
        service.from("import_previews").upsert(
          { device_id: deviceId, url_hash: hash(url), url, preview, created_at: nowIso() },
          { onConflict: "device_id,url_hash" },
        ),
      );
    },

    async readCachedImportPreview(deviceId, url) {
      const { data } = await service
        .from("import_previews")
        .select("preview")
        .eq("device_id", deviceId)
        .eq("url_hash", hash(url))
        .maybeSingle();
      return (data?.preview as LinkImportPreview | undefined) ?? null;
    },

    async stats(userId) {
      const items = await must<Row[]>(
        service.from("wardrobe_items").select("*").eq("user_id", userId),
      );
      const looks = await must<Row[]>(service.from("looks").select("*").eq("user_id", userId));
      const days = await must<{ day: string }[]>(
        service.from("user_activity").select("day").eq("user_id", userId).order("day"),
      );
      const weekAgo = Date.now() - 7 * 24 * 3600_000;
      const ordered = days.map((d) => d.day);
      let streak = 0;
      for (let i = 0; i < ordered.length; i += 1) {
        const expected = new Date();
        expected.setHours(0, 0, 0, 0);
        expected.setDate(expected.getDate() - i);
        if (ordered[ordered.length - 1 - i] === expected.toISOString().slice(0, 10)) streak += 1;
        else if (i === 0) continue;
        else break;
      }
      return {
        tryOnsThisWeek: items.filter(
          (i) => i.last_used_at && new Date(String(i.last_used_at)).getTime() > weekAgo,
        ).length,
        wardrobeCount: items.length,
        favoritesCount: items.filter((i) => Boolean(i.is_favorite)).length,
        dayStreak: streak,
        looksThisWeek: looks.filter((l) => new Date(String(l.created_at)).getTime() > weekAgo)
          .length,
      } satisfies ProfileStats;
    },
  };
}

// --- usage helpers -------------------------------------------------------

interface UsageRow {
  user_id: string;
  photo_used: number;
  live_seconds_used: number;
  guest_try_on_consumed: boolean;
  cost_spent_cents: number;
  window_started_at: string;
}

async function readUsageRow(client: SupabaseClient, userId: string): Promise<UsageRow> {
  const { data } = await client.from("usage_ledger").select("*").eq("user_id", userId).maybeSingle();
  if (data) {
    return {
      user_id: userId,
      photo_used: Number(data.photo_used ?? 0),
      live_seconds_used: Number(data.live_seconds_used ?? 0),
      guest_try_on_consumed: Boolean(data.guest_try_on_consumed),
      cost_spent_cents: Number(data.cost_spent_cents ?? 0),
      window_started_at: String(data.window_started_at),
    };
  }
  const row: UsageRow = {
    user_id: userId,
    photo_used: 0,
    live_seconds_used: 0,
    guest_try_on_consumed: false,
    cost_spent_cents: 0,
    window_started_at: new Date().toISOString(),
  };
  await client.from("usage_ledger").upsert(row, { onConflict: "user_id" });
  return row;
}

function toLedger(row: UsageRow): UsageLedger {
  const guest = row.guest_try_on_consumed && row.photo_used <= 1;
  const photoAllowance = guest ? config.guest.photoAllowance : config.free.photoAllowance;
  const liveAllowance = guest ? config.guest.liveSecondsAllowance : config.free.liveSecondsAllowance;
  return {
    photoRemaining: Math.max(0, photoAllowance - row.photo_used),
    photoAllowance,
    liveSecondsRemaining: Math.max(0, liveAllowance - row.live_seconds_used),
    liveSecondsAllowance: liveAllowance,
    windowResetsAt: new Date(
      new Date(row.window_started_at).getTime() + config.usageWindowHours * 3600_000,
    ).toISOString(),
    guestTryOnConsumed: row.guest_try_on_consumed,
    costCapCents: config.cost.globalCapCents,
    costSpentCents: row.cost_spent_cents,
  };
}
