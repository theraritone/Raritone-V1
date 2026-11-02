import type { ReactNode } from "react";
import { Icon } from "../components/ui";

const collections = [
  { title: "Everyday layers", subtitle: "Easy pieces for now", tone: "from-violet-500/50 to-cyan-400/20" },
  { title: "After-dark", subtitle: "Looks with a little edge", tone: "from-fuchsia-500/40 to-amber-300/20" },
  { title: "Quiet luxury", subtitle: "Clean, considered staples", tone: "from-stone-400/40 to-white/10" },
];

const categories = ["All", "Tops", "Dresses", "Jackets", "Accessories"];

export function DiscoverScreen({ onTryOn }: { onTryOn: () => void }): ReactNode {
  return (
    <main className="rt-frame rt-body-scroll bg-ink-950">
      <header className="rt-safe-top flex items-center justify-between px-5 pb-4 pt-3">
        <div>
          <p className="rt-eyebrow">Raritone / Discover</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Find your next look</h1>
        </div>
        <button className="rt-icon-btn" aria-label="Search fashion" type="button">
          <span aria-hidden="true">⌕</span>
        </button>
      </header>

      <section className="px-5" aria-labelledby="discover-heading">
        <div className="rt-panel overflow-hidden bg-gradient-to-br from-violet-500/25 via-white/[0.05] to-cyan-400/10 p-5">
          <div className="max-w-[245px]">
            <p className="rt-eyebrow text-cyan-200/80">Curated for your wardrobe</p>
            <h2 id="discover-heading" className="mt-2 text-3xl font-semibold leading-tight text-white">
              Try the mood, then make it yours.
            </h2>
            <p className="mt-3 text-sm leading-5 text-white/65">
              Explore inspiration and take any supported piece into a real try-on when you are ready.
            </p>
            <button className="rt-btn rt-btn-primary mt-5 h-11" type="button" onClick={onTryOn}>
              <Icon name="sparkle" className="size-4" /> Try something on
            </button>
          </div>
        </div>
      </section>

      <section className="mt-7 px-5" aria-labelledby="collections-heading">
        <div className="flex items-end justify-between">
          <div>
            <p className="rt-eyebrow">Editorial picks</p>
            <h2 id="collections-heading" className="mt-1 text-xl font-semibold text-white">Collections</h2>
          </div>
          <button className="rt-btn-ghost text-xs" type="button">See all</button>
        </div>
        <div className="rt-scroll-x mt-4 pb-1">
          {collections.map((collection) => (
            <article key={collection.title} className={`rt-snap min-w-[220px] rounded-2xl bg-gradient-to-br ${collection.tone} p-4`}>
              <div className="flex h-36 items-end rounded-xl border border-white/10 bg-black/20 p-3">
                <div>
                  <p className="text-base font-semibold text-white">{collection.title}</p>
                  <p className="mt-1 text-xs text-white/60">{collection.subtitle}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-7 px-5 pb-28" aria-labelledby="categories-heading">
        <p className="rt-eyebrow">Browse the edit</p>
        <h2 id="categories-heading" className="mt-1 text-xl font-semibold text-white">Start with a category</h2>
        <div className="rt-scroll-x mt-4 pb-1" aria-label="Fashion categories">
          {categories.map((category, index) => (
            <button key={category} className={`rt-btn shrink-0 border px-4 py-2 text-xs ${index === 0 ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.05] text-white/70"}`} type="button">
              {category}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {["Soft tailoring", "Monochrome", "Weekend denim", "Statement layers"].map((item, index) => (
            <button key={item} className="rt-panel min-h-28 p-4 text-left transition-colors hover:border-white/25" type="button">
              <span className={`mb-7 block h-1.5 w-10 rounded-full ${index % 2 === 0 ? "bg-violet-400" : "bg-cyan-300"}`} />
              <span className="text-sm font-medium text-white">{item}</span>
              <span className="mt-1 block text-xs text-white/45">Explore looks</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
