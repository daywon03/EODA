import Link from "next/link";
import { Wand2 } from "lucide-react";
import type { ChecklistItem } from "@/lib/actions/checklist";
import { documentRowPill } from "@/lib/services/structure-documents-service";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/services/date-format-service";
import { isImageFile } from "@/lib/services/file-type-service";
import { summariseAnalysis } from "@/lib/services/analysis-view-service";
import { canRemoveDocumentType } from "@/lib/services/document-type-removal-service";
import { analysisMissingNotice, withSheetTab, type SheetTab } from "@/lib/services/document-sheet-tabs-service";
import { DocumentScopeToggle } from "@/components/checklist/DocumentScopeToggle";
import { DocumentVersionHistory } from "@/components/checklist/DocumentVersionHistory";
import { DocumentStepTrail } from "@/components/checklist/DocumentStepTrail";
import { DocumentAnalysisPanel } from "@/components/checklist/DocumentAnalysisPanel";
import { MissingDocumentJustification } from "@/components/checklist/MissingDocumentJustification";
import { DocumentUploadButton } from "@/components/checklist/DocumentUploadButton";
import { DocumentSheetTabs } from "@/components/structure/DocumentSheetTabs";
import {
  AnalysisLabPanel,
  CriterionLinker,
  DocumentFolderPicker,
  DocumentSettingsPanel,
  ParticipationFormPicker,
  RemoveDocumentTypeButton,
  RenameDocumentType,
} from "@/components/structure/lazy-document-panels";
import { PARTICIPATION_LINE_CODE } from "@/lib/services/participation-form-service";
import { buttonVariants } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Contenu du panneau latéral d'un document (onglet Documents de la fiche). Il
// RECOMPOSE l'existant — historique et aperçu, parcours et validation
// (setDocumentValidated), analyse et critères, dépôt cabinet — sans en réécrire la
// logique : chaque geste garde son action serveur, sa garde et sa journalisation.
//
// Retours de Sandrine (09/11/2026, « je me perds dans le panneau de droite ») :
// rien n'est supprimé, tout est rangé en trois onglets (DocumentSheetTabs) —
// « Le document », « Critères HAS », « Analyse ». L'en-tête (catégorie, état, et la
// phrase « l'analyse a relevé des éléments manquants ») reste au-dessus des onglets.
// ─────────────────────────────────────────────────────────────────────────────
export function DocumentSheetBody({
  item,
  categoryLabel,
  establishmentId,
  canEditScope,
  folders = [],
  tab = "document",
  panelHref,
  closeHref,
}: {
  item: ChecklistItem;
  categoryLabel: string;
  establishmentId: string;
  // Réglages de cabinet (CABINET_SETTINGS = administration) : nom, dossier, critères,
  // retrait de la ligne.
  canEditScope: boolean;
  // Dossiers de la liste, pour ranger la ligne (call du 29/10/2026).
  folders?: readonly { id: string; label: string }[];
  // Onglet demandé par l'adresse (`?onglet=`).
  tab?: SheetTab;
  // Adresse de ce panneau (filtres + document ouvert), base des liens d'onglet.
  panelHref: string;
  // Adresse de la liste sans panneau : où revenir quand la ligne est retirée.
  closeHref: string;
}) {
  const version = item.currentVersion;
  const missingCount = version?.analysis ? summariseAnalysis(version.analysis).missingCount : 0;
  const hrefs: Record<SheetTab, string> = {
    document: withSheetTab(panelHref, "document"),
    criteres: withSheetTab(panelHref, "criteres"),
    analyse: withSheetTab(panelHref, "analyse"),
  };
  const removable = canEditScope && canRemoveDocumentType({ code: item.code, category: item.category, archivedAt: null });

  const header = (
    <>
      <p className="text-sm text-ink2">{categoryLabel}</p>
      <StatusPill pill={documentRowPill(item)} />
      {item.isConditional && item.status !== "NOT_APPLICABLE" && <p className="text-sm text-ink2">Si concerné</p>}
      {item.expectedFrequency === "ANNUAL" && !item.expiryNotice && (
        <p className="text-sm text-ink2">Fréquence annuelle attendue</p>
      )}
      {/* Périmé : dire DEPUIS QUAND, pas seulement que ça l'est. */}
      {item.expiryNotice && <p className="text-sm font-bold text-ink">{item.expiryNotice}</p>}
      {/* Le geste de la STRUCTURE (D6), distinct de la validation d'EODA. */}
      {item.clientAccepted && item.clientAcceptedAt && (
        <p className="text-sm font-bold text-ink">
          <span aria-hidden="true">✓ </span>Accepté par la structure le {formatDate(item.clientAcceptedAt)}
        </p>
      )}
    </>
  );

  const documentPanel = (
    <>
      {/* Renommer vaut pour toutes les structures (renameDocumentType) : la loi
          2002-2 garde ses noms, et la ligne de participation porte un libellé
          composé (forme choisie) qui ne se renomme pas. */}
      {canEditScope && item.category !== "LOI_2002_2" && item.code !== PARTICIPATION_LINE_CODE && (
        <RenameDocumentType documentTypeId={item.documentTypeId} label={item.label} />
      )}
      {canEditScope && folders.length > 0 && (
        <DocumentFolderPicker documentTypeId={item.documentTypeId} folderId={item.folder?.id ?? null} folders={folders} />
      )}
      {/* Qui doit fournir ce document : la structure, ou EODA. */}
      <p>
        <DocumentScopeToggle
          documentTypeId={item.documentTypeId}
          requestedFromClient={item.requestedFromClient}
          canEdit={canEditScope}
        />
      </p>
      {/* Toutes les versions : la comparaison entre la version du client et celle
          qu'EODA a produite montre le travail fait. */}
      <DocumentVersionHistory versions={item.versions} canManageVersions />
      <DocumentStepTrail
        establishmentId={establishmentId}
        documentTypeId={item.documentTypeId}
        step={item.step}
        isImage={version ? isImageFile(version.originalFilename) : false}
      />
      <div className="border-t border-line pt-4">
        <DocumentUploadButton
          establishmentId={establishmentId}
          documentTypeId={item.documentTypeId}
          documentLabel={item.label}
          documentValidated={item.validatedAt !== null}
          showModelSelector
          offerCabinetFinal
        />
      </div>
      {/* Ligne « Autre forme de participation des usagers » : la forme choisie
          (enquête, groupe de parole, autre) — 21/10/2026. */}
      {item.code === PARTICIPATION_LINE_CODE && (
        <ParticipationFormPicker
          establishmentId={establishmentId}
          form={item.participationForm}
          otherLabel={item.participationOtherLabel}
        />
      )}
      {removable && (
        <div className="border-t border-line pt-4">
          <RemoveDocumentTypeButton documentTypeId={item.documentTypeId} label={item.label} closeHref={closeHref} />
        </div>
      )}
    </>
  );

  const criteriaPanel = (
    <>
      <p className="text-sm text-ink2">
        Les critères HAS que ce document doit prouver. La liste vaut pour toutes les structures
        {canEditScope ? "." : " ; seule l'administration la modifie."}
      </p>
      <CriterionLinker typeCode={item.code} canEdit={canEditScope} />
    </>
  );

  const analysisPanel = (
    <>
      {version && (
        // Bien visible (retours du 09/11/2026) : la mise en conformité côte à côte, qui
        // reste soumise au droit de la mission côté serveur.
        <Link href={`/dashboard/cabinet/conformite/${version.id}`} className={buttonVariants({ className: "w-full sm:w-auto" })}>
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          Mettre en conformité
        </Link>
      )}
      {version?.analysis ? (
        <DocumentAnalysisPanel
          analysis={version.analysis}
          documentVersionId={version.id}
          reviewedAt={version.analysisReviewedAt}
          clientMention={version.clientMention}
          canReview
          establishmentId={establishmentId}
          criterionSuggestions={version.criterionSuggestions}
          defaultOpen
          requestContext={{ establishmentId, documentTypeId: item.documentTypeId, documentLabel: item.label }}
        />
      ) : (
        <p className="text-ink2">
          {version
            ? "Pas encore d'analyse pour la version actuelle. Lancez-la depuis l'onglet « Le document », dans l'historique des versions."
            : "Aucun fichier déposé : l'analyse se fera au premier dépôt."}
        </p>
      )}
      <MissingDocumentJustification
        establishmentId={establishmentId}
        documentTypeId={item.documentTypeId}
        status={item.status}
        category={item.category}
        code={item.code}
        declaredMissing={item.declaredMissing}
        missingJustification={item.missingJustification}
        commentUsedByAi={item.commentUsedByAi}
        hasVersion={version !== null}
      />
      {/* Sous quel TYPE ce fichier est rangé, et la consigne libre donnée au modèle. */}
      <DocumentSettingsPanel
        establishmentId={establishmentId}
        documentTypeId={item.documentTypeId}
        currentLabel={item.label}
        currentCategory={item.category}
        directive={item.analysisDirective}
        includeInAnalysis={item.directiveInAnalysis}
      />
      {/* Laboratoire d'analyse (29/10/2026) : le prompt envoyé, des essais d'autres
          versions, le verdict de la consultante — jamais montré à la structure. */}
      {version && <AnalysisLabPanel documentVersionId={version.id} />}
    </>
  );

  return (
    <DocumentSheetTabs
      initialTab={tab}
      hrefs={hrefs}
      header={header}
      missingNotice={analysisMissingNotice(missingCount)}
      analysisCount={missingCount}
      panels={{ document: documentPanel, criteres: criteriaPanel, analyse: analysisPanel }}
    />
  );
}
