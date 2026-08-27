"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { DocumentUploadButton } from "./DocumentUploadButton";
import { MissingDocumentJustification } from "./MissingDocumentJustification";
import { DocumentAnalysisPanel } from "./DocumentAnalysisPanel";
import { DocumentVersionHistory } from "./DocumentVersionHistory";
import { DocumentStepTrail } from "./DocumentStepTrail";
import type { ChecklistItem } from "@/lib/actions/checklist";
import type { DocumentStatus } from "@eoda/database";

type Props = {
  title: string;
  items: ChecklistItem[];
  defaultOpen?: boolean;
  establishmentId?: string;
  // Réservé à l'espace Cabinet : la suppression d'une version déposée n'est pas
  // offerte au portail client. L'action serveur refait le contrôle de toute façon —
  // ce drapeau ne fait que ne pas proposer un bouton qui serait refusé.
  canManageVersions?: boolean;
  // Fin de mission : en bibliothèque (lecture seule), les documents restent
  // consultables mais plus rien ne se dépose. Le bouton disparaît parce que l'action
  // serveur le refuserait — pas l'inverse.
  canDeposit?: boolean;
};

const STATUS_ORDER: DocumentStatus[] = [
  "MISSING", "INCOMPLETE", "EXPIRED", "UPLOADED", "ANALYZING", "COMPLIANT", "NOT_APPLICABLE",
];

function statusScore(s: DocumentStatus): number {
  return STATUS_ORDER.indexOf(s);
}

export function ChecklistCategory({
  title,
  items,
  defaultOpen = false,
  establishmentId,
  canManageVersions = false,
  canDeposit = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const missing = items.filter((i) => i.status === "MISSING").length;
  const compliant = items.filter((i) => i.status === "COMPLIANT").length;
  const sorted = [...items].sort((a, b) => statusScore(a.status) - statusScore(b.status));
  const panelId = `checklist-panel-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="border border-gris-light rounded-xl overflow-hidden bg-white">
      {/* En-tête accordéon */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-ivoire transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown
            className={`w-4 h-4 text-gris-mid flex-shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            aria-hidden="true"
          />
          <span className="font-semibold text-brun-ancre truncate">{title}</span>
          <span className="text-xs text-gris-mid flex-shrink-0">
            ({items.length} document{items.length > 1 ? "s" : ""})
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          {missing > 0 && (
            <span className="text-rouge-imp font-medium">{missing} manquant{missing > 1 ? "s" : ""}</span>
          )}
          {compliant > 0 && (
            <span className="text-vert-ok font-medium">{compliant} conforme{compliant > 1 ? "s" : ""}</span>
          )}
        </div>
      </button>

      {/* Contenu */}
      {open && (
        <ul id={panelId} className="divide-y divide-gris-light border-t border-gris-light animate-fade-in">
          {sorted.map((item) => (
            <li
              key={item.code}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-3.5 hover:bg-ivoire/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-brun-ancre leading-snug">{item.label}</p>
                {item.isConditional && item.status !== "NOT_APPLICABLE" && (
                  <p className="text-xs text-gris-mid mt-0.5">Si concerné</p>
                )}
                {item.expectedFrequency === "ANNUAL" && (
                  <p className="text-xs text-ambre mt-0.5">Fréquence annuelle attendue</p>
                )}
                {/* Toutes les versions, pas seulement la dernière : c'est la
                    comparaison entre la version du client et celle qu'EODA a produite
                    qui montre le travail fait. */}
                <DocumentVersionHistory
                  versions={item.versions}
                  canManageVersions={canManageVersions}
                />

                {/* Le parcours du document — côté cabinet uniquement. */}
                {canManageVersions && establishmentId && (
                  <DocumentStepTrail
                    establishmentId={establishmentId}
                    documentTypeId={item.documentTypeId}
                    step={item.step}
                  />
                )}
                {/* Ce que l'analyse a trouvé — côté client comme côté cabinet : le
                    client dépose et corrige, c'est lui qui a besoin de savoir ce qui
                    manque. Absente tant qu'aucune analyse n'a abouti. */}
                {item.currentVersion?.analysis && (
                  <DocumentAnalysisPanel
                    analysis={item.currentVersion.analysis}
                    documentVersionId={item.currentVersion.id}
                    reviewedAt={item.currentVersion.analysisReviewedAt}
                    canReview={canManageVersions}
                  />
                )}
                {/* Côté client, une analyse non relue n'est PAS montrée — mais le
                    silence ressemblerait à une panne. On dit qu'elle arrive, sans
                    rien en révéler. */}
                {!canManageVersions && item.currentVersion?.analysisAwaitingReview && (
                  <p className="mt-2 text-xs text-gris-mid">
                    Analyse en cours de relecture par votre consultant EODA.
                  </p>
                )}
                {establishmentId && canDeposit && (
                  <MissingDocumentJustification
                    establishmentId={establishmentId}
                    documentTypeId={item.documentTypeId}
                    status={item.status}
                    missingJustification={item.missingJustification}
                    hasVersion={item.currentVersion !== null}
                  />
                )}
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
                <StatusBadge status={item.status} />
                {establishmentId && canDeposit && (
                  <DocumentUploadButton
                    establishmentId={establishmentId}
                    documentTypeId={item.documentTypeId}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
