import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { DraftNote } from "@/components/content/DraftNote";
import { Prose } from "@/components/content/Prose";
import { Toc } from "@/components/content/Toc";
import { LEGAL_UPDATED, LEGAL_UPDATED_LABEL } from "@/components/content/meta";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

export interface ReadSection {
  id: string;
  title: string;
  body: ReactNode;
  /** Skip the Prose wrapper (for accordions and other self-styled blocks). */
  bare?: boolean;
}

interface Props {
  title: string;
  intro?: ReactNode;
  /** Show the "Last updated" line (policies). */
  updated?: boolean;
  /** Show the draft banner (policies, while on sample data). */
  draft?: boolean;
  /** "The short version": three to five plain sentences that lead the page. */
  summary?: { head: string; points: ReactNode[] };
  sections: ReadSection[];
  /** Anything to place above the sections (e.g. a photo). */
  lead?: ReactNode;
  /** Hide the closing "Questions?" block. */
  noHelp?: boolean;
}

/**
 * Read-mode layout for long text: one h1, a 68ch column of h2 sections, a sticky
 * table of contents built from those same sections, and a plain "last updated" line.
 * Comprehension leads; the brand lives in the display headings and the stencil details.
 */
export function ReadLayout({ title, intro, updated, draft, summary, sections, lead, noHelp }: Props) {
  return (
    <article className="pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(4rem,9vw,7rem)]">
      <header className="shell">
        <div className="mx-auto max-w-[68ch] lg:grid lg:max-w-none lg:grid-cols-[14rem_minmax(0,68ch)] lg:justify-center lg:gap-x-16 lg:[&>*]:col-start-2">
          <h1 className="font-display text-[clamp(2.75rem,8vw,5rem)] text-balance">{title}</h1>
          {intro ? <div className="mt-5 max-w-[60ch] text-[1.1875rem] leading-relaxed text-brown">{intro}</div> : null}
          {updated ? (
            <p className="font-stencil tabular mt-5 text-[12px] text-brown-soft">
              Last updated <time dateTime={LEGAL_UPDATED}>{LEGAL_UPDATED_LABEL}</time>
            </p>
          ) : null}
          {draft ? (
            <div className="mt-5">
              <DraftNote />
            </div>
          ) : null}
        </div>
      </header>

      <div className="shell mt-10 lg:mt-14">
        <div className="mx-auto grid max-w-[68ch] gap-8 lg:max-w-none lg:grid-cols-[14rem_minmax(0,68ch)] lg:justify-center lg:gap-16">
          <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto">
            <Toc items={sections.map((s) => ({ id: s.id, title: s.title }))} />
          </aside>

          <div className="min-w-0">
            {summary ? (
              <Ticket head={[summary.head]} className="mb-14">
                <ul className="list-disc space-y-2 px-4 pt-1 pb-3 pl-8 text-[1.0625rem] leading-relaxed text-cocoa marker:text-brown-soft">
                  {summary.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </Ticket>
            ) : null}
            {lead}
            <div className="space-y-14">
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={s.id}>
                  <h2 id={s.id} className="font-display scroll-mt-28 text-[clamp(1.875rem,4.2vw,2.5rem)] text-balance">
                    {s.title}
                  </h2>
                  {s.bare ? <div className="mt-4">{s.body}</div> : <Prose className="mt-4">{s.body}</Prose>}
                </section>
              ))}
            </div>

            {noHelp ? null : (
              <div className="mt-16 flex flex-col items-start gap-4 border-t border-line pt-8">
                <h2 className="text-lg font-bold">Still not sure?</h2>
                <p className="max-w-[52ch] text-brown">
                  Ask us before you order. WhatsApp is the quickest way to reach the maker. You can also write to{" "}
                  <a className="font-medium text-cocoa underline" href={`mailto:${SITE.email}`}>
                    {SITE.email}
                  </a>
                  .
                </p>
                <Button asChild variant="tape" size="lg">
                  <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden strokeWidth={1.8} />
                    Ask on WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
