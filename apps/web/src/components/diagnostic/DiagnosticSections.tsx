import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { PROOF_PILLS, clientEvidencePill, type CriterionProofRow } from "@/lib/services/criteria-proof-service";
import type { CriterionEvidence } from "@/lib/actions/criteria-proof";
import type { SupportMode } from "@eoda/database";
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

// Détail des preuves d'un critère, côté structure (21/10/2026 — « mettre les preuves
// qui répondent au critère, même s'il y en a 1 sur 2, avec un petit texte explicatif
// qui référence le manuel »). Fourni seulement à l'écran : l'impression garde la liste.
export type DiagnosticEvidenceView = {
  evidence: Record<string, CriterionEvidence>;
  mode: SupportMode;
  // Où retrouver un document dans « Mes documents » (la recherche par nom).
  documentHref: (label: string) => string;
};

function ChapterRows({ chapter, details }: { chapter: DiagnosticChapter; details?: DiagnosticEvidenceView | undefined }) {
  if (chapter.rows.length === 0) return <p className="px-4 py-3 text-ink2">Aucun critère à montrer dans ce chapitre.</p>;
  return (
    <ul className="divide-y divide-line">
      {chapter.rows.map((row) => (
        <li key={row.id} className="px-4 py-3">
          {details ? (
            <CriterionWithEvidence row={row} details={details} />
          ) : (
            <span className="flex flex-wrap items-center justify-between gap-3">
              <CriterionTitle row={row} />
              <StatusPill pill={PROOF_PILLS[row.status]} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CriterionTitle({ row }: { row: CriterionProofRow }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="font-bold tabular-nums">{row.code}</span> {row.label}
      {row.isImperative && <span className="ml-2 font-bold text-accent-text">▲ Impératif</span>}
    </span>
  );
}

function CriterionWithEvidence({ row, details }: { row: CriterionProofRow; details: DiagnosticEvidenceView }) {
  const evidence = details.evidence[row.id];
  const items = evidence?.items ?? [];
  const counted = items.filter((item) => item.state === "PROUVEE").length;
  return (
    <details className="group/criterion">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <ChevronRight
            aria-hidden="true"
            className="mt-1 h-4 w-4 flex-shrink-0 transition-transform group-open/criterion:rotate-90 motion-reduce:transition-none"
          />
          <CriterionTitle row={row} />
        </span>
        <span className="flex items-center gap-3">
          {items.length > 0 && (
            <span className="tabular-nums text-ink2">
              {counted} preuve{counted > 1 ? "s" : ""} sur {items.length}
            </span>
          )}
          <StatusPill pill={PROOF_PILLS[row.status]} />
        </span>
      </summary>
      <div className="mt-3 space-y-4 pl-6">
        <p className="text-ink2">
          Une preuve, c&apos;est un document qui montre que vous respectez ce critère. Pour le critère{" "}
          <span className="font-bold text-ink">{row.code}</span> du manuel d&apos;évaluation de la HAS (version de juillet
          2025), EODA a retenu {items.length === 0 ? "aucun document pour l'instant" : `${items.length} document${items.length > 1 ? "s" : ""}`}.
          {" "}
          {details.mode === "ACCOMPAGNE"
            ? "Une preuve compte quand EODA l'a relue."
            : "Une preuve compte quand vous l'avez vérifiée et acceptée."}
        </p>
        {items.length > 0 && (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.documentTypeId} className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={details.documentHref(item.label)}
                  className="inline-flex min-h-11 items-center font-bold text-ink underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
                <StatusPill pill={clientEvidencePill(item.state, details.mode)} />
              </li>
            ))}
          </ul>
        )}
        {evidence && evidence.hasElements.length > 0 && (
          <div>
            <p className="font-bold">Ce que l&apos;évaluateur de la HAS regarde</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink2">
              {evidence.hasElements.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

// Repliables à l'écran (<details> natif : clavier et lecteur d'écran sans script),
// tous ouverts à l'impression.
export function DiagnosticChapters({
  chapters,
  printable = false,
  details,
}: {
  chapters: DiagnosticChapter[];
  printable?: boolean;
  details?: DiagnosticEvidenceView | undefined;
}) {
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
              <ChapterRows chapter={chapter} details={details} />
            </div>
          </details>
        )
      )}
    </div>
  );
}
