import { useState, type ReactNode } from "react";
import { Icon } from "../components/ui";

export function CameraPermissionScreen({ onComplete }: { onComplete: () => void }): ReactNode {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCamera(): Promise<void> {
    setRequesting(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open a camera.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      onComplete();
    } catch {
      setError("Camera access is off. You can allow it in browser settings, then try again.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="rt-frame bg-ink-950" aria-labelledby="permission-title">
      <div className="rt-safe-top px-6 pt-4"><span className="text-sm font-semibold tracking-tight text-white">Raritone</span></div>
      <div className="flex flex-1 flex-col justify-center px-8">
        <div className="mb-8 grid size-20 place-items-center rounded-3xl border border-cyan-signal/30 bg-cyan-signal/10 text-cyan-signal">
          <Icon name="camera" className="size-10" />
        </div>
        <p className="rt-eyebrow text-cyan-signal">One quick setup</p>
        <h1 id="permission-title" className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-white">Use your camera for visual try-on</h1>
        <p className="mt-4 text-base leading-7 text-white/65">
          Raritone needs camera access to show the live preview. We do not save a continuous camera stream, and you can use a photo instead.
        </p>
        {error && <p className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100" role="alert">{error}</p>}
      </div>
      <div className="rt-safe-bottom space-y-3 px-6 pb-6">
        <button className="rt-btn-primary h-11 w-full" onClick={() => void requestCamera()} disabled={requesting}>
          {requesting ? "Opening camera…" : "Allow camera"}
        </button>
        <button className="rt-btn-ghost min-h-11 w-full text-white/60" onClick={onComplete} disabled={requesting}>Continue with photo mode</button>
      </div>
    </main>
  );
}
