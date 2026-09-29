import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadinessCheck } from "../../shared/types";

/**
 * Camera access.
 *
 * The PRD is specific about the failure modes here, and they are genuinely
 * different: no camera at all, permission refused, and a camera that is
 * temporarily busy are three states with three different fixes. The browser only
 * tells us "NotAllowedError" for two of them, so the message is chosen from what
 * we know rather than from the error name alone.
 *
 * The stream is attached to a <video> element by the caller through `attach`,
 * because React and `srcObject` do not mix. The hook owns the track lifecycle.
 */

export type CameraState =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "ready" }
  | { kind: "denied"; message: string; nextAction: string; canRetry: boolean }
  | { kind: "unavailable"; message: string; nextAction: string }
  | { kind: "busy"; message: string; nextAction: string };

export interface CameraController {
  state: CameraState;
  /** Attach the element the stream should render into. Safe to call every render. */
  attach: (element: HTMLVideoElement | null) => void;
  start: () => Promise<void>;
  stop: () => void;
  /**
   * The live MediaStream itself. WebRTC needs the raw tracks rather than the
   * element, so the try-on layer pulls them straight from here — the person's
   * pixels then go browser-to-model without touching our server.
   */
  getStream: () => MediaStream | null;
  /** FR-101: switch between the front and rear camera. */
  flip: () => Promise<void>;
  facing: "user" | "environment";
  /** FR-104: torch toggle, where the device reports one. */
  torchAvailable: boolean;
  torchOn: boolean;
  toggleTorch: () => Promise<void>;
  /** Fires when the device reports no camera hardware. */
  retry: () => Promise<void>;
}

const NO_CAMERA: CameraState = {
  kind: "unavailable",
  message: "No camera found on this device.",
  nextAction: "Add a garment from your photos instead.",
};

export function useCamera(): CameraController {
  const [state, setState] = useState<CameraState>({ kind: "idle" });
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Guards against a slow getUserMedia resolving after the user already gave up
  // or navigated away, which would otherwise leave a live stream with no owner.
  const attemptRef = useRef(0);

  const stop = useCallback(() => {
    attemptRef.current += 1;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
  }, []);

  const start = useCallback(async () => {
    const attempt = (attemptRef.current += 1);
    setState({ kind: "requesting" });

    if (!navigator.mediaDevices?.getUserMedia) {
      setState({
        kind: "unavailable",
        message: "This browser can't open a camera.",
        nextAction: "Use a recent version of Safari or Chrome.",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 1706 },
        },
        audio: false,
      });

      if (attempt !== attemptRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      // Replace rather than accumulate: a flip must not leave the old camera lit.
      const previous = streamRef.current;
      streamRef.current = stream;
      if (previous) for (const track of previous.getTracks()) track.stop();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setTorchAvailable(Boolean(capabilities.torch));
      setState({ kind: "ready" });
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      setState(describeFailure(error));
    }
  }, [facing]);

  const flip = useCallback(async () => {
    setFacing((current) => (current === "user" ? "environment" : "user"));
    // `start` closes over `facing`, so wait a tick for the new value to land.
    setTimeout(() => void start(), 0);
  }, [start]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchAvailable) return;
    const next = !torchOn;
    // `torch` is not in the DOM's constraint types because it is still a draft
    // addition, but it is what every shipping mobile browser actually accepts.
    const constraints = { advanced: [{ torch: next }] } as unknown as MediaTrackConstraints;
    try {
      await track.applyConstraints(constraints);
      setTorchOn(next);
    } catch {
      // Some browsers report torch support but refuse to toggle it. Treat the
      // control as unavailable rather than lying about its state.
      setTorchAvailable(false);
      setTorchOn(false);
    }
  }, [torchAvailable, torchOn]);

  const attach = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    const stream = streamRef.current;
    if (element && stream && element.srcObject !== stream) {
      element.srcObject = stream;
      void element.play().catch(() => undefined);
    }
  }, []);

  // Releasing the camera when the app is backgrounded matters on mobile: iOS
  // shows an indicator and revokes access if a stream is left running.
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  return {
    state,
    attach,
    start,
    stop,
    getStream: () => streamRef.current,
    flip,
    facing,
    torchAvailable,
    torchOn,
    toggleTorch,
    retry: start,
  };
}

/** Map a getUserMedia rejection onto something a person can act on. */
function describeFailure(error: unknown): CameraState {
  const name = error instanceof DOMException ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    // NotAllowedError covers both "you pressed deny" and "you pressed deny twice,
    // so the browser will no longer show a prompt". Only the second is hopeless
    // from inside the page, and the browser will not tell us which happened.
    return {
      kind: "denied",
      message: "Camera access is off.",
      nextAction: "Open browser settings for this site, allow the camera, then try again.",
      canRetry: true,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return NO_CAMERA;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      kind: "busy",
      message: "Another app is using your camera.",
      nextAction: "Close other camera apps, then try again.",
    };
  }
  return {
    kind: "unavailable",
    message: "Couldn't start the camera.",
    nextAction: "Try again, or add a garment from your photos.",
  };
}

/**
 * Framing guidance for the capture button.
 *
 * These checks are heuristics on the visible frame, not pose detection: they
 * look at brightness and how much of the frame the subject occupies. The PRD asks
 * for "exactly one correction at a time", so this returns a single message
 * rather than a list of everything that is slightly off.
 */
export function assessFraming(video: HTMLVideoElement | null): ReadinessCheck {
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return { ok: true, code: "ok", message: "", nextAction: "" };
  }

  const sample = document.createElement("canvas");
  sample.width = 64;
  sample.height = 64;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return { ok: true, code: "ok", message: "", nextAction: "" };

  context.drawImage(video, 0, 0, sample.width, sample.height);
  const { data } = context.getImageData(0, 0, sample.width, sample.height);

  let total = 0;
  let bright = 0;
  // Column brightness tells us whether there is a person-shaped mass in the
  // middle, which is a decent proxy for "step back" / "get closer".
  const columns = new Array<number>(sample.width).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    total += luminance;
    if (luminance > 0.55) {
      bright += 1;
      columns[i % sample.width] += 1;
    }
  }

  const pixels = data.length / 4;
  const meanLuminance = total / pixels;
  if (meanLuminance < 0.08) {
    return {
      ok: false,
      code: "too_dark",
      message: "Too dark to see clearly.",
      nextAction: "Move somewhere brighter.",
    };
  }

  const subjectColumns = columns.filter((value) => value > 2).length / sample.width;
  if (subjectColumns < 0.14) {
    return {
      ok: false,
      code: "multiple_people",
      message: "Can't tell where the person is.",
      nextAction: "Make sure one person fills the frame.",
    };
  }
  if (subjectColumns > 0.94) {
    return {
      ok: false,
      code: "too_close",
      message: "Too close to fit the garment.",
      nextAction: "Step back a little.",
    };
  }

  const aspect = video.videoWidth / video.videoHeight;
  if (aspect > 1.15) {
    return {
      ok: false,
      code: "landscape",
      message: "Turn the phone upright.",
      nextAction: "Portrait framing fits a garment best.",
    };
  }

  return { ok: true, code: "ok", message: "", nextAction: "" };
}
