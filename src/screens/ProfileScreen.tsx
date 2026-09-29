import { useCallback, useEffect, useState, type ReactNode } from "react";
import { EMPTY_STATS, useStore } from "../state/store";
import { resolveAppUrl } from "../state/api";
import { forgetDevice } from "../state/device";
import { ErrorPanel, Skeleton } from "../components/feedback";
import { Icon } from "../components/ui";

/**
 * The profile.
 *
 * For a guest this is a control panel rather than a social profile, which is why
 * it leads with what Raritone knows and can delete. The PRD is explicit that
 * deleting a garment must not delete looks that reference it, so that behaviour
 * is stated in the copy rather than left to be discovered.
 */
export function ProfileScreen({
  onBack,
  onOpenWardrobe,
}: {
  onBack: () => void;
  onOpenWardrobe: () => void;
}): ReactNode {
  const {
    profile,
    stats,
    looks,
    usage,
    flags,
    storageDriver,
    refreshStats,
    refreshLooks,
    refreshUsage,
    toggleLookFavorite,
    shareLook,
    updateProfile,
  } = useStore();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    void refreshStats();
    void refreshLooks();
    void refreshUsage();
  }, [refreshStats, refreshLooks, refreshUsage]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setHandle(profile.handle);
  }, [profile]);

  const shown = stats ?? EMPTY_STATS;
  const favourites = looks.filter((look) => look.isFavorite);

  const onSaveProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ displayName, handle });
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }, [displayName, handle, updateProfile]);

  const onShare = useCallback(
    async (lookId: string) => {
      setShareNotice(null);
      try {
        const share = await shareLook(lookId);
        if (typeof navigator.share === "function") {
          await navigator.share({ title: "My Raritone try-on", url: share.url });
        } else {
          await navigator.clipboard?.writeText(share.url);
          setShareNotice("Link copied. It expires in 24 hours.");
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setShareNotice(caught instanceof Error ? caught.message : "Couldn't share that.");
      }
    },
    [shareLook],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-white">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="grid size-10 place-items-center rounded-full bg-white/10"
          aria-label="Back to camera"
        >
          <Icon name="chevron-left" className="size-5" />
        </button>
        <h1 className="text-lg font-semibold">You</h1>
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className="rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-[max(5rem,env(safe-area-inset-bottom))]">
        <section className="rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-ink-100 text-lg font-semibold text-ink-950">
              {(profile?.displayName?.[0] ?? "R").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={60}
                    placeholder="Display name"
                    className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none"
                  />
                  <input
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    maxLength={30}
                    placeholder="handle"
                    className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void onSaveProfile()}
                    disabled={saving}
                    className="rounded-full bg-ink-100 px-4 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="truncate text-sm font-semibold">{profile?.displayName || "Guest"}</p>
                  <p className="truncate text-xs text-white/50">
                    {profile?.handle ? `@${profile.handle}` : "No handle yet"}
                  </p>
                </>
              )}
            </div>
          </div>
          {profile?.isGuest ? (
            <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/55">
              You're using Raritone as a guest. Your wardrobe and looks are tied to this device — there
              is no account to sign into yet, and nothing is shared publicly unless you share it.
            </p>
          ) : null}
          {error ? (
            <div className="mt-3">
              <ErrorPanel error={{ message: error }} onRetry={() => setError(null)} />
            </div>
          ) : null}
        </section>

        <section aria-label="Your activity">
          <h2 className="mb-2 text-sm font-semibold text-white/80">This week</h2>
          {stats ? (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Try-ons" value={shown.tryOnsThisWeek} />
              <Stat label="Looks saved" value={shown.looksThisWeek} />
              <Stat label="Day streak" value={shown.dayStreak} />
              <Stat label="Garments" value={shown.wardrobeCount} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          )}
        </section>

        {usage ? (
          <section className="rounded-2xl bg-white/5 p-4" aria-label="Your allowance">
            <h2 className="text-sm font-semibold text-white/80">Allowance</h2>
            <dl className="mt-2 space-y-1.5 text-xs">
              <Row
                label="Photo try-ons left"
                value={`${usage.photoRemaining} of ${usage.photoAllowance}`}
              />
              <Row
                label="Live seconds left"
                value={`${usage.liveSecondsRemaining} of ${usage.liveSecondsAllowance}`}
              />
              {usage.guestTryOnConsumed ? (
                <p className="pt-1 text-[11px] text-white/50">
                  You've used your guest try-on. Your next reset is{" "}
                  {new Date(usage.windowResetsAt).toLocaleDateString()}.
                </p>
              ) : null}
            </dl>
          </section>
        ) : null}

        <section aria-label="Favourites">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Favourites</h2>
            <button
              type="button"
              onClick={onOpenWardrobe}
              className="text-[11px] text-white/50 underline"
            >
              Open wardrobe
            </button>
          </div>
          {favourites.length === 0 ? (
            <p className="rounded-2xl bg-white/5 px-4 py-6 text-center text-xs text-white/50">
              Tap the heart on a saved look to keep it here.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {favourites.map((look) => (
                <li key={look.id} className="space-y-1">
                  <div className="relative overflow-hidden rounded-xl bg-white/5">
                    <img
                      src={resolveAppUrl(look.imageUrl)}
                      alt={look.aiLabel}
                      className="aspect-[3/4] w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/60 p-1">
                      <button
                        type="button"
                        onClick={() => void toggleLookFavorite(look.id)}
                        aria-label="Remove from favourites"
                        className="grid size-7 flex-1 place-items-center rounded-lg"
                      >
                        <Icon name="heart-filled" className="size-3.5 text-rose-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onShare(look.id)}
                        aria-label="Share this look"
                        className="grid size-7 flex-1 place-items-center rounded-lg"
                      >
                        <Icon name="share" className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="truncate text-[10px] text-white/40">{look.aiLabel}</p>
                </li>
              ))}
            </ul>
          )}
          {shareNotice ? (
            <p className="mt-2 text-[11px] text-white/50" role="status">
              {shareNotice}
            </p>
          ) : null}
        </section>

        {flags.stories ? (
          <section className="rounded-2xl bg-white/5 p-4" aria-label="Stories">
            <h2 className="text-sm font-semibold text-white/80">Your stories</h2>
            <p className="mt-1 text-[11px] text-white/50">
              Stories last 24 hours. This section is hidden by default because the PRD scopes it past
              Release 1.
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white/5 p-4" aria-label="Privacy and data">
          <h2 className="text-sm font-semibold text-white/80">Your data</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/55">
            <li>Photos and try-ons are private by default. Nothing is published without you sharing it.</li>
            <li>Share links expire after 24 hours, and you can revoke them.</li>
            <li>Removing a garment keeps any looks you already saved with it.</li>
            <li>
              Saved on this device
              {storageDriver === "local" ? " (local storage driver)" : " (Supabase)"}.
            </li>
            <li>Try-ons are generated by AI and are illustrative, not a true fit or size guide.</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Reset this device's Raritone data? You will start a new guest session.")) {
                return;
              }
              forgetDevice();
              window.location.reload();
            }}
            className="mt-3 w-full rounded-full border border-white/25 py-2.5 text-xs font-semibold"
          >
            Reset this device
          </button>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-2.5">
      <dt className="text-[11px] text-white/50">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/55">{label}</dt>
      <dd className="tabular-nums text-white/85">{value}</dd>
    </div>
  );
}
