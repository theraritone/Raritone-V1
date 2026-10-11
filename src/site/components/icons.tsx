import type { SVGProps } from "react";

/** Small, stroke-based icons. Every icon inherits currentColor. */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function ArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function Spark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v4m0 10v4m-9-9h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8" />
    </svg>
  );
}

export function Flame(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.3-4.6-2.9-6.4-.5 1-1.3 1.9-2.1 2.4-.3-2.6-1.6-5.4-4-7-.2 2.4-1.2 4-2.5 5.7C5.7 11.4 5.5 13 5.5 15c0 3.6 2.6 6 6.5 6Z" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4m8-4v4" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6a2 2 0 0 0 1.7-.9l.7-1a2 2 0 0 1 1.7-.9h.9a2 2 0 0 1 1.7.9l.7 1a2 2 0 0 0 1.7.9h1.3A2.5 2.5 0 0 1 20.5 8.5v8a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 16.5Z" />
      <circle cx="12.2" cy="12.2" r="3.2" />
    </svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="8" width="17" height="12.5" rx="2" />
      <path d="M3.5 12.5h17M12 8v12.5m0-12.5S9.5 8 8 6.6a2.1 2.1 0 0 1 3-3c.6.6 1 2.4 1 4.4Zm0 0s2.5 0 4-1.4a2.1 2.1 0 0 0-3-3c-.6.6-1 2.4-1 4.4Z" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21c5-2 7.5-5.5 7.5-10.5V5.6L12 3 4.5 5.6v4.9C4.5 15.5 7 19 12 21Z" />
      <path d="m9 11.6 2.2 2.2L15.4 9" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

export function TshirtIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8.5 4 4 6.8l1.8 4 2.2-.9V20h8v-10l2.2.9 1.8-4L15.5 4a3.5 3.5 0 0 1-7 0Z" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.6A8.5 8.5 0 1 1 20.5 12Z" />
    </svg>
  );
}

export function TrendIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m3.5 16.5 5-5 3.5 3.5 7-7.5m0 0h-4.5m4.5 0V12" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20s-7.5-4.4-7.5-9.5A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9C19.5 15.6 12 20 12 20Z" />
    </svg>
  );
}
