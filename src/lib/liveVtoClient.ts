/**
 * LiveVtoClient — thin wrapper around the official @decartai/sdk realtime API.
 *
 * Responsibilities:
 *  - createDecartClient({ apiKey: clientToken }) with the SHORT-LIVED token
 *    minted by the Raritone backend (never a permanent API key).
 *  - connect(local camera MediaStream) -> remote AI-transformed MediaStream.
 *  - setGarment(blob, description) -> switch garment mid-session via setImage().
 *  - disconnect / reconnect with exponential backoff.
 *  - emit connection-state + error events for the UI.
 *
 * The LiveKit/WebRTC transport is fully managed inside the Decart SDK
 * ("Realtime media uses LiveKit only"); this class deliberately does not
 * construct its own LiveKit Room — livekit-client is a peer dependency of
 * the SDK.
 */

import { createDecartClient, isRealtimeModel, models } from "@decartai/sdk";
import type { RealTimeClient, ConnectionState as SdkConnectionState } from "@decartai/sdk";

export type LiveVtoConnectionState =
  | "idle"
  | "connecting"
  | "connected" // camera connected, waiting for first AI frames
  | "generating" // AI frames flowing (digital mirror active)
  | "reconnecting"
  | "disconnected"
  | "error";

export interface LiveVtoEvents {
  onStateChange: (state: LiveVtoConnectionState) => void;
  /** Fired when the AI-transformed remote stream arrives. */
  onRemoteStream: (stream: MediaStream) => void;
  onError: (err: Error) => void;
  /** Fired when the provider ends the session deliberately (no reconnect). */
  onSessionEnded: (reason: string) => void;
}

export interface ConnectParams {
  /** Short-lived token from POST /api/live-vto/session. */
  clientToken: string;
  /** Canonical model id, e.g. "lucy-vton-latest". */
  modelId: string;
  /** Local camera stream from getUserMedia. */
  localStream: MediaStream;
  /** Optional garment applied at connect time (no reconnect needed later). */
  initialGarment?: { blob: Blob; description: string };
  /**
   * Called when the connection drops and we need a FRESH token to
   * re-authenticate. The UI wires this to POST /api/live-vto/session.
   */
  refreshSession?: () => Promise<{ clientToken: string; modelId: string }>;
  /**
   * Optional prompt enhancer: given the garment image + a live camera frame,
   * return a precise try-on prompt (or null to use the template fallback).
   * Enhancement is best-effort — failures fall back to the template prompt.
   */
  enhancePrompt?: (garment: Blob, frame: Blob) => Promise<string | null>;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1500;
/** Max frame width captured for prompt enhancement (keeps uploads small). */
const ENHANCE_FRAME_MAX_WIDTH = 640;

function mapSdkState(s: SdkConnectionState): LiveVtoConnectionState {
  switch (s) {
    case "connecting":
      return "connecting";
    case "connected":
      return "connected";
    case "generating":
      return "generating";
    case "reconnecting":
      return "reconnecting";
    case "disconnected":
      return "disconnected";
  }
}

export class LiveVtoClient {
  private rtClient: RealTimeClient | null = null;
  private events: LiveVtoEvents;
  private state: LiveVtoConnectionState = "idle";
  private disposed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastParams: ConnectParams | null = null;
  private applyingGarment = false;

  constructor(events: LiveVtoEvents) {
    this.events = events;
  }

  get connectionState(): LiveVtoConnectionState {
    return this.state;
  }

  /** True while a setImage() garment switch is in flight. */
  get isApplyingGarment(): boolean {
    return this.applyingGarment;
  }

  private setState(next: LiveVtoConnectionState) {
    if (this.disposed || this.state === next) return;
    this.state = next;
    this.events.onStateChange(next);
  }

