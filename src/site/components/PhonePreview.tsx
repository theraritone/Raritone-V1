import type { ReactNode } from "react";
import { CameraIcon, Flame } from "./icons";

/**
 * An illustrative interface preview for the hero — a stylised rendering of the
 * Raritone try-on screen. It is deliberately not a photograph of a result and
 * never claims to be a live camera frame; the caption under every use says the
 * product is in development.
 */
export function PhonePreview({ caption = "Product preview — Live Try-On is in development." }: { caption?: string }): ReactNode {
  return (
    <figure className="relative mx-auto w-full max-w-[320px]">
      <div className="animate-float-y rounded-[2.6rem] border border-coal/10 bg-coal p-2.5 shadow-[0_40px_80px_-32px_rgb(24_22_17/0.45)] motion-reduce:animate-none">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-gradient-to-b from-[#efe9dd] via-[#e6dccb] to-[#d8cbB2]">
          {/* Viewfinder */}
          <div className="flex aspect-[9/18.6] flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
                Live Try-On
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm">
                <CameraIcon width={14} height={14} />
              </span>
            </div>

            {/* Garment being previewed */}
            <div className="mx-auto w-full max-w-[170px]">
              <div className="rounded-2xl border border-white/50 bg-white/70 p-3 backdrop-blur-md">
                <svg viewBox="0 0 96 84" className="mx-auto h-20 w-full text-coal" aria-hidden>
                  <path
                    d="M34 10 20 18l6 13 8-3v34h28V28l8 3 6-13-14-8a12 12 0 0 1-28 0Z"
                    fill="#c8b892"
                    stroke="#181611"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                  />
                  <path d="M34 10a12 12 0 0 0 28 0" fill="none" stroke="#181611" strokeWidth="2.4" />
                </svg>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-medium text-coal-700">
                  <span className="min-w-0 truncate">Linen shirt · Added by you</span>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-gold-soft px-1.5 py-0.5 font-semibold text-gold-deep">
                    Try on
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold text-coal">
                <Flame width={12} height={12} />
                Day 12 streak
              </div>
              <div className="flex items-center justify-center">
                <span className="grid h-12 w-12 place-items-center rounded-full border-[3px] border-white/90 bg-white/20 backdrop-blur-sm">
                  <span className="h-8 w-8 rounded-full bg-white/90" />
                </span>
              </div>
            </div>
          </div>

          {/* AI disclosure — required on every try-on artifact. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 pb-3 pt-8">
            <p className="text-center text-[10px] font-medium tracking-wide text-white/90">
              AI try-on preview · illustrative visual
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-coal-400">{caption}</figcaption>
    </figure>
  );
}
