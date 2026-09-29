import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReadinessCheck } from "../../shared/types";
import { assessFraming, useCamera, type CameraController } from "../lib/camera";
import {
  capturePhoto,
  clipCaptureSupported,
  MAX_CLIP_SECONDS,
  recordClip,
  type CaptureSources,
} from "../lib/capture";
import { useTryOn } from "../lib/tryOn";
import { useStore } from "../state/store";
import { resolveAppUrl } from "../state/api";
import { GarmentCarousel } from "../components/GarmentCarousel";
import { ErrorPanel } from "../components/feedback";
import { AiDisclosure, GeneratingShimmer, Icon } from "../components/ui";

/**
 * The camera. This is the app's front door — the PRD puts it before onboarding
 * or any feed, so a guest's first screen is a live viewfinder with garments
 * already selectable.
 *
 * Live try-on is the default and photo is a deliberate choice (FR-104). The
 * shutter is one control with two gestures: tap for a photo, hold for a clip
 * capped at ten seconds.
 *
 * All session state lives in `useTryOn`; this file owns only what is genuinely
 * about the camera — the stream, the gesture, and the overlay canvas that
 * compositing and capture share.
 */

export interface CapturedResult {
  kind: "photo" | "clip";
  url: string;
  blob: Blob;
  posterUrl?: string;
  durationMs?: number;
  itemId: string | null;
}

const HOLD_TO_RECORD_MS = 320;

