import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type ApiBootstrap,
  type FeatureFlags,
  type LinkImportPreview,
  type Look,
  type ProfileStats,
  type SessionProfile,
  type UsageLedger,
  type WardrobeItem,
} from "../../shared/types";
import { ApiError, api } from "./api";

/**
 * App state.
 *
 * The whole app is a small amount of server-owned data plus a lot of ephemeral
 * camera state, so this is a plain context with a reducer-free update style
 * rather than a state library. Two rules keep it honest:
 *
 *  1. Anything the server owns (items, looks, usage, profile) is refetched, not
 *     guessed. A failed request never leaves a half-updated local copy.
 *  2. A guest's one try-on is server-enforced, so the client's remaining
 *     allowance is only ever used to disable the button early, never to decide
 *     whether a try-on is allowed.
 */

export interface TryOnAvailability {
  liveAvailable: boolean;
  photoAvailable: boolean;
  providerClass: string;
  /** "browser" renders provider video locally over WebRTC; "server" polls frames. */
  renderMode: "browser" | "server";
}

interface StoreValue {
  /** null until bootstrap succeeds; screens show a full-bleed loader meanwhile. */
  ready: boolean;
  bootError: ApiError | null;
  profile: SessionProfile | null;
  flags: FeatureFlags;
  usage: UsageLedger | null;
  tryOn: TryOnAvailability;
  storageDriver: "supabase" | "local";

  items: WardrobeItem[];
  looks: Look[];
  stats: ProfileStats | null;

  /** The garment the camera is currently previewing. */
  selectedItemId: string | null;
  selectedItem: WardrobeItem | null;
  selectItem: (id: string) => void;

  reload: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  refreshLooks: () => Promise<void>;
  refreshStats: () => Promise<void>;

  addItem: (input: {
    name: string;
    imageDataUrl: string;
    category?: WardrobeItem["category"];
    source?: WardrobeItem["source"];
    sourceUrl?: string;
    sourceLabel?: string;
  }) => Promise<WardrobeItem>;
  removeItem: (id: string) => Promise<void>;
  toggleItemFavorite: (id: string) => Promise<void>;

  importLink: (url: string) => Promise<LinkImportPreview>;
  saveLinkImport: (preview: LinkImportPreview, name: string) => Promise<WardrobeItem>;

  saveLook: (input: { imageDataUrl: string; itemId: string | null; kind: Look["kind"] }) => Promise<Look>;
  toggleLookFavorite: (id: string) => Promise<void>;
  shareLook: (lookId: string) => Promise<{ url: string; expiresAt: string }>;

  updateProfile: (patch: { displayName?: string; handle?: string }) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const EMPTY_STATS: ProfileStats = {
  tryOnsThisWeek: 0,
  wardrobeCount: 0,
  favoritesCount: 0,
  dayStreak: 0,
  looksThisWeek: 0,
};

const OFFLINE_TRY_ON: TryOnAvailability = {
  liveAvailable: false,
  photoAvailable: false,
  providerClass: "unknown",
  renderMode: "server",
};

export function StoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<ApiError | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [flags, setFlags] = useState<FeatureFlags>({
    liveTryOn: false,
    clipCapture: false,
    stories: false,
    linkImport: false,
    wardrobeUpload: false,
  });
  const [usage, setUsage] = useState<UsageLedger | null>(null);
  const [tryOn, setTryOn] = useState<TryOnAvailability>(OFFLINE_TRY_ON);
  const [storageDriver, setStorageDriver] = useState<"supabase" | "local">("local");
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // A reload can be triggered by several things at once (retry, refocus, coming
  // back from a share sheet). Only the newest result is allowed to land.
  const loadToken = useRef(0);

  const applyBootstrap = useCallback((data: ApiBootstrap) => {
    setProfile(data.session);
    setFlags(data.flags);
    setUsage(data.usage);
    setTryOn(data.tryOn);
    setStorageDriver(data.storageDriver);
    setItems(data.items);
    setSelectedItemId((current) => {
      if (current && data.items.some((item) => item.id === current)) return current;
      return data.items.find((item) => item.qualityState === "ready")?.id ?? data.items[0]?.id ?? null;
    });
  }, []);