  /**
   * Connect the local camera stream to the Decart realtime VTON model.
   * Resolves once the SDK reports a live connection; the AI video arrives
   * asynchronously through onRemoteStream.
   */
  async connect(params: ConnectParams): Promise<void> {
    if (this.disposed) throw new Error("LiveVtoClient has been disposed.");
    this.clearReconnectTimer();
    this.lastParams = params;
    this.reconnectAttempts = 0;
    this.setState("connecting");

    try {
      const client = createDecartClient({ apiKey: params.clientToken });
      // The backend supplies the canonical model id (e.g. "lucy-vton-latest").
      // Narrow it with the SDK's type guard; fall back to the verified VTON
      // model when the backend sends something unrecognized.
      const modelName = isRealtimeModel(params.modelId) ? params.modelId : "lucy-vton-latest";
      const rtClient = await client.realtime.connect(params.localStream, {
        model: models.realtime(modelName),
        onRemoteStream: (remoteStream: MediaStream) => {
          this.events.onRemoteStream(remoteStream);
        },
        onConnectionChange: (sdkState) => {
          if (this.disposed) return;
          this.setState(mapSdkState(sdkState));
          if (sdkState === "connected" || sdkState === "generating") {
            this.reconnectAttempts = 0; // healthy again
          }
          if (sdkState === "disconnected") {
            this.scheduleReconnect();
          }
        },
        mirror: "auto",
      });

      rtClient.on("sessionEnded", (evt) => {
        // Terminal by design: the provider ended the session.
        this.clearReconnectTimer();
        this.setState("disconnected");
        this.events.onSessionEnded(evt.reason ?? "Session ended by provider.");
      });
      rtClient.on("error", (err) => {
        this.events.onError(err instanceof Error ? err : new Error(String(err)));
      });

      this.rtClient = rtClient;

      if (params.initialGarment) {
        await this.setGarment(params.initialGarment.blob, params.initialGarment.description);
      }
    } catch (err) {
      this.setState("error");
      this.events.onError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Switch the garment mid-session WITHOUT reconnecting.
   * Uses rtClient.setImage(blob, { prompt, enhance: false }).
   *
   * When an enhancePrompt hook is wired (see ConnectParams), the prompt is a
   * vision-written description of the garment + the wearer's current frame;
   * otherwise a plain template prompt is used. Enhancement is best-effort:
   * any failure silently falls back to the template so the switch is never
   * blocked.
   */
  async setGarment(image: Blob, description: string): Promise<void> {
    const client = this.rtClient;
    if (!client || !client.isConnected()) {
      throw new Error("Cannot switch garment: the live session is not connected.");
    }
    this.applyingGarment = true;
    try {
      const prompt = await this.buildGarmentPrompt(image, description);
      await client.setImage(image, { prompt, enhance: false });
    } finally {
      this.applyingGarment = false;
    }
  }

  /** Build the try-on prompt: vision-enhanced when possible, template fallback. */
  private async buildGarmentPrompt(image: Blob, description: string): Promise<string> {
    const fallback = `Substitute the current top with ${description}`;
    const enhancer = this.lastParams?.enhancePrompt;
    if (!enhancer) return fallback;
    try {
      const frame = await captureVideoFrame(this.lastParams?.localStream ?? null);
      if (!frame) return fallback;
      const enhanced = await enhancer(image, frame);
      const clean = (enhanced ?? "").trim();
      return clean ? clean.slice(0, 600) : fallback;
    } catch {
      return fallback;
    }
  }

  /** Graceful user-initiated disconnect. Does NOT trigger auto-reconnect. */
  disconnect(): void {
    this.clearReconnectTimer();
    this.lastParams = null; // prevents reconnect
    try {
      this.rtClient?.disconnect();
    } finally {
      this.rtClient = null;
      this.setState("disconnected");
    }
  }

  /** Manual reconnect using the last connect params + fresh token if available. */
  async reconnect(): Promise<void> {
    const params = this.lastParams;
    if (!params) throw new Error("Nothing to reconnect: no previous session.");
    this.clearReconnectTimer();
    try {
      this.rtClient?.disconnect();
    } catch {
      /* ignore */
    }
    this.rtClient = null;

    let { clientToken, modelId } = params;
    if (params.refreshSession) {
      const fresh = await params.refreshSession();
      clientToken = fresh.clientToken;
      modelId = fresh.modelId;
    }
    await this.connect({ ...params, clientToken, modelId });
  }

  /** Permanent teardown: stops reconnect timers and the SDK client. */
  dispose(): void {
    this.disposed = true;
    this.clearReconnectTimer();
    try {
      this.rtClient?.disconnect();
    } catch {
      /* ignore */
    }
    this.rtClient = null;
    this.state = "disconnected";
  }

  /* ------------------------- private helpers ------------------------- */

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Auto-reconnect on unexpected drops with exponential backoff.
   * A fresh short-lived token is required because the original token may
   * be single-use; refreshSession is provided by the UI layer.
   */
  private scheduleReconnect() {
    if (this.disposed || !this.lastParams) return; // explicit disconnect: stay down
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const err = new Error(
        "Connection to the try-on service was lost and could not be re-established. Please reconnect manually."
      );
      this.setState("error");
      this.events.onError(err);
      return;
    }
    this.setState("reconnecting");
    const delay = RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts;
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnect().catch((err) => {
        // reconnect() failures surface through events; schedule next attempt
        // via the disconnect handler, unless we exhausted attempts.
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          this.setState("error");
          this.events.onError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    }, delay);
  }
}

/**
 * Grab a single JPEG frame from the local camera stream, downscaled for
 * upload to the prompt-enhancement endpoint. Returns null when no usable
 * video track exists. Never throws — callers treat null as "no frame".
 */
async function captureVideoFrame(stream: MediaStream | null): Promise<Blob | null> {
  const track = stream?.getVideoTracks()[0];
  if (!track || track.readyState !== "live") return null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  try {
    await video.play();
  } catch {
    return null;
  }
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, ENHANCE_FRAME_MAX_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.srcObject = null;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
  });
}
