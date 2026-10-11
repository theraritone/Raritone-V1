import type { ReactNode } from "react";
import { Link } from "../router";
import { Logo } from "./Logo";

const COLUMNS: Array<{ title: string; links: Array<{ to: string; label: string }> }> = [
  {
    title: "Product",
    links: [
      { to: "/live-try-on", label: "Live Try-On" },
      { to: "/style-streak", label: "Style Streak" },
      { to: "/membership", label: "Membership Plans" },
      { to: "/rewards", label: "Fashion Rewards" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/brands", label: "Partner With Us" },
      { to: "/contact", label: "Contact" },
      { to: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy-policy", label: "Privacy Policy" },
      { to: "/terms-and-conditions", label: "Terms and Conditions" },
      { to: "/subscription-and-refund-policy", label: "Subscription and Refund Policy" },
    ],
  },
];

export function SiteFooter(): ReactNode {
  return (
    <footer className="border-t border-coal/10 bg-white">
      <div className="st-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-coal-500">
            Raritone is building a Snapchat-like fashion experience — try outfits virtually, keep a daily style
            calendar, and unlock eligible fashion rewards.
          </p>
          <p className="mt-4 text-sm font-medium text-coal">Your Style. Your Streak. Your Rewards.</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-coal-400">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-coal-700 hover:text-coal">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-coal/8">
        <div className="st-container flex flex-col items-start justify-between gap-2 py-6 text-xs text-coal-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Raritone Private Limited. All rights reserved.</p>
          <p>Try it. Save it. Make it your style.</p>
        </div>
      </div>
    </footer>
  );
}
