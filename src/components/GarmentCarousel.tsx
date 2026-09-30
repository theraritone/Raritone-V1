import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WardrobeItem } from "../../shared/types";
import { resolveAppUrl } from "../state/api";
import { Icon, QualityBadge } from "./ui";

/**
 * The garment carousel.
 *
 * Snap-scrolling is native CSS rather than a JS scroller: it keeps momentum on
 * iOS, stays accessible, and cannot drift out of sync with the selection ring.
 * Selection is derived from the scroll position so a swipe and a tap both end up
 * in the same place, and the selected item is scrolled into view when it changes
 * from elsewhere (e.g. after a switch from the wardrobe screen).
 */
export function GarmentCarousel({
  items,
  selectedId,
  onSelect,
  className = "",
}: {
  items: WardrobeItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}): ReactNode {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const suppressScrollSync = useRef(false);
  const [centeredId, setCenteredId] = useState<string | null>(selectedId);

  // Jump to the selected garment when the selection changes from outside.
  useEffect(() => {
    if (!selectedId) return;
    const track = trackRef.current;
    const node = track?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(selectedId)}"]`);
    if (!track || !node) return;
    const target = node.offsetLeft - (track.clientWidth - node.clientWidth) / 2;
    if (Math.abs(track.scrollLeft - target) < 2) return;
    suppressScrollSync.current = true;
    track.scrollTo({ left: target, behavior: "smooth" });
  }, [selectedId, items]);

  const handleScroll = (): void => {
    if (suppressScrollSync.current) {
      suppressScrollSync.current = false;
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let bestId: string | null = null;
    let bestDistance = Infinity;
    let bestWidth = 0;
    for (const node of Array.from(track.children) as HTMLElement[]) {
      const id = node.dataset.itemId;
      if (!id) continue;
      const nodeCenter = node.offsetLeft + node.clientWidth / 2;
      const distance = Math.abs(nodeCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
        bestWidth = node.clientWidth;
      }
    }
    // Only report a change once a card is genuinely under the ring, so a slow
    // swipe does not fire a switch on every intermediate frame.
    if (bestId && bestId !== centeredId && bestDistance < bestWidth) {
      setCenteredId(bestId);
      onSelect(bestId);
    }
  };

  if (items.length === 0) {
    return (
      <div className={`px-6 text-center text-sm text-white/60 ${className}`}>
        No garments yet. Add one from your wardrobe.
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-[calc(50%-44px)] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Garments"
      >
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              data-item-id={item.id}
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(item.id)}
              className="relative w-[88px] shrink-0 snap-center"
            >
              <span
                className={`block aspect-[3/4] overflow-hidden rounded-2xl border-2 bg-[#f3effd] transition-[border-color,transform] ${
                  selected
                    ? "border-violet-300 shadow-lg shadow-violet-950/40"
                    : "border-white/15 opacity-70"
                }`}
              >
                <img
                  src={resolveAppUrl(item.imageUrl)}
                  alt={item.name}
                  className="size-full object-contain"
                  loading="lazy"
                  draggable={false}
                />
              </span>
              {item.isFavorite ? (
                <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-ink-900/80 text-rose-300">
                  <Icon name="heart-filled" className="size-3" />
                </span>
              ) : null}
              <QualityBadge state={item.qualityState} className="absolute inset-x-0 -bottom-1 mx-auto w-fit" />
              <span
                className={`mt-1.5 block truncate text-[11px] ${selected ? "text-white" : "text-white/55"}`}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
