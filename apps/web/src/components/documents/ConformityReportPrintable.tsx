import type { DocumentCategory } from "@eoda/database";
import { DocumentBrandHeader } from "./DocumentBrandHeader";
import { formatDate } from "@/lib/services/date-format-service";
import { buildOwnershipMention } from "@/lib/services/document-ownership-service";
import {
  buildReportLines,
  summariseReport,
  type ReportLine,
  type ReportSourceItem,
} from "@/lib/services/conformity-report-service";

const CATEGORY_LABELS: Record<string, string> = {
  LOI_2002_2: "Documents loi 2002-2 — droits des personnes accompagnées",
  FONCTIONNEMENT: "Fonctionnement de la structure",
  QUALITE_RISQUES: "Démarche qualité et gestion des risques",
  RH: "Ressources humaines",
} satisfies Partial<Record<DocumentCategory, string>> & Record<string, string>;

type Props = {
  establishmentName: string;
  establishmentLogo: string | null;
  issuedOn: Date;
  items: ReportSourceItem[];
};

// Rapport de mise en conformité documentaire — le document autonome qu'EODA remet et
// que la structure archive.
//
// Il répond à trois questions, dans cet ordre : où en est-on globalement, qu'est-ce
// qui manque document par document, et au regard de quel critère HAS. Cet ordre n'est
// pas décoratif : Sandrine ouvre la réunion sur le premier chiffre, et déroule.
export function ConformityReportPrintable({
  establishmentName,
  establishmentLogo,
  issuedOn,
  items,
}: Props) {
  const lines = buildReportLines(items);
  const summary = summariseReport(lines);

  const byCategory = new Map<string, ReportLine[]>();
  for (const line of lines) {
    const bucket = byCategory.get(line.category) ?? [];
    bucket.push(line);
    byCategory.set(line.category, bucket);
  }

  return (
    <div className="space-y-6 text-brun-ancre">
      <div className="space-y-4 border-b border-gris-light pb-4">
        <DocumentBrandHeader
          establishmentName={establishmentName}
          establishmentLogo={establishmentLogo}
        />
        <div>
          <h2 className="text-lg font-bold">Rapport de mise en conformité documentaire</h2>
          <p className="text-sm text-gris-mid">
            {establishmentName} · établi le {formatDate(issuedOn)}
          </p>
        </div>
      </div>

      {/* Le chiffre d'ouverture. Quatre compteurs, pas douze : c'est ce qui se retient
          et se dit à voix haute. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter label="Documents attendus" value={summary.total} />
        <Counter label="Non fournis" value={summary.missingDocuments} />
        <Counter label="Analysés" value={summary.analysed} />
        <Counter label="Écarts relevés" value={summary.gaps} />
      </div>

      {[...byCategory.entries()].map(([category, categoryLines]) => (
        <section key={category} className="space-y-3">
          <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
            {CATEGORY_LABELS[category] ?? category}
          </h3>

          <ul className="space-y-4">
            {categoryLines.map((line) => (
              <li key={line.code} className="break-inside-avoid">
                <p className="text-sm font-semibold">{line.label}</p>

                {line.criteria.length > 0 && (
                  <p className="text-xs text-gris-mid">
                    Critères HAS rattachés :{" "}
                    {line.criteria.map((criterion) => criterion.code).join(", ")}
                  </p>
                )}

                {line.state === "MANQUANT" && (
                  <p className="mt-1 text-sm text-rouge-imp">
                    Document non fourni à ce jour.
                  </p>
                )}

                {line.state === "EN_RELECTURE" && (
                  // Le contenu de l'analyse n'est PAS publié tant qu'il n'est pas
                  // relu : c'est la même barrière que dans le portail, appliquée au
                  // document imprimé.
                  <p className="mt-1 text-sm text-gris-mid">
                    Analyse en cours de relecture par le consultant — les conclusions
                    figureront dans la prochaine édition de ce rapport.
                  </p>
                )}

                {line.state === "ANALYSE" && (
                  <div className="mt-1 space-y-2 text-sm">
                    {line.missing.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gris-mid">
                          Éléments attendus non retrouvés
                        </p>
                        <ul className="ml-5 list-disc">
                          {line.missing.map((entry) => (
                            <li key={entry}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-gris-mid">
                        Aucun élément manquant relevé — conformité à confirmer en séance.
                      </p>
                    )}

                    {line.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gris-mid">
                          Corrections proposées
                        </p>
                        <ul className="ml-5 list-disc">
                          {line.suggestions.map((entry) => (
                            <li key={entry}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Paternité : ce document est PRODUIT par EODA pour la structure — c'est le cas
          où la mention de propriété et de droit d'exploitation s'applique. */}
      <p className="border-t border-gris-light pt-4 text-xs text-gris-mid">
        {buildOwnershipMention(establishmentName)} Analyse documentaire produite à
        l&apos;appui de la préparation à l&apos;évaluation qualité HAS et revue par le
        consultant ; elle ne constitue pas une évaluation HAS officielle.
      </p>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gris-light px-3 py-2">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-gris-mid">{label}</p>
    </div>
  );
}
