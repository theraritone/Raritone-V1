import { useState, type ReactNode } from "react";

export interface FaqItem {
  question: string;
  answer: string;
}

/** A keyboard-accessible accordion. One item open at a time. */
export function FaqAccordion({ items }: { items: FaqItem[] }): ReactNode {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-coal/8 rounded-2xl border border-coal/10 bg-white">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-coal hover:bg-paper/60 sm:px-6"
              >
                {item.question}
                <span
                  aria-hidden
                  className={`shrink-0 text-xl font-light leading-none text-coal-400 transition-transform duration-200 ${
                    expanded ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
            </h3>
            {expanded && (
              <div className="px-5 pb-5 text-sm leading-relaxed text-coal-700 sm:px-6">{item.answer}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