export function CameraScreen({
  onOpenWardrobe,
  onOpenProfile,
  onCaptured,
}: {
  onOpenWardrobe: () => void;
  onOpenProfile: () => void;
  onCaptured: (result: CapturedResult) => void;
}): ReactNode {
  const { items, selectedItemId, selectItem, usage, tryOn, flags } = useStore();
  const camera = useCamera();
  const session = useTryOn();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const holdTimer = useRef<number | null>(null);
  const recorderRef = useRef<ReturnType<typeof recordClip>>(null);
  const holdSecondsRef = useRef(0);
  const [holdSeconds, setHoldSeconds] = useState(0);

  const [mode, setMode] = useState<"live" | "photo">("live");
  const [framing, setFraming] = useState<ReadinessCheck | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Only launch-category garments can be tried on. The rest stay in the wardrobe
  // rather than being offered here and failing later.
  const tryableItems = useMemo(
    () => items.filter((item) => item.qualityState === "ready" || item.qualityState === "experimental"),
    [items],
  );

  // --- camera lifecycle -------------------------------------------------

  useEffect(() => {
    void camera.start();
    // Mount only: flipping is explicit, and restarting on every render of
    // `camera` would fight the user's own interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Grabs a small still from the feed for the compositor to work from. */
  const sampleFrame = useCallback((): { dataUrl: string; width: number; height: number } | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    const width = 480;
    const height = Math.round((width * video.videoHeight) / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width, height };
  }, []);

  /** Just enough about a garment for the model's substitution prompt. */
  const garmentFor = useCallback(
    (itemId: string | null): { imageUrl: string; name: string } | null => {
      if (!itemId) return null;
      const item = items.find((candidate) => candidate.id === itemId);
      return item ? { imageUrl: item.imageUrl, name: item.name } : null;
    },
    [items],
  );

  // --- live try-on ------------------------------------------------------

  const startLive = useCallback(async () => {
    if (!selectedItemId) return;
    const garment = garmentFor(selectedItemId);

    // Browser-rendered sessions take the raw camera tracks: person pixels go
    // to the model over WebRTC and never pass through our server, so no frame
    // is sampled and none is posted. Everything else posts the frame the
    // provider composites onto.
    if (tryOn.renderMode === "browser") {
      await session.startLive({
        itemId: selectedItemId,
        frame: null,
        width: videoRef.current?.videoWidth || 720,
        height: videoRef.current?.videoHeight || 1280,
        localStream: camera.getStream(),
        garment,
      });
      return;
    }

    const frame = sampleFrame();
    if (!frame) {
      setNotice("Point the camera at yourself to start.");
      return;
    }
    await session.startLive({
      itemId: selectedItemId,
      frame: frame.dataUrl,
      width: frame.width,
      height: frame.height,
      garment,
    });
  }, [selectedItemId, sampleFrame, garmentFor, tryOn.renderMode, camera, session]);

  // Start a session as soon as there is a camera and a garment, then again
  // whenever the garment changes. `session.switchGarment` keeps the session
  // running rather than restarting it, which is what FR-105 requires.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "live" || camera.state.kind !== "ready" || !selectedItemId) return;
    if (startedFor.current === selectedItemId) return;
    const previous = startedFor.current;
    startedFor.current = selectedItemId;
    if (previous === null) {
      void startLive();
    } else {
      void session.switchGarment(selectedItemId, garmentFor(selectedItemId));
    }
  }, [mode, camera.state.kind, selectedItemId, startLive, garmentFor, tryOn]);

  // The realtime client hands over a MediaStream, which React will not attach
  // to a <video> on its own. This is the one place the AI video is wired up;
  // until a frame exists the element is transparent, never a placeholder.
  useEffect(() => {
    const video = remoteRef.current;
    if (!video) return;
    video.srcObject = session.remoteStream;
    if (session.remoteStream) void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [session.remoteStream]);

  // Leaving live mode ends the session so a guest is not billed for time they
  // are not using.
  useEffect(() => {
    if (mode === "live") return;
    startedFor.current = null;
    void session.end();
    session.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // End the session on unmount too, so navigating to the wardrobe does not leave
  // a session running on the server.
  const tryOnRef = useRef(session);
  tryOnRef.current = session;
  useEffect(() => () => void tryOnRef.current.end(), []);

  // --- framing guidance -------------------------------------------------

  useEffect(() => {
    if (camera.state.kind !== "ready") return;
    const video = videoRef.current;
    if (!video) return;
    const interval = window.setInterval(() => setFraming(assessFraming(video)), 700);
    return () => clearInterval(interval);
  }, [camera.state.kind]);

  // --- capture ----------------------------------------------------------

  // What gets saved must be what the guest was looking at. In a browser-rendered
  // session that is the model's stream, not the camera underneath it, so the
  // capture reads from whichever element is actually on screen.
  const sources = useMemo<CaptureSources>(
    () => ({
      get video() {
        return session.remoteStream ? remoteRef.current : videoRef.current;
      },
      get overlay() {
        return overlayRef.current;
      },
    }),
    [session.remoteStream],
  );

  const finishPhoto = useCallback(async () => {
    const shot = await capturePhoto(sources);
    if (!shot) {
      setNotice("Couldn't grab a frame. Try again.");
      return;
    }
    onCaptured({ kind: "photo", url: shot.url, blob: shot.blob, itemId: selectedItemId });
  }, [onCaptured, selectedItemId, sources]);

  const onShutterDown = useCallback(() => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      // Holding records a clip; if clips are unavailable this simply does
      // nothing, and the release below takes a photo as normal.
      if (!flags.clipCapture || !clipCaptureSupported()) return;
      const recorder = recordClip(sources, (seconds) => {
        holdSecondsRef.current = seconds;
        setHoldSeconds(seconds);
      });
      recorderRef.current = recorder;
    }, HOLD_TO_RECORD_MS);
  }, [flags.clipCapture, sources]);

  const onShutterUp = useCallback(async () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder) {
      recorderRef.current = null;
      setHoldSeconds(0);
      holdSecondsRef.current = 0;
      const clip = await recorder.stop();
      if (clip) {
        onCaptured({
          kind: "clip",
          url: clip.url,
          blob: clip.blob,
          posterUrl: clip.posterUrl,
          durationMs: Math.min(clip.durationMs, MAX_CLIP_SECONDS * 1000),
          itemId: selectedItemId,
        });
      }
      return;
    }

    // A tap in photo mode with no generated frame yet generates one first.
    if (mode === "photo" && !session.resultUrl) {
      const frame = sampleFrame();
      if (frame && selectedItemId) {
        await session.startPhoto({
          itemId: selectedItemId,
          frame: frame.dataUrl,
          width: frame.width,
          height: frame.height,
        });
      } else {
        setNotice("Point the camera at yourself to start.");
      }
      return;
    }

    await finishPhoto();
  }, [mode, tryOn, sampleFrame, selectedItemId, finishPhoto, onCaptured]);

  // --- render -----------------------------------------------------------

  const cameraReady = camera.state.kind === "ready";
  const generating =
    session.phase === "starting" || session.phase === "switching" || session.phase === "generating";
  const canCapture = cameraReady && !!selectedItemId && !generating;
  const guestUsed = usage?.guestTryOnConsumed === true;
  return (
    <div className="relative h-dvh overflow-hidden bg-black text-white">
      <video
        ref={(element) => {
          videoRef.current = element;
          camera.attach(element);
        }}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 size-full object-cover transition-opacity ${
          camera.facing === "user" ? "-scale-x-100" : ""
        } ${cameraReady ? "opacity-100" : "opacity-0"}`}
      />

      {/*
        The live AI try-on. This is the model's own output arriving over WebRTC,
        and it sits directly on top of the camera feed so that what the guest
        sees once it arrives is the try-on and nothing else. It carries no CSS
        flip because the SDK already returns a mirror-corrected stream. Before
        the first frame it is fully transparent: there is no placeholder image,
        only the camera underneath.
      */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        muted
        aria-label="Your live AI try-on"
        className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
          session.remoteStream ? "opacity-100" : "opacity-0"
        }`}
      />

      {/*
        The composited result is drawn over the feed rather than replacing it, so
        the garment is visibly worn by the live person. It is flipped in the same
        space as the video, which is why the two use identical transforms.
      */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          session.resultUrl ? "opacity-100" : "opacity-0"
        } ${camera.facing === "user" ? "-scale-x-100" : ""}`}
      >
        {session.resultUrl ? (
          <img
            src={resolveAppUrl(session.resultUrl)}
            alt="Your AI try-on preview"
            className="size-full object-cover"
            // The same URL recurs every frame in live mode; the index keeps React
            // from skipping the repaint when a vendor reuses a URL.
            key={`${session.resultUrl.slice(-24)}-${session.frameIndex}`}
          />
        ) : null}
      </div>

      <canvas ref={overlayRef} className="hidden" aria-hidden />

      {cameraReady ? null : <CameraGate state={camera.state} onRetry={() => void camera.retry()} onWardrobe={onOpenWardrobe} />}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          {cameraReady && camera.torchAvailable ? (
            <button
              type="button"
              onClick={() => void camera.toggleTorch()}
              aria-pressed={camera.torchOn}
              aria-label={camera.torchOn ? "Turn flash off" : "Turn flash on"}
              className={`grid size-10 place-items-center rounded-full backdrop-blur transition ${
                camera.torchOn ? "bg-white text-ink-900" : "bg-black/40 text-white"
              }`}
            >
              <Icon name="flash" className="size-5" />
            </button>
          ) : null}
          {cameraReady ? (
            <button
              type="button"
              onClick={() => void camera.flip()}
              aria-label="Switch camera"
              className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
            >
              <Icon name="flip" className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {mode === "live" && session.secondsRemaining !== null ? (
            <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium tabular-nums backdrop-blur">
              {session.secondsRemaining}s left
            </span>
          ) : null}
          <button
            type="button"
            onClick={onOpenWardrobe}
            aria-label="Open wardrobe"
            className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
          >
            <Icon name="camera" className="size-5" />
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Your profile"
            className="grid size-10 place-items-center rounded-full bg-black/40 text-xs font-semibold text-white backdrop-blur"
          >
            You
          </button>
        </div>
      </div>

      {generating ? (
        <GeneratingShimmer
          label={
            session.phase === "switching"
              ? "Switching garment"
              : session.stage
                ? session.stage
                : session.phase === "generating"
                  ? "Generating your try-on"
                  : "Starting try-on"
          }
        />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-14">
        {framing && !framing.ok ? (
          <p className="mx-auto w-fit rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-medium text-ink-950">
            {framing.nextAction}
          </p>
        ) : null}

        {session.error ? (
          <div className="mx-auto w-full max-w-sm">
            <ErrorPanel
              error={session.error}
              onRetry={
                session.error.isRetryable
                  ? () => {
                      if (mode === "live") void startLive();
                      else void onShutterUp();
                    }
                  : undefined
              }
              onDismiss={session.reset}
            />
          </div>
        ) : null}

        {notice ? (
          <p className="mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur">
            {notice}
          </p>
        ) : null}

        <div className="mx-auto flex rounded-full bg-black/45 p-1 backdrop-blur" role="tablist" aria-label="Try-on mode">
          {(["live", "photo"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              disabled={value === "live" && !tryOn.liveAvailable}
              onClick={() => {
                setMode(value);
                setNotice(null);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition disabled:opacity-40 ${
                mode === value ? "bg-white text-ink-900" : "text-white/70"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <GarmentCarousel
          items={tryableItems}
          selectedId={selectedItemId}
          onSelect={(id) => {
            selectItem(id);
            setNotice(null);
          }}
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenWardrobe}
            className="w-16 text-center text-[11px] text-white/60"
          >
            Wardrobe
          </button>

          <button
            type="button"
            onPointerDown={onShutterDown}
            onPointerUp={() => void onShutterUp()}
            onPointerLeave={() => {
              if (holdTimer.current !== null) clearTimeout(holdTimer.current);
            }}
            onPointerCancel={() => {
              if (holdTimer.current !== null) clearTimeout(holdTimer.current);
            }}
            disabled={!canCapture}
            aria-label={mode === "live" ? "Tap to capture a photo, hold for a clip" : "Generate a photo try-on"}
            className={`relative grid size-16 place-items-center rounded-full border-4 transition disabled:opacity-40 ${
              recorderRef.current ? "border-rose-300 bg-rose-500/30" : "border-white bg-white/15"
            }`}
          >
            <span className={`rounded-full bg-white transition-all ${recorderRef.current ? "size-7" : "size-11"}`} />
            {recorderRef.current ? (
              <span className="absolute -top-6 text-[11px] font-semibold tabular-nums">
                {Math.round(holdSeconds)}s
              </span>
            ) : null}
          </button>

          <span className="w-16 text-center text-[11px] text-white/60">
            {guestUsed ? "Used" : mode === "live" ? "Tap · hold" : "Tap"}
          </span>
        </div>

        <AiDisclosure className="text-center" />
      </div>
    </div>
  );
}

/** Explains why the camera is not showing, and always offers a way forward. */
function CameraGate({
  state,
  onRetry,
  onWardrobe,
}: {
  state: CameraController["state"];
  onRetry: () => void;
  onWardrobe: () => void;
}): ReactNode {
  if (state.kind === "ready") return null;

  if (state.kind === "idle" || state.kind === "requesting") {
    return (
      <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950">
        <p className="text-sm text-white/70">Starting camera…</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950 px-8">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white/10">
          <Icon name="camera" className="size-7 text-white" />
        </div>
        <h2 className="text-lg font-semibold">{state.message}</h2>
        <p className="mt-2 text-sm text-white/60">{state.nextAction}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-900"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onWardrobe}
            className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Use my wardrobe instead
          </button>
        </div>
      </div>
    </div>
  );
}
