import { useEffect, useState, type ReactNode } from "react";
import { Link, usePath } from "../router";
import { LogoLink } from "./Logo";
import { CloseIcon, MenuIcon } from "./icons";

const NAV: Array<{ to: string; label: string }> = [
  { to: "/live-try-on", label: "Live Try-On" },
  { to: "/style-streak", label: "Style Streak" },
  { to: "/membership", label: "Membership" },
  { to: "/rewards", label: "Rewards" },
  { to: "/brands", label: "For Brands" },
  { to: "/about", label: "About" },
];

/**
 * The site header. Transparent over the paper canvas, solid on scroll, with a
 * full-screen menu on small screens. The signed-in state is intentionally not
 * shown here — the server session is read by the dashboard and auth pages, and
 * /dashboard simply redirects to sign-in when there is no session.
 */
export function SiteHeader(): ReactNode {
  const path = usePath();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation and lock body scroll while open.
  useEffect(() => setMenuOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-200 ${
        scrolled || menuOpen ? "border-b border-coal/8 bg-paper/90 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="st-container flex h-16 items-center justify-between gap-4">
        <LogoLink />

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`text-sm font-medium transition-colors ${
                path === item.to ? "text-coal underline underline-offset-8" : "text-coal-500 hover:text-coal"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/sign-in" className="text-sm font-medium text-coal-500 hover:text-coal">
            Sign In
          </Link>
          <Link to="/membership" className="st-btn-primary">
            Start Your Style Streak
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full text-coal lg:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CloseIcon width={22} height={22} /> : <MenuIcon width={22} height={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-paper lg:hidden">
          <nav aria-label="Mobile" className="st-container flex flex-col gap-1 py-6">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-xl px-3 py-3.5 text-lg font-medium ${
                  path === item.to ? "bg-cream text-coal" : "text-coal-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link to="/faq" className="rounded-xl px-3 py-3.5 text-lg font-medium text-coal-700">
              FAQ
            </Link>
            <Link to="/contact" className="rounded-xl px-3 py-3.5 text-lg font-medium text-coal-700">
              Contact
            </Link>
            <div className="mt-4 flex flex-col gap-3 border-t border-coal/10 pt-5">
              <Link to="/sign-in" className="st-btn-outline w-full">
                Sign In
              </Link>
              <Link to="/membership" className="st-btn-primary w-full">
                Start Your Style Streak
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
