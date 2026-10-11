import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";

export function NotFoundPage({ path }: { path: string }): ReactNode {
  usePageMeta({
    title: "Page not found | Raritone",
    description: "That page doesn't exist on raritone.com.",
    path,
  });

  return (
    <section className="st-container grid min-h-[60vh] place-items-center py-24 text-center">
      <div>
        <p className="font-display text-7xl font-medium italic text-gold-deep">404</p>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-coal">This look isn't in the wardrobe.</h1>
        <p className="mt-3 text-sm text-coal-500">The page you're after doesn't exist — but your next outfit does.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="st-btn-primary">
            Back to home
          </Link>
          <Link to="/style-streak" className="st-btn-outline">
            Explore the Style Streak
          </Link>
        </div>
      </div>
    </section>
  );
}
