import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { PROOF_PILLS } from "@/lib/services/criteria-proof-service";
import {
  describePriorityProves,
  type DiagnosticChapter,
  type DiagnosticSummary,
  type PriorityAction,
} from "@/lib/services/diagnostic-service";

// Blocs de « Mon diagnostic » (N6), partagés par la page client et le rapport
// imprimable : une seule mise en mots du même état dérivé.

export function DiagnosticCounters({ summary, expectedImperatives }: { summary: DiagnosticSummary; expectedImperatives: number }) {
  return (
    <section aria-labelledby="diag-counters" className="space-y-4">
      <div>
        <h2 id="diag-counters" className="text-2xl font-bold">
          Vos {summary.imperatives.total} critères impératifs
        </h2>
        <p className="text-ink2">
          Chaque critère est compté une fois, selon les preuves déposées. Repère : {expectedImperatives} pour votre
          type de service.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {summary.counters.map((c) => (
          <li key={c.state} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <StatusPill pill={PROOF_PILLS[c.state]} />
              <span className="text-3xl font-bold tabular-nums">{c.count}</span>
            </div>
            <span className="text-base text-ink2">{c.definition}</span>
          </li>
        ))}
      </ul>
      {summary.imperativesWithoutExpectedDocument > 0 && (
        <p className="text-base text-ink2">
          {summary.imperativesWithoutExpectedDocument} critère
          {summary.imperativesWithoutExpectedDocument > 1 ? "s n'ont" : " n'a"} pas encore de document attendu défini
          par EODA.
        </p>
      )}
    </section>
  );
}

export function PriorityActions({ priorities, depositHref }: { priorities: PriorityAction[]; depositHref: string | null }) {
  return (
    <section aria-labelledby="diag-priorities" className="space-y-4">
      <div>
        <h2 id="diag-priorities" className="text-2xl font-bold">
          {priorities.length > 1
            ? `Les ${priorities.length} actions prioritaires`
            : priorities.length === 1
              ? "L'action prioritaire"
              : "Actions prioritaires"}
        </h2>
        <p className="text-ink2">Des critères impératifs sans aucune preuve. Un même document peut prouver plusieurs critères.</p>
      </div>
      {priorities.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-4">Aucun critère impératif n&apos;est sans preuve.</p>
      ) : (
        <ol className="space-y-3">
          {priorities.map((p, index) => (
            <li key={p.documentTypeId} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card p-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink-fill font-bold text-on-ink"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Déposer : {p.documentLabel}</p>
                <p className="text-base text-ink2">{describePriorityProves(p)}</p>
              </div>
              {depositHref && (
                <Link
                  href={depositHref}
                  className="inline-flex min-h-12 items-center rounded-[10px] border-2 border-ink px-4 font-bold text-ink hover:bg-soft"
                >
                  Déposer le document
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ChapterRows({ chapter }: { chapter: DiagnosticChapter }) {
  if (chapter.rows.length === 0) return <p className="px-4 py-3 text-ink2">Aucun critère à montrer dans ce chapitre.</p>;
  return (
    <ul className="divide-y divide-line">
      {chapter.rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="font-bold tabular-nums">{row.code}</span> {row.label}
            {row.isImperative && <span className="ml-2 font-bold text-accent-text">▲ Impératif</span>}
          </span>
          <StatusPill pill={PROOF_PILLS[row.status]} />
        </li>
      ))}
    </ul>
  );
}

// Repliables à l'écran (<details> natif : clavier et lecteur d'écran sans script),
// tous ouverts à l'impression.
export function DiagnosticChapters({ chapters, printable = false }: { chapters: DiagnosticChapter[]; printable?: boolean }) {
  return (
    <div className="space-y-3">
      {chapters.map((chapter) =>
        printable ? (
          <section key={chapter.number} className="rounded-xl border border-line bg-card">
            <h2 className="border-b border-line px-4 py-3 text-xl font-bold">
              {chapter.title} <span className="text-base font-normal text-ink2">· {chapter.summary}</span>
            </h2>
            <ChapterRows chapter={chapter} />
          </section>
        ) : (
          <details key={chapter.number} className="group rounded-xl border border-line bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3">
              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5 flex-shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
              />
              <h2 className="text-xl font-bold">{chapter.title}</h2>
              <span className="ml-auto text-base text-ink2">{chapter.summary}</span>
            </summary>
            <div className="border-t border-line">
              <ChapterRows chapter={chapter} />
            </div>
          </details>
        )
      )}
    </div>
  );
}
