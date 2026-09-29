import { useCallback, useEffect, useRef, useState } from "react";
import type { QualityState } from "../../shared/types";
import { ApiError, api, resolveAppUrl } from "../state/api";
import { randomHex } from "../state/device";
import { LiveVtoClient, type LiveVtoConnectionState } from "./liveVtoClient";

/**
 * The try-on session: a garment, a camera, and the provider's output.
 *
 * FR-104 wants live try-on to be the default on the camera and photo mode to be
 * an explicit choice; FR-105 requires a garment switch to stay inside the running
 * session, so switching swaps the garment rather than starting over.
 *
 * There are two honest ways a frame can reach the screen, and the mint response
 * decides which one this session gets:
 *
 *  - `server` — the provider composites frames on our side and we poll them.
 *    The camera frame is posted because the browser cannot hand a live video to
 *    a server, and `fps` comes from the server's bootstrap so both sides agree.
 *
 *  - `browser` — the provider streams to the guest's own browser over WebRTC.
 *    Person pixels travel camera-to-model directly and never pass through our
 *    server, which is why this mode posts no frame at all. The Decart client in
 *    `liveVtoClient.ts` owns that connection; this hook owns the session around
 *    it: the short-lived token, the garment, and the end that records cost.
 *
 * Neither mode ever invents a frame. If the realtime client cannot initialize,
 * the guest is told plainly rather than shown something that only looks like a
 * try-on.
 */

export type TryOnPhase =
  | "idle"
  | "starting"
  | "live"
  | "switching"
  | "generating"
  | "error"
  | "ended";

/** Required copy whenever the realtime try-on cannot be brought up. */
const UNAVAILABLE_MESSAGE = "Try-on unavailable — check your connection.";

/** A session that never renders a frame must not leave a guest at a shimmer. */
const FIRST_FRAME_TIMEOUT_MS = 30_000;

const TICK_MS = 1000;

export interface LiveSessionResponse {
  sessionId: string;
  mode: "live";
  phase: string;
  providerClass: string;
  garment: { itemId: string; name: string; category: string };
  /** null for browser-rendered sessions: they have no server-visible frame. */
  frame: { imageUrl: string; frameIndex: number; generatedAt: string } | null;
  expiresAt: string;
  fps: number;
  /** Short-lived SDK credentials. Only present for browser-rendered sessions. */
  browser?: { clientToken: string; modelId: string | null };
}

export interface PhotoJobResponse {
  jobId: string;
  mode: "photo";
  phase: "queued" | "processing" | "ready" | "failed" | "blocked";
  progress: number;
  stage: string;
  resultUrl?: string;
  qualityState?: QualityState;
  error?: { category: string; message: string; nextAction: string; retryIsFree: boolean };
}

/** Just enough garment detail for the model's substitution prompt. */
export interface GarmentRef {
  imageUrl: string;
  name: string;
}

export interface TryOnController {
  phase: TryOnPhase;
  /** The composited output to render over the camera, or null while generating. */
  resultUrl: string | null;
  /** Increments per frame, so the renderer knows to redraw even if the URL repeats. */
  frameIndex: number;
  error: ApiError | null;
  /** The garment the session is currently wearing. */
  activeItemId: string | null;
  sessionId: string | null;
  /** Seconds left in the session, per FR-106. */
  secondsRemaining: number | null;
  /** Provider progress label, e.g. "Fitting the garment". */
  stage: string;
  busy: boolean;

  /**
   * The live AI video for a browser-rendered session. Null in server-rendered
   * mode and before the first frame arrives — the renderer must treat null as
   * "nothing has been generated yet", never as a placeholder.
   */
  remoteStream: MediaStream | null;
  /** The realtime client's own connection state, for status copy. */
  liveState: LiveVtoConnectionState;
  /** The garment whose switch is in flight, so the carousel can show progress. */
  applyingItemId: string | null;

  startLive: (input: {
    itemId: string;
    /**
     * The camera frame to post. Null for browser-rendered sessions, whose
     * pixels go straight to the model and must never reach this server.
     */
    frame: string | null;
    width: number;
    height: number;
    /** The live camera tracks the realtime client will send upstream. */
    localStream?: MediaStream | null;
    garment?: GarmentRef | null;
  }) => Promise<void>;
  switchGarment: (itemId: string, garment?: GarmentRef | null) => Promise<void>;
  startPhoto: (input: { itemId: string; frame: string; width: number; height: number }) => Promise<void>;
  end: () => Promise<void>;
  reset: () => void;
}

/** Coarse, provider-agnostic copy for the shimmer while a frame is generated. */
const STAGE_TEXT: Record<string, string> = {
  queued: "Queued",
  processing: "Generating your try-on",
  uploading: "Sending your frame",
  compositing: "Fitting the garment",
  done: "Done",
};

