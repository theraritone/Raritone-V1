import type { ReactNode } from "react";
import { Link } from "../router";

/** The Raritone brand mark (the stylised R) with the wordmark. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }): ReactNode {
  const box = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/brand/raritone-logo.jpg"
        alt="Raritone logo"
        className={`${box} rounded-xl border border-coal/10 bg-white object-contain p-0.5`}
      />
      <span className={`${text} font-semibold tracking-tight text-coal`}>Raritone</span>
    </span>
  );
}

export function LogoLink({ size = "md" }: { size?: "md" | "lg" }): ReactNode {
  return (
    <Link to="/" aria-label="Raritone home" className="inline-flex rounded-xl">
      <Logo size={size} />
    </Link>
  );
}
