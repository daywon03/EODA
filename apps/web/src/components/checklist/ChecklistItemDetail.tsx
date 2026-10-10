"use client";

import { MissingDocumentJustification } from "./MissingDocumentJustification";
import { DocumentAnalysisPanel } from "./DocumentAnalysisPanel";
import { DocumentVersionHistory } from "./DocumentVersionHistory";
import { DocumentStepTrail } from "./DocumentStepTrail";
import { DocumentScopeToggle } from "./DocumentScopeToggle";
import { isImageFile } from "@/lib/services/file-type-service";
import type { ChecklistItem } from "@/lib/actions/checklist";

type Props = {
  item: ChecklistItem;
  establishmentId?: string | undefined;
  canManageVersions: boolean;
  canDeposit: boolean;
  canEditScope: boolean;
};

// Le détail d'UN document de la checklist — périmètre (réclamé / produit par EODA),
// historique des versions, parcours et validation, analyse et critères proposés,
// justification d'absence. Partagé par la liste en accordéon (portail client,
// ChecklistCategory) et par le panneau latéral de l'onglet Documents de la fiche
// structure : un seul rendu, donc une seule façon d'oublier une barrière (D1).
export function ChecklistItemDetail({ item, establishmentId, canManageVersions, canDeposit, canEditScope }: Props) {
  return (
    <>
      {/* Qui doit fournir ce document — l'information manquait, et c'est
          elle qui distingue la checklist du client du plan de production
          du cabinet. Côté client, ce marqueur n'a pas lieu d'être : tout
          ce qu'il voit lui est réclamé, ou lui appartient déjà. */}
      {canManageVersions && (
        <p className="mt-0.5">
          <DocumentScopeToggle
            documentTypeId={item.documentTypeId}
            requestedFromClient={item.requestedFromClient}
            canEdit={canEditScope}
          />
        </p>
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
          isImage={
            item.currentVersion ? isImageFile(item.currentVersion.originalFilename) : false
          }
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
          {...(establishmentId && { establishmentId })}
          criterionSuggestions={item.currentVersion.criterionSuggestions}
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
    </>
  );
}