  const reload = useCallback(async () => {
    const token = (loadToken.current += 1);
    try {
      const data = await api.get<ApiBootstrap>("/bootstrap");
      if (token !== loadToken.current) return;
      applyBootstrap(data);
      setBootError(null);
      setReady(true);
    } catch (error) {
      if (token !== loadToken.current) return;
      setBootError(error instanceof ApiError ? error : new ApiError({
        status: 0,
        category: "internal",
        message: "Something went wrong loading Raritone.",
        retryIsFree: true,
      }));
      setReady(true);
    }
  }, [applyBootstrap]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The allowance and the stats change as a side effect of trying on, so they
  // are refetched whenever the user comes back to the foreground.
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void refreshUsage();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const data = await api.get<ApiBootstrap>("/bootstrap");
      setUsage(data.usage);
      setTryOn(data.tryOn);
    } catch {
      // A stale allowance is safe: the server is the authority, and the next
      // try-on will report the real one.
    }
  }, []);

  const refreshLooks = useCallback(async () => {
    try {
      const data = await api.get<{ looks: Look[] }>("/looks");
      setLooks(data.looks);
    } catch {
      // Ignore: the grid falls back to empty.
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const data = await api.get<ProfileStats>("/stats");
      setStats(data);
    } catch {
      // Ignore: the profile shows a zeroed panel rather than a broken one.
    }
  }, []);

  const selectItem = useCallback((id: string) => {
    setSelectedItemId(id);
  }, []);

  const addItem = useCallback<StoreValue["addItem"]>(async (input) => {
    const data = await api.post<{ item: WardrobeItem }>("/items", {
      name: input.name,
      imageDataUrl: input.imageDataUrl,
      category: input.category,
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceLabel: input.sourceLabel,
    });
    setItems((current) => [data.item, ...current]);
    setSelectedItemId(data.item.id);
    return data.item;
  }, []);

  const removeItem = useCallback<StoreValue["removeItem"]>(async (id) => {
    await api.delete(`/items/${id}`);
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedItemId((current) => (current === id ? null : current));
  }, []);

  const toggleItemFavorite = useCallback<StoreValue["toggleItemFavorite"]>(async (id) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    const next = !item.isFavorite;
    // Optimistic: a heart must feel instant. Reverted below if the call fails.
    setItems((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, isFavorite: next } : candidate)),
    );
    try {
      await api.patch(`/items/${id}`, { isFavorite: next });
    } catch (error) {
      setItems((current) =>
        current.map((candidate) => (candidate.id === id ? { ...candidate, isFavorite: item.isFavorite } : candidate)),
      );
      throw error;
    }
  }, [items]);

  const importLink = useCallback<StoreValue["importLink"]>(async (url) => {
    const data = await api.post<{ preview: LinkImportPreview }>("/imports/link", { url });
    return data.preview;
  }, []);

  const saveLinkImport = useCallback<StoreValue["saveLinkImport"]>(async (preview, name) => {
    const data = await api.post<{ item: WardrobeItem }>("/items", {
      name,
      imageDataUrl: preview.imageUrl,
      category: preview.suggestedCategory,
      source: "link",
      qualityState: preview.qualityState,
      sourceUrl: preview.canonicalUrl,
      sourceLabel: preview.siteName,
    });
    setItems((current) => [data.item, ...current]);
    return data.item;
  }, []);

  const saveLook = useCallback<StoreValue["saveLook"]>(async (input) => {
    const data = await api.post<{ look: Look }>("/looks", input);
    setLooks((current) => [data.look, ...current]);
    return data.look;
  }, []);

  const toggleLookFavorite = useCallback<StoreValue["toggleLookFavorite"]>(async (id) => {
    const look = looks.find((candidate) => candidate.id === id);
    if (!look) return;
    const next = !look.isFavorite;
    setLooks((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, isFavorite: next } : candidate)),
    );
    try {
      await api.patch(`/looks/${id}`, { isFavorite: next });
    } catch (error) {
      setLooks((current) =>
        current.map((candidate) => (candidate.id === id ? { ...candidate, isFavorite: look.isFavorite } : candidate)),
      );
      throw error;
    }
  }, [looks]);

  const shareLook = useCallback<StoreValue["shareLook"]>(async (lookId) => {
    const data = await api.post<{ share: { url: string; expiresAt: string } }>("/shares", {
      lookId,
      ttlHours: 24,
    });
    return { url: data.share.url, expiresAt: data.share.expiresAt };
  }, []);

  const updateProfile = useCallback<StoreValue["updateProfile"]>(async (patch) => {
    const data = await api.patch<{ session: SessionProfile }>("/profile", patch);
    setProfile(data.session);
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      bootError,
      profile,
      flags,
      usage,
      tryOn,
      storageDriver,
      items,
      looks,
      stats,
      selectedItemId,
      selectedItem,
      selectItem,
      reload,
      refreshUsage,
      refreshLooks,
      refreshStats,
      addItem,
      removeItem,
      toggleItemFavorite,
      importLink,
      saveLinkImport,
      saveLook,
      toggleLookFavorite,
      shareLook,
      updateProfile,
    }),
    [
      ready, bootError, profile, flags, usage, tryOn, storageDriver, items, looks, stats,
      selectedItemId, selectedItem, selectItem, reload, refreshUsage, refreshLooks, refreshStats,
      addItem, removeItem, toggleItemFavorite, importLink, saveLinkImport, saveLook,
      toggleLookFavorite, shareLook, updateProfile,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}

export { EMPTY_STATS };
