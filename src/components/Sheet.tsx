import type { ReactNode } from "react";

/**
 * A bottom sheet, built on `<dialog>` so the browser handles the backdrop, the
 * top layer, focus trapping, and Escape-to-close. Only the parts that need
 * custom behaviour are hand-rolled.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <dialog
      open={open}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 max-h-[88dvh] w-full max-w-[520px] rounded-t-3xl bg-ink-900 p-0 text-white backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm sm:mx-auto sm:mb-0 sm:mt-auto"
      aria-label={title}
      aria-modal="true"
    >
      <div className="max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/25" aria-hidden />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white/75">
            <span aria-hidden className="text-xl leading-none">×</span>
          </button>
        </div>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
