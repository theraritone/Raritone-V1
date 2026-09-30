import type { ReactNode } from "react";
import { QUALITY_HINT, QUALITY_LABEL, type QualityState } from "../../shared/types";

/** Small, dependency-free icons drawn as inline SVG so nothing loads over the network. */

export function Icon({
  name,
  className = "size-6",
}: {
  name:
    | "flash"
    | "flip"
    | "close"
    | "heart"
    | "heart-filled"
    | "share"
    | "download"
    | "link"
    | "plus"
    | "camera"
    | "check"
    | "alert"
    | "chevron-left"
    | "trash"
    | "sparkle"
    | "spinner"
    | "more"
    | "sun"
    | "zoom-in"
    | "grid"
    | "user";
  className?: string;
}): ReactNode {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "flash":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
    case "flip":
      return (
        <svg {...common}>
          <path d="M4 8V6a2 2 0 0 1 2-2h2M20 8V6a2 2 0 0 0-2-2h-2M4 16v2a2 2 0 0 0 2 2h2M20 16v2a2 2 0 0 1-2 2h-2" />
          <path d="M8 10a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6 18 18M18 6 6 18" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z" />
        </svg>
      );
    case "heart-filled":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <path d="M12 3v12M12 3 8 7M12 3l4 4" />
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12M12 15l-4-4M12 15l4-4" />
          <path d="M5 18v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 13a4 4 0 0 0 5.66 0l2.34-2.34a4 4 0 0 0-5.66-5.66L11 6.34" />
          <path d="M14 11a4 4 0 0 0-5.66 0L6 13.34a4 4 0 0 0 5.66 5.66L13 17.66" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
          <path d="M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 13 4 4L19 7" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M12 4 2.5 20h19L12 4Z" />
          <path d="M12 10v4M12 17.5v.5" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common}>
          <path d="m14 6-6 6 6 6" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
          <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
        </svg>
      );
    case "spinner":
      return (
        <svg {...common} className={`${className} animate-spin`}>
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      );
    case "more":
      return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case "sun":
      return <svg {...common}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "zoom-in":
      return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6" /></svg>;
    case "grid":
      return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.1 3.1-4.7 7-4.7s6.2 1.6 7 4.7" /></svg>;
  }
}

/** The PRD requires the AI disclosure to be visible wherever output appears. */
export function AiDisclosure({ className = "" }: { className?: string }): ReactNode {
  return (
    <p className={`text-[11px] leading-tight text-white/70 ${className}`}>
      <span className="font-semibold text-white/85">AI try-on</span> · illustrative, not a true fit or size
      guide
    </p>
  );
}

/** Quality state, always visible, never colour-only. */
export function QualityBadge({ state, className = "" }: { state: QualityState; className?: string }): ReactNode {
  if (state === "ready") return null;
  const tone =
    state === "unsupported"
      ? "bg-white/10 text-white/70 border-white/15"
      : "bg-amber-400/15 text-amber-100 border-amber-300/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone} ${className}`}>
      {QUALITY_LABEL[state]}
    </span>
  );
}

export function QualityHint({ state }: { state: QualityState }): ReactNode {
  if (state === "ready") return null;
  return <p className="text-xs text-ink-400">{QUALITY_HINT[state]}</p>;
}

/**
 * The shimmer shown while a try-on is generating. `prefers-reduced-motion`
 * replaces it with a static, still-legible indicator rather than removing it.
 */
export function GeneratingShimmer({ label }: { label: string }): ReactNode {
  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center"
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-ink-900/45 motion-safe:animate-shimmer" />
      <div className="relative flex flex-col items-center gap-3">
        <Icon name="sparkle" className="size-8 text-ink-100 motion-safe:animate-pulse" />
        <p className="text-sm font-medium text-white">{label}</p>
      </div>
    </div>
  );
}
