/**
 * Capture.
 *
 * The PRD's gesture is precise: tap the shutter for a photo, hold it for a video
 * capped at ten seconds. Both are recorded from a canvas that has the camera
 * frame and the AI try-on composited together, so what gets saved is what the
 * user was looking at — not a re-generation that might differ.
 *
 * `MediaRecorder` is used directly rather than `getDisplayMedia`, because screen
 * capture would show the browser chrome and cannot be pointed at a canvas
 * reliably on iOS.
 */

/** PRD: video captures stop at ten seconds. */
export const MAX_CLIP_SECONDS = 10;

export interface CapturedClip {
  kind: "clip";
  blob: Blob;
  /** Object URL the caller must revoke when done. */
  url: string;
  durationMs: number;
  posterUrl: string;
}

export interface CapturedPhoto {
  kind: "photo";
  blob: Blob;
  url: string;
}

/** Downscaled to a size a phone can encode smoothly, and small enough to POST. */
const CAPTURE_WIDTH = 720;
const JPEG_QUALITY = 0.92;

export interface CaptureSources {
  video: HTMLVideoElement | null;
  /** The composited try-on frame, already sized to the video's aspect. */
  overlay: HTMLCanvasElement | null;
}

function fitSize(video: HTMLVideoElement): { width: number; height: number } {
  const aspect = video.videoHeight / Math.max(video.videoWidth, 1);
  return { width: CAPTURE_WIDTH, height: Math.round(CAPTURE_WIDTH * aspect) };
}

/** Reads the current camera's facing mode, if the element has a live stream. */
function facingOf(video: HTMLVideoElement): string | undefined {
  const source = video.srcObject;
  // `srcObject` can also be a Blob; only a MediaStream has tracks.
  if (!source || typeof (source as MediaStream).getVideoTracks !== "function") return undefined;
  const track = (source as MediaStream).getVideoTracks()[0];
  return (track?.getSettings?.() as { facingMode?: string } | undefined)?.facingMode;
}

/**
 * Draws the camera frame and, if present, the try-on result on top. When there is
 * no overlay the raw camera frame is captured, which is what the fallback path
 * needs.
 */
export function paintFrame(sources: CaptureSources): HTMLCanvasElement | null {
  const { video, overlay } = sources;
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

  const { width, height } = fitSize(video);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // Mirror the preview when using the front camera, so the saved photo matches
  // what the user saw rather than looking flipped.
  if (facingOf(video) === "user") {
    context.translate(width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(video, 0, 0, width, height);
  if (overlay) {
    context.drawImage(overlay, 0, 0, width, height);
  }
  return canvas;
}

export function capturePhoto(sources: CaptureSources): Promise<CapturedPhoto | null> {
  const canvas = paintFrame(sources);
  if (!canvas) return Promise.resolve(null);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve({ kind: "photo", blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export interface ClipRecording {
  stop: () => Promise<CapturedClip | null>;
  /** Seconds elapsed so far, for the ring around the shutter. */
  elapsed: () => number;
  readonly stopping: boolean;
}

/**
 * Starts recording. The overlay canvas is repainted on every frame for the whole
 * duration, so switching garment mid-clip is reflected in the saved video — which
 * is what makes the in-session switch feel real rather than cosmetic.
 */
export function recordClip(
  sources: CaptureSources,
  onTick?: (seconds: number) => void,
): ClipRecording | null {
  const canvas = paintFrame(sources);
  if (!canvas) return null;

  const stream = canvas.captureStream(30);
  const mimeType = pickMimeType();
  if (!mimeType) return null;

  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  } catch {
    return null;
  }

  const startedAt = performance.now();
  let raf = 0;
  let timer = 0;
  let settling = false;

  // Repaint from the live sources rather than reusing the single frame, so motion
  // is in the clip.
  const repaint = (): void => {
    const width = canvas.width;
    const height = canvas.height;
    const context = canvas.getContext("2d");
    if (!context || !sources.video || sources.video.readyState < 2) {
      raf = requestAnimationFrame(repaint);
      return;
    }
    context.clearRect(0, 0, width, height);
    context.save();
    if (facingOf(sources.video) === "user") {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(sources.video, 0, 0, width, height);
    if (sources.overlay) context.drawImage(sources.overlay, 0, 0, width, height);
    context.restore();
    raf = requestAnimationFrame(repaint);
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const cleanup = (): void => {
    cancelAnimationFrame(raf);
    clearInterval(timer);
    for (const track of stream.getTracks()) track.stop();
  };

  return {
    stopping: false,
    elapsed: () => (performance.now() - startedAt) / 1000,
    stop: () =>
      new Promise<CapturedClip | null>((resolve) => {
        if (settling) {
          resolve(null);
          return;
        }
        settling = true;

        const durationMs = Math.min(performance.now() - startedAt, MAX_CLIP_SECONDS * 1000);
        recorder.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size === 0) {
            resolve(null);
            return;
          }
          // A poster frame is needed because the preview grid cannot decode a
          // video thumbnail from a blob URL without seeking one out.
          const posterUrl = canvas.toDataURL("image/jpeg", 0.8);
          resolve({
            kind: "clip",
            blob,
            url: URL.createObjectURL(blob),
            durationMs,
            posterUrl,
          });
        };

        try {
          if (recorder.state !== "inactive") recorder.stop();
          else resolve(null);
        } catch {
          cleanup();
          resolve(null);
        }
      }),
  };

  // Kick off recording only after the first repaint, otherwise the first frames
  // are a blank canvas and the clip opens on black.
  raf = requestAnimationFrame(() => {
    repaint();
    recorder.start(100);
  });
  timer = window.setInterval(() => {
    const seconds = (performance.now() - startedAt) / 1000;
    onTick?.(seconds);
    if (seconds >= MAX_CLIP_SECONDS) {
      onTick?.(MAX_CLIP_SECONDS);
    }
  }, 100);
}

/**
 * Safari only records `mp4` and Chrome prefers `webm`; the first supported type
 * wins so the clip is playable wherever it is shared.
 */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return null;
}

/** True when this browser can record a clip at all. Drives the hint under the shutter. */
export function clipCaptureSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMimeType() !== null
  );
}

/** Reads a user-picked file into a data URL, rejecting anything oversized first. */
export function fileToDataUrl(file: File, maxBytes = 12_000_000): Promise<string> {
  if (file.size > maxBytes) {
    return Promise.reject(new Error("That image is too large. Choose one under 12 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) {
        reject(new Error("That file isn't an image Raritone can use."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}
