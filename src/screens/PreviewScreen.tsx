import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../state/api";
import { useStore } from "../state/store";
import { ErrorPanel } from "../components/feedback";
import { AiDisclosure, Icon } from "../components/ui";
import type { CapturedResult } from "./CameraScreen";

/**
 * The capture preview: the last screen in the loop.
 *
 * The PRD requires all of share, save, and favourite to be reachable from here
 * in one tap, and requires the AI label to be visible on the output. Sharing
 * prefers the native sheet with a file (so the recipient gets the actual image),
 * and falls back to a link when the platform cannot share files — silently
 * downgrading to a link without saying so would be a lie about what was shared.
 */
export function PreviewScreen({
  capture,
  onRetake,
  onDone,
}: {
  capture: CapturedResult;
  onRetake: () => void;
  onDone: () => void;
}): ReactNode {
  const { saveLook, shareLook, toggleLookFavorite, refreshUsage, refreshStats, items, flags } = useStore();
  const [saved, setSaved] = useState<{ id: string; isFavorite: boolean } | null>(null);
  const [busy, setBusy] = useState<"save" | "share" | "heart" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [sharedVia, setSharedVia] = useState<"file" | "link" | null>(null);

  useEffect(() => {
    setSaved(null);
    setError(null);
    setSharedVia(null);
  }, [capture.url]);

  // Object URLs are owned by this screen, so they are released on unmount.
  useEffect(() => () => URL.revokeObjectURL(capture.url), [capture.url]);

  const item = items.find((candidate) => candidate.id === capture.itemId) ?? null;

  const onSave = useCallback(async () => {
    setBusy("save");
    setError(null);
    try {
      // A clip is stored as its poster frame; the video itself is offered to the
      // user through share and download rather than re-hosted per look.
      const imageDataUrl = capture.kind === "clip" ? capture.posterUrl! : capture.url;
      const look = await saveLook({
        imageDataUrl,
        itemId: capture.itemId,
        kind: capture.kind === "clip" ? "clip" : "photo",
      });
      setSaved({ id: look.id, isFavorite: look.isFavorite });
      await Promise.all([refreshUsage(), refreshStats()]);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({ status: 0, category: "internal", message: "Couldn't save that look." }),
      );
    } finally {
      setBusy(null);
    }
  }, [capture, saveLook, refreshUsage, refreshStats]);

  const onShare = useCallback(async () => {
    setBusy("share");
    setError(null);
    try {
      // Native share of the actual file when the platform supports it.
      const file = new File([capture.blob], capture.kind === "clip" ? "raritone-clip.webm" : "raritone.jpg", {
        type: capture.blob.type || "image/jpeg",
      });
      const canShareFiles =
        typeof navigator.share === "function" &&
        ((navigator as Navigator & { canShare?: (data: ShareData) => boolean }).canShare?.({
          files: [file],
        }) ??
          false);

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: "My Raritone try-on",
          text: "Try-on generated with Raritone. Illustrative, not a true fit.",
        });
        setSharedVia("file");
      } else {
        // No file sharing: create a revocable link and share that instead. The
        // user is told which happened.
        const lookId = saved?.id ?? (await saveLook({
          imageDataUrl: capture.kind === "clip" ? capture.posterUrl! : capture.url,
          itemId: capture.itemId,
          kind: capture.kind === "clip" ? "clip" : "photo",
        })).id;
        setSaved((current) => (current ? current : { id: lookId, isFavorite: false }));
        const share = await shareLook(lookId);
        if (typeof navigator.share === "function") {
          await navigator.share({ title: "My Raritone try-on", url: share.url });
        } else {
          await navigator.clipboard?.writeText(share.url).catch(() => undefined);
        }
        setSharedVia("link");
      }
    } catch (caught) {
      // A user dismissing the share sheet is not a failure.
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({ status: 0, category: "internal", message: "Couldn't share that." }),
      );
    } finally {
      setBusy(null);
    }
  }, [capture, saved, saveLook, shareLook]);

  const onDownload = useCallback(async () => {
    const link = document.createElement("a");
    link.href = capture.url;
    link.download = capture.kind === "clip" ? "raritone-clip.webm" : "raritone-try-on.jpg";
    document.body.append(link);
    link.click();
    link.remove();
  }, [capture]);

  const onHeart = useCallback(async () => {
    setBusy("heart");
    setError(null);
    try {
      const lookId = saved?.id ?? (await saveLook({
        imageDataUrl: capture.kind === "clip" ? capture.posterUrl! : capture.url,
        itemId: capture.itemId,
        kind: capture.kind === "clip" ? "clip" : "photo",
      })).id;
      const next = !(saved?.isFavorite ?? false);
      setSaved({ id: lookId, isFavorite: next });
      await toggleLookFavorite(lookId);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({ status: 0, category: "internal", message: "Couldn't save that favourite." }),
      );
    } finally {
      setBusy(null);
    }
  }, [capture, saved, saveLook, toggleLookFavorite]);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-white">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onRetake}
          className="grid size-10 place-items-center rounded-full bg-white/10"
          aria-label="Back to camera"
        >
          <Icon name="chevron-left" className="size-5" />
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold"
        >
          Done
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {capture.kind === "clip" ? (
          <video
            src={capture.url}
            poster={capture.posterUrl}
            controls
            playsInline
            loop
            className="size-full object-contain"
          />
        ) : (
          <img src={capture.url} alt="Your Raritone try-on" className="size-full object-contain" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
          <AiDisclosure />
          {item ? <p className="mt-1 text-xs text-white/60">Wearing {item.name}</p> : null}
        </div>
      </div>

      {error ? (
        <div className="px-4 pb-2">
          <ErrorPanel error={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <PreviewAction
          label="Save"
          icon={saved ? "check" : "download"}
          busy={busy === "save"}
          onClick={() => void onSave()}
          disabled={!!saved}
        />
        <PreviewAction
          label="Share"
          icon="share"
          busy={busy === "share"}
          onClick={() => void onShare()}
          disabled={!!busy}
        />
        <PreviewAction
          label="Save"
          icon="download"
          busy={false}
          onClick={() => void onDownload()}
          disabled={!!busy}
        />
        <PreviewAction
          label="Favourite"
          icon={saved?.isFavorite ? "heart-filled" : "heart"}
          busy={busy === "heart"}
          onClick={() => void onHeart()}
          disabled={!!busy}
        />
      </div>

      {sharedVia ? (
        <p className="px-4 pb-2 text-center text-[11px] text-white/50" role="status">
          {sharedVia === "file"
            ? "Shared as an image file."
            : "Shared as a link that expires in 24 hours. You can revoke it from your profile."}
        </p>
      ) : null}

      {flags.stories ? (
        <p className="px-4 pb-3 text-center text-[11px] text-ink-300">
          Stories are available while the flag is on.
        </p>
      ) : null}
    </div>
  );
}

function PreviewAction({
  label,
  icon,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/8 px-2 py-3 text-[11px] font-medium transition disabled:opacity-40"
    >
      <Icon name={busy ? "spinner" : icon} className="size-5" />
      {label}
    </button>
  );
}
