import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CATEGORY_LABEL,
  GARMENT_CATEGORIES,
  QUALITY_HINT,
  WARDROBE_FILTER_LABEL,
  WARDROBE_FILTERS,
  isLaunchCategory,
  type GarmentCategory,
  type LinkImportPreview,
  type WardrobeFilter,
  type WardrobeItem,
} from "../../shared/types";
import { fileToDataUrl } from "../lib/capture";
import { ApiError, resolveAppUrl } from "../state/api";
import { useStore } from "../state/store";
import { ErrorPanel, Skeleton } from "../components/feedback";
import { Sheet } from "../components/Sheet";
import { Icon, QualityBadge } from "../components/ui";

/**
 * The wardrobe.
 *
 * Two ways in — a photo or a product link — and both are honest about what they
 * can and cannot do. A garment in a non-launch category is still saved, but it
 * says plainly that there is no try-on for it yet rather than letting the user
 * discover that at the shutter.
 *
 * The link-import failure copy is fixed by the PRD, so it is applied here at the
 * single point every import failure passes through.
 */

/** FR-201: the exact required message, whatever the underlying cause was. */
const IMPORT_FAILED_COPY = "Couldn't fetch that link — try uploading a screenshot instead.";

export function WardrobeScreen({
  onBack,
  onUseGarment,
}: {
  onBack: () => void;
  onUseGarment: (id: string) => void;
}): ReactNode {
  const {
    items,
    addItem,
    removeItem,
    toggleItemFavorite,
    importLink,
    saveLinkImport,
    flags,
    selectItem,
  } = useStore();

  const [filter, setFilter] = useState<WardrobeFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // A brief skeleton so the grid does not flash empty on every open.
    const timer = window.setTimeout(() => setLoading(false), 120);
    return () => clearTimeout(timer);
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.category === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [items]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f5fb] text-ink-950">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f7f5fb]/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="grid size-10 place-items-center rounded-full bg-white shadow-sm"
          aria-label="Back to camera"
        >
          <Icon name="chevron-left" className="size-5 text-ink-700" />
        </button>
        <h1 className="text-lg font-semibold">Wardrobe</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="grid size-10 place-items-center rounded-full bg-ink-950 text-white"
          aria-label="Add a garment"
        >
          <Icon name="plus" className="size-5" />
        </button>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter garments">
        {WARDROBE_FILTERS.map((value) => {
          const count = value === "all" ? items.length : (counts.get(value) ?? 0);
          if (value !== "all" && count === 0) return null;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                filter === value ? "bg-ink-950 text-white" : "bg-white text-ink-700 shadow-sm"
              }`}
            >
              {WARDROBE_FILTER_LABEL[value]}
              {count > 0 ? <span className="ml-1 opacity-60">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 px-4 pb-[max(5rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-[3/4]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
           <ul className="grid grid-cols-3 gap-2">
            {visible.map((item) => (
              <GarmentCard
                key={item.id}
                item={item}
                onUse={() => {
                  selectItem(item.id);
                  onUseGarment(item.id);
                }}
                onFavorite={() => void toggleItemFavorite(item.id)}
                onDelete={() => void removeItem(item.id)}
              />
            ))}
          </ul>
        )}
      </div>

       <div className="fixed inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-[#f7f5fb] via-[#f7f5fb]/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          disabled={!flags.linkImport}
           className="flex-1 rounded-full border border-ink-200 bg-white py-3 text-sm font-semibold text-ink-900 shadow-sm disabled:opacity-40"
        >
          Paste a product link
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={!flags.wardrobeUpload}
           className="flex-1 rounded-full bg-ink-950 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Add a photo
        </button>
      </div>

      <AddGarmentSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={async (input) => {
          await addItem(input);
          setAddOpen(false);
        }}
      />
      <ImportLinkSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={importLink}
        onSave={saveLinkImport}
      />
    </div>
  );
}

function GarmentCard({
  item,
  onUse,
  onFavorite,
  onDelete,
}: {
  item: WardrobeItem;
  onUse: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}): ReactNode {
  const usable = isLaunchCategory(item.category) && item.qualityState !== "unsupported";
  return (
    <li className="flex flex-col gap-1.5">
       <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-100">
        <button type="button" onClick={onUse} className="block w-full text-left" disabled={!usable}>
             <span className="block aspect-[3/4] bg-[#eeeaf6]">
            <img
              src={resolveAppUrl(item.imageUrl)}
              alt={item.name}
              className={`size-full object-contain ${usable ? "" : "opacity-45 grayscale"}`}
              loading="lazy"
            />
          </span>
        </button>
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={item.isFavorite}
          aria-label={item.isFavorite ? `Unfavourite ${item.name}` : `Favourite ${item.name}`}
             className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-white/85 text-ink-700 shadow-sm backdrop-blur"
        >
          <Icon
            name={item.isFavorite ? "heart-filled" : "heart"}
            className={`size-4 ${item.isFavorite ? "text-rose-300" : "text-white"}`}
          />
        </button>
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
             className="absolute bottom-1.5 left-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] text-ink-700 backdrop-blur"
          >
            {item.sourceLabel ?? "Source"}
          </a>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
           <p className="truncate text-xs font-semibold text-ink-950">{item.name}</p>
           <p className="text-[10px] text-ink-500">{CATEGORY_LABEL[item.category]}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${item.name}`}
           className="grid size-7 shrink-0 place-items-center rounded-full text-ink-400 hover:text-ink-800"
        >
          <Icon name="trash" className="size-4" />
        </button>
      </div>
       <QualityBadge state={item.qualityState} className="w-fit" />
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): ReactNode {
  return (
    <div className="py-16 text-center">
       <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white shadow-sm">
         <Icon name="camera" className="size-6 text-ink-500" />
      </div>
      <h2 className="text-base font-semibold">Nothing here yet</h2>
       <p className="mx-auto mt-1 max-w-[16rem] text-sm text-ink-500">
        Add a photo of a garment, or paste a product link.
      </p>
      <button
        type="button"
        onClick={onAdd}
         className="mt-5 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Add your first garment
      </button>
    </div>
  );
}

function AddGarmentSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: {
    name: string;
    imageDataUrl: string;
    category: GarmentCategory;
    source: "upload";
  }) => Promise<void>;
}): ReactNode {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GarmentCategory>("tops");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setPreview(null);
      setError(null);
      setCategory("tops");
    }
  }, [open]);

  const onPick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      // Name the garment after the file when the user has not typed one, so the
      // grid is never a wall of "New garment".
      if (!name) setName(file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't read that image.");
    }
  }, [name]);

  return (
    <Sheet open={open} onClose={onClose} title="Add a garment">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="grid w-full place-items-center rounded-2xl border border-dashed border-white/25 bg-white/5 py-8"
        >
          {preview ? (
            <img src={preview} alt="" className="max-h-40 object-contain" />
          ) : (
            <>
              <Icon name="plus" className="size-6 text-white/60" />
              <span className="mt-2 text-sm text-white/70">Choose a photo</span>
              <span className="mt-0.5 text-[11px] text-white/40">JPG, PNG, or WebP</span>
            </>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void onPick(event.target.files?.[0])}
        />

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/70">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Blue linen shirt"
            maxLength={80}
            className="w-full rounded-xl bg-white/8 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-ink-100/40"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-white/70">Category</span>
          <div className="flex flex-wrap gap-2">
            {GARMENT_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  category === value ? "bg-white text-ink-950" : "bg-white/10 text-white/70"
                }`}
              >
                {CATEGORY_LABEL[value]}
              </button>
            ))}
          </div>
          {!isLaunchCategory(category) ? (
            <p className="mt-2 text-[11px] text-amber-200/80">
              {QUALITY_HINT.unsupported} Release 1 tries on upper-body garments.
            </p>
          ) : null}
        </div>

        {error ? <ErrorPanel error={{ message: error }} onRetry={() => setError(null)} /> : null}

        <button
          type="button"
          disabled={!preview || !name.trim() || busy}
          onClick={async () => {
            if (!preview) return;
            setBusy(true);
            setError(null);
            try {
              await onAdd({ name: name.trim(), imageDataUrl: preview, category, source: "upload" });
            } catch (caught) {
              setError(
                caught instanceof ApiError ? caught.message : "Couldn't save that garment.",
              );
            } finally {
              setBusy(false);
            }
          }}
          className="w-full rounded-full bg-ink-100 py-3 text-sm font-semibold text-ink-950 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save garment"}
        </button>
      </div>
    </Sheet>
  );
}

function ImportLinkSheet({
  open,
  onClose,
  onImport,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (url: string) => Promise<LinkImportPreview>;
  onSave: (preview: LinkImportPreview, name: string) => Promise<WardrobeItem>;
}): ReactNode {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<LinkImportPreview | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setPreview(null);
      setName("");
      setError(null);
    }
  }, [open]);

  const runImport = useCallback(async () => {
    if (!url.trim()) return;
    setBusy(true);
    // Every failure — bad scheme, private address, unreachable site, no image —
    // surfaces as the one message the PRD specifies, so the copy never varies
    // with the technical cause.
    setError(null);
    setPreview(null);
    try {
      const result = await onImport(url.trim());
      setPreview(result);
      setName(result.productName.slice(0, 80));
    } catch {
      setError(IMPORT_FAILED_COPY);
    } finally {
      setBusy(false);
    }
  }, [url, onImport]);

  return (
    <Sheet open={open} onClose={onClose} title="Import from a link">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/70">Product link</span>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runImport();
              }}
              placeholder="https://…"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl bg-white/8 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/30 focus:ring-2 focus:ring-ink-100/40"
            />
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={!url.trim() || busy}
              className="shrink-0 rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-950 disabled:opacity-40"
            >
              {busy ? "…" : "Fetch"}
            </button>
          </div>
        </label>

        {error ? <ErrorPanel error={{ message: error }} onRetry={() => setError(null)} /> : null}

        {preview ? (
          <>
            <div className="flex gap-3 rounded-2xl bg-white/5 p-3">
              <img src={resolveAppUrl(preview.imageUrl)} alt="" className="size-24 shrink-0 rounded-xl object-contain" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{preview.productName}</p>
                <p className="text-[11px] text-white/50">{preview.siteName}</p>
                <p className="mt-1.5 text-[11px] text-white/60">
                  Saved as {CATEGORY_LABEL[preview.suggestedCategory]}
                </p>
              </div>
            </div>

            {preview.candidates.length > 1 ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-white/70">
                  Other images found
                </span>
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {preview.candidates.slice(0, 6).map((candidate) => (
                    <button
                      key={candidate.imageUrl}
                      type="button"
                      onClick={() => setPreview({ ...preview, imageUrl: candidate.imageUrl })}
                      className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                        preview.imageUrl === candidate.imageUrl ? "border-ink-100" : "border-transparent"
                      }`}
                    >
                      <img src={resolveAppUrl(candidate.imageUrl)} alt={candidate.label} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                className="w-full rounded-xl bg-white/8 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ink-100/40"
              />
            </label>

            {!isLaunchCategory(preview.suggestedCategory) ? (
              <p className="text-[11px] text-amber-200/80">
                {QUALITY_HINT.unsupported} It will still be saved to your wardrobe.
              </p>
            ) : null}

            <button
              type="button"
              disabled={!name.trim() || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave(preview, name.trim());
                  onClose();
                } catch (caught) {
                  setError(
                    caught instanceof ApiError ? caught.message : "Couldn't save that garment.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-full bg-ink-100 py-3 text-sm font-semibold text-ink-950 disabled:opacity-40"
            >
              Save to wardrobe
            </button>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