function unavailableError(): ApiError {
  return new ApiError({
    status: 503,
    category: "provider_unavailable",
    message: UNAVAILABLE_MESSAGE,
    nextAction: "Check your connection and try again.",
    retryIsFree: true,
  });
}

/** The garment image must already be in the browser: it is what gets swapped. */
async function fetchGarmentBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(resolveAppUrl(imageUrl));
  if (!response.ok) throw new Error(`Garment image failed with ${response.status}.`);
  return await response.blob();
}

export function useTryOn(): TryOnController {
  const [phase, setPhase] = useState<TryOnPhase>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [liveState, setLiveState] = useState<LiveVtoConnectionState>("idle");
  const [applyingItemId, setApplyingItemId] = useState<string | null>(null);

  const pollTimer = useRef<number | null>(null);
  const lastCursor = useRef(0);
  // A retry must reuse its token, or a dropped response costs a second allowance.
  const token = useRef<string | null>(null);

  const clientRef = useRef<LiveVtoClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const activeItemIdRef = useRef<string | null>(null);
  /**
   * Which kind of session is running. The poller must know before React has
   * finished re-rendering, or it would ask a browser-rendered session for
   * server frames that do not exist.
   */
  const browserSessionRef = useRef(false);
  // Kept so an auto-reconnect can mint a replacement session with the same
  // dimensions the first one used, without asking React for them.
  const mintArgsRef = useRef<{ itemId: string; width: number; height: number } | null>(null);
  const firstFrameTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (firstFrameTimer.current !== null) {
      clearTimeout(firstFrameTimer.current);
      firstFrameTimer.current = null;
    }
    if (tickTimer.current !== null) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
  }, []);

  useEffect(() => clearPolling, [clearPolling]);
  useEffect(() => clearTimers, [clearTimers]);

  /** Stop the realtime client and its timers. Does not touch the server. */
  const detachClient = useCallback(() => {
    const client = clientRef.current;
    clientRef.current = null;
    try {
      client?.dispose();
    } catch {
      // Tearing down must never be the thing that throws.
    }
    setRemoteStream(null);
    setLiveState("disconnected");
  }, []);

  const reset = useCallback(() => {
    clearPolling();
    clearTimers();
    detachClient();
    setPhase("idle");
    setResultUrl(null);
    setFrameIndex(0);
    setError(null);
    setActiveItemId(null);
    setSessionId(null);
    setSecondsRemaining(null);
    setStage("");
    setApplyingItemId(null);
    token.current = null;
    sessionIdRef.current = null;
    activeItemIdRef.current = null;
    browserSessionRef.current = false;
    mintArgsRef.current = null;
  }, [clearPolling, clearTimers, detachClient]);

  /**
   * Leaving live mode, or the camera screen itself, ends the session. Closing
   * the realtime connection first stops the model billing, then the server call
   * records the duration and cost that the adapter logs.
   */
  const end = useCallback(async () => {
    clearPolling();
    clearTimers();
    detachClient();
    const id = sessionIdRef.current ?? sessionId;
    sessionIdRef.current = null;
    browserSessionRef.current = false;
    setSessionId(null);
    if (id) {
      await api.delete(`/live/sessions/${id}`).catch(() => undefined);
    }
    setPhase("ended");
  }, [clearPolling, clearTimers, detachClient, sessionId]);

  /**
   * Drive the countdown a browser-rendered session gets from its own expiry.
   * Server-rendered sessions get theirs from each polled frame instead.
   */
  const startClock = useCallback((expiresAt: string) => {
    if (tickTimer.current !== null) clearInterval(tickTimer.current);
    const remaining = (): number =>
      Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 1000));
    setSecondsRemaining(remaining());
    tickTimer.current = window.setInterval(() => {
      const left = remaining();
      setSecondsRemaining(left);
      if (left <= 0 && tickTimer.current !== null) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
    }, TICK_MS);
  }, []);

  /**
   * Mint a replacement session for an auto-reconnect. The old one is ended so
   * its time is billed and released, exactly as the first one would be.
   */
  const refreshSession = useCallback(async (): Promise<{ clientToken: string; modelId: string }> => {
    const mint = mintArgsRef.current;
    if (!mint) throw unavailableError();
    const fresh = await api.post<LiveSessionResponse>("/live/sessions", {
      itemId: mint.itemId,
      clientToken: `liv_${randomHex(16)}`,
      personWidth: mint.width,
      personHeight: mint.height,
    });
    if (!fresh.browser?.clientToken) throw unavailableError();
    const previous = sessionIdRef.current;
    if (previous) {
      sessionIdRef.current = null;
      await api.delete(`/live/sessions/${previous}`).catch(() => undefined);
    }
    sessionIdRef.current = fresh.sessionId;
    browserSessionRef.current = true;
    setSessionId(fresh.sessionId);
    startClock(fresh.expiresAt);
    return {
      clientToken: fresh.browser.clientToken,
      modelId: fresh.browser.modelId ?? "lucy-vton-latest",
    };
  }, [startClock]);

  /**
   * Bring up the Decart client on the token the server just minted. Resolves
   * once the connection exists; the AI video then arrives through onRemoteStream
   * and is what the camera screen renders in place of the raw feed.
   */
  const connectRealtime = useCallback(
    async (data: LiveSessionResponse, localStream: MediaStream | null, garment: GarmentRef | null) => {
      const browser = data.browser;
      if (!browser?.clientToken || !localStream) throw unavailableError();

      let initialGarment: { blob: Blob; description: string } | undefined;
      if (garment) {
        try {
          initialGarment = { blob: await fetchGarmentBlob(garment.imageUrl), description: garment.name };
        } catch {
          // A garment we cannot load is a try-on we cannot honestly perform.
          throw unavailableError();
        }
      }

      const client = new LiveVtoClient({
        onStateChange: setLiveState,
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          setPhase("live");
        },
        // Every realtime failure reads the same way to a guest: the try-on is
        // not available. Never a fabricated frame, never a silent stall.
        onError: () => {
          setError(unavailableError());
          setPhase("error");
        },
        onSessionEnded: () => {
          setError(unavailableError());
          setPhase("error");
        },
      });

      clientRef.current = client;
      await client.connect({
        clientToken: browser.clientToken,
        modelId: browser.modelId ?? "lucy-vton-latest",
        localStream,
        initialGarment,
        refreshSession,
      });
    },
    [refreshSession],
  );

  const startLive = useCallback<TryOnController["startLive"]>(
    async ({ itemId, frame, width, height, localStream, garment }) => {
      setPhase("starting");
      setError(null);
      setActiveItemId(itemId);
      activeItemIdRef.current = itemId;
      mintArgsRef.current = { itemId, width, height };

      const clientToken = token.current ?? `liv_${randomHex(16)}`;
      token.current = clientToken;

      const body: Record<string, unknown> = { itemId, clientToken, personWidth: width, personHeight: height };
      // Server-rendered providers composite onto this frame; browser-rendered
      // ones never receive it, because those pixels belong to the model.
      if (frame) body.personFrame = frame;

      try {
        const data = await api.post<LiveSessionResponse>("/live/sessions", body);
        setSessionId(data.sessionId);
        sessionIdRef.current = data.sessionId;
        browserSessionRef.current = Boolean(data.browser);
        lastCursor.current = 0;

        if (data.browser) {
          startClock(data.expiresAt);
          await connectRealtime(data, localStream ?? null, garment ?? null);
          if (!firstFrameTimer.current) {
            // The connection can succeed and still never deliver a frame. That
            // is a failure to try on, so it says so rather than shimmering.
            firstFrameTimer.current = window.setTimeout(() => {
              firstFrameTimer.current = null;
              void (async () => {
                await end();
                setPhase("error");
                setError(unavailableError());
              })();
            }, FIRST_FRAME_TIMEOUT_MS);
          }
          return;
        }

        if (!data.frame) throw unavailableError();
        setSecondsRemaining(
          Math.max(0, Math.round((Date.parse(data.expiresAt) - Date.now()) / 1000)),
        );
        setResultUrl(data.frame.imageUrl);
        setFrameIndex(data.frame.frameIndex);
        setPhase("live");
      } catch (caught) {
        // A session that never became usable still bills by the second, so it
        // is released before the guest is told what happened.
        if (sessionIdRef.current) await end();
        setPhase("error");
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError({
                status: 0,
                category: "provider_unavailable",
                message: UNAVAILABLE_MESSAGE,
              }),
        );
      }
    },
    [connectRealtime, startClock, end],
  );

  /**
   * Live frames are pulled rather than pushed: the browser has no server-sent
   * frames available to a PWA without a second connection per session, and
   * polling at the session's own fps is indistinguishable in practice.
   */
  const pollLive = useCallback(
    async (id: string) => {
      try {
        const data = await api.get<{
          frame: { imageUrl: string; frameIndex: number } | null;
          garment: { itemId: string };
          expiresAt: string;
          fps: number;
          ended: boolean;
        }>(`/live/sessions/${id}/frame?after=${lastCursor.current}`);

        if (data.frame && data.frame.frameIndex >= lastCursor.current) {
          lastCursor.current = data.frame.frameIndex;
          setResultUrl(data.frame.imageUrl);
          setFrameIndex(data.frame.frameIndex);
        }
        setActiveItemId(data.garment.itemId);
        setSecondsRemaining(Math.max(0, Math.round((Date.parse(data.expiresAt) - Date.now()) / 1000)));

        if (data.ended || data.expiresAt !== undefined && Date.parse(data.expiresAt) <= Date.now()) {
          clearPolling();
          setPhase("ended");
          return;
        }
        pollTimer.current = window.setTimeout(() => void pollLive(id), Math.max(80, 1000 / (data.fps || 8)));
      } catch (caught) {
        // A single missed poll is not a failure; only give up if the session is
        // genuinely gone, which the server reports as 404.
        if (caught instanceof ApiError && caught.status === 404) {
          clearPolling();
          setPhase("ended");
          return;
        }
        pollTimer.current = window.setTimeout(() => void pollLive(id), 1200);
      }
    },
    [clearPolling],
  );

  // Polling starts as soon as there is a server-rendered session, and stops on
  // unmount. Browser-rendered sessions never poll: their frames arrive over
  // WebRTC, and asking the server for one would only ever get nothing back.
  useEffect(() => {
    if (!sessionId || browserSessionRef.current) return;
    void pollLive(sessionId);
    return clearPolling;
  }, [sessionId, pollLive, clearPolling]);

  const switchGarment = useCallback<TryOnController["switchGarment"]>(
    async (itemId, garment) => {
      if (!sessionId) {
        // No session running: the next capture starts one with this garment.
        setActiveItemId(itemId);
        activeItemIdRef.current = itemId;
        return;
      }

      // Server first: it is the authority on whether this garment may be tried
      // on at all, and it records the swap against the running session.
      setPhase("switching");
      setApplyingItemId(itemId);
      try {
        await api.post<{ garment: { itemId: string } }>(`/live/sessions/${sessionId}/garment`, { itemId });
        setActiveItemId(itemId);
        activeItemIdRef.current = itemId;

        const client = clientRef.current;
        if (client) {
          // FR-105 in the browser: setImage() on the connection that already
          // exists. Same session, same token, no reconnect, no new mint.
          if (!garment) throw unavailableError();
          const blob = await fetchGarmentBlob(garment.imageUrl);
          await client.setGarment(blob, garment.name);
        } else {
          setResultUrl(null);
        }
        setPhase("live");
      } catch (caught) {
        // FR-105: a failed switch must not end the session. Show the reason and
        // keep the garment that is already being worn.
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError({
                status: 0,
                category: "provider_unavailable",
                message: UNAVAILABLE_MESSAGE,
              }),
        );
        setPhase("live");
      } finally {
        setApplyingItemId(null);
      }
    },
    [sessionId],
  );

  const startPhoto = useCallback<TryOnController["startPhoto"]>(
    async ({ itemId, frame, width, height }) => {
      setPhase("generating");
      setError(null);
      setActiveItemId(itemId);
      const clientToken = token.current ?? `pho_${randomHex(16)}`;
      token.current = clientToken;
      setStage(STAGE_TEXT.queued);

      const poll = async (): Promise<void> => {
        try {
          const job = await api.get<PhotoJobResponse>(`/tryons/${clientToken}`);
          setStage(STAGE_TEXT[job.stage] ?? job.stage);
          if (job.phase === "ready" && job.resultUrl) {
            setResultUrl(job.resultUrl);
            setFrameIndex((current) => current + 1);
            setPhase("idle");
            token.current = null;
            return;
          }
          if (job.phase === "failed" || job.phase === "blocked") {
            setPhase("error");
            setError(
              new ApiError({
                status: 409,
                category: (job.error?.category as ApiError["category"]) ?? "provider_failed",
                message: job.error?.message ?? "That try-on didn't work.",
                nextAction: job.error?.nextAction ?? "Try again.",
                retryIsFree: job.error?.retryIsFree ?? true,
              }),
            );
            return;
          }
          pollTimer.current = window.setTimeout(() => void poll(), 700);
        } catch (caught) {
          setPhase("error");
          setError(
            caught instanceof ApiError
              ? caught
              : new ApiError({ status: 0, category: "internal", message: "Lost the try-on." }),
          );
        }
      };

      try {
        await api.post<{ jobId: string }>("/tryons", {
          itemId,
          personFrame: frame,
          personWidth: width,
          personHeight: height,
          clientToken,
        });
        void poll();
      } catch (caught) {
        setPhase("error");
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError({ status: 0, category: "internal", message: "Couldn't start that try-on." }),
        );
      }
    },
    [],
  );

  return {
    phase,
    resultUrl,
    frameIndex,
    error,
    activeItemId,
    sessionId,
    secondsRemaining,
    stage,
    remoteStream,
    liveState,
    applyingItemId,
    busy: phase === "starting" || phase === "switching" || phase === "generating",
    startLive,
    switchGarment,
    startPhoto,
    end,
    reset,
  };
}
