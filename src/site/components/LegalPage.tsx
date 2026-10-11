import type { ReactNode } from "react";
import { usePageMeta } from "../meta";
import { Link } from "../router";
import { Reveal } from "../components/Reveal";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

/** Shared layout for the policy pages: readable single column, anchor list. */
export function LegalPage({
  path,
  title,
  metaTitle,
  description,
  updated,
  intro,
  sections,
  checksum = true,
}: {
  path: string;
  title: string;
  metaTitle: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  checksum?: boolean;
}): ReactNode {
  usePageMeta({ title: metaTitle, description, path });

  return (
    <>
      <section className="st-container py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl">
          <p className="st-eyebrow">Legal</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-coal sm:text-5xl">{title}</h1>
          <p className="mt-3 text-xs text-coal-400">Last updated: {updated}</p>
          <p className="mt-5 text-[15px] leading-relaxed text-coal-700">{intro}</p>
        </Reveal>
      </section>
      <section className="border-t border-coal/8 bg-white">
        <div className="st-container max-w-3xl py-14 sm:py-16">
          <div className="space-y-10">
            {sections.map((section) => (
              <Reveal key={section.heading}>
                <div>
                  <h2 className="font-display text-2xl font-medium tracking-tight text-coal">{section.heading}</h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="mt-3 text-[15px] leading-relaxed text-coal-700">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-3 space-y-2">
                      {section.bullets.map((bullet) => (
                        <li key={bullet.slice(0, 40)} className="flex gap-2.5 text-[15px] leading-relaxed text-coal-700">
                          <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
          {checksum && (
            <div className="mt-14 rounded-2xl border border-coal/10 bg-paper p-6 text-sm leading-relaxed text-coal-500">
              These documents are drafted in preparation for launch and will be reviewed for compliance with applicable
              Indian law before Raritone begins charging users. If anything here conflicts with your experience of the
              product,{" "}
              <Link to="/contact" className="font-medium text-coal underline underline-offset-2">
                tell us
              </Link>
              .
            </div>
          )}
        </div>
      </section>
    </>
  );
}
