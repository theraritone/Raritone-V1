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
  UserId,
  WardrobeItem,
} from "./types.js";

/**
 * The whole data model behind one interface. `supabaseDb.ts` implements it with
 * Postgres + Storage; `localDb.ts` implements it on disk for zero-config local
 * runs. Routes and the provider adapter never branch on which is active.
 */
export interface Repository {
  readonly driver: "supabase" | "local";

  // Identity — guest sessions are minted from a device id (FR-001).
  getOrCreateSession(deviceId: string): Promise<SessionProfile>;
  updateProfile(
    userId: UserId,
    patch: { displayName?: string; handle?: string; avatarUrl?: string | null },
  ): Promise<SessionProfile>;
  findByDevice(deviceId: string): Promise<SessionProfile | null>;
  /** Last-seen day, used for the profile streak. */
  touchActivity(userId: UserId, day: string): Promise<void>;
  readActivity(userId: UserId): Promise<string[]>;

  // Wardrobe items.
  listItems(userId: UserId): Promise<WardrobeItem[]>;
  getItem(userId: UserId, itemId: string): Promise<WardrobeItem | null>;
  createItem(input: {
    userId: UserId;
    name: string;
    imageUrl: string;
    category: GarmentCategory;
    source: SourceType;
    qualityState: QualityState;
    ownership?: OwnershipState;
    sourceUrl?: string | null;
    sourceLabel?: string | null;
  }): Promise<WardrobeItem>;
  updateItem(
    userId: UserId,
    itemId: string,
    patch: Partial<
      Pick<WardrobeItem, "name" | "category" | "qualityState" | "ownership" | "isFavorite">
    >,
  ): Promise<WardrobeItem | null>;
  deleteItem(userId: UserId, itemId: string): Promise<boolean>;
  markItemUsed(userId: UserId, itemId: string): Promise<void>;

  // Looks — only ever written after an explicit user save.
  saveLook(input: {
    userId: UserId;
    itemId: string | null;
    imageUrl: string;
    kind: "photo" | "clip";
  }): Promise<Look>;
  listLooks(userId: UserId, limit?: number): Promise<Look[]>;
  setLookFavorite(userId: UserId, lookId: string, isFavorite: boolean): Promise<Look | null>;
  deleteLook(userId: UserId, lookId: string): Promise<boolean>;

  // Share links — revocable access to one look.
  createShareLink(userId: UserId, lookId: string, ttlHours: number): Promise<ShareLink>;
  revokeShareLink(userId: UserId, shareId: string): Promise<boolean>;

  // 24h stories. Off by default behind FLAG_STORIES; the model ships so the
  // surface can be enabled without a migration.
  createStory(input: {
    userId: UserId;
    imageUrl: string;
    ttlHours: number;
  }): Promise<Story>;
  listStories(userId: UserId): Promise<Story[]>;
  purgeExpiredStories(userId: UserId): Promise<number>;

  // Usage ledger and cost cap (FR-703).
  readUsage(userId: UserId): Promise<UsageLedger>;
  consumePhoto(userId: UserId): Promise<UsageLedger>;
  consumeLiveSeconds(userId: UserId, seconds: number): Promise<UsageLedger>;
  refundPhoto(userId: UserId): Promise<UsageLedger>;
  addCostCents(userId: UserId, cents: number): Promise<void>;
  globalCostSpentCents(): Promise<number>;

  // Media: signed-URL style short-lived access, never permanent public objects.
  putMedia(input: {
    userId: UserId;
    bytes: Buffer;
    contentType: string;
    kind: "garment" | "media";
  }): Promise<{ url: string; storagePath: string }>;
  readMedia(storagePath: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  deleteMedia(storagePath: string): Promise<boolean>;
  /**
   * Turns a stored media reference into something the browser can load. The
   * Supabase driver mints a short-lived signed URL; the local driver passes its
   * same-origin path through. External URLs (an imported og:image) are untouched.
   */
  resolveMediaUrl(url: string): Promise<string>;

  // Import review cache, so an unsupported link keeps its address for the
  // screenshot fallback instead of dead-ending (PRD "Unsupported link").
  cacheImportPreview(deviceId: string, url: string, preview: LinkImportPreview): Promise<void>;
  readCachedImportPreview(deviceId: string, url: string): Promise<LinkImportPreview | null>;

  stats(userId: UserId): Promise<ProfileStats>;
}
