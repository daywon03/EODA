import Link from "next/link";
import { Sparkles, Wand2 } from "lucide-react";
import type { ChecklistItem } from "@/lib/actions/checklist";
import { documentRowPill } from "@/lib/services/structure-documents-service";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/services/date-format-service";
import { signedCopyPath } from "@/lib/services/document-signature-service";
import { isImageFile } from "@/lib/services/file-type-service";
import { summariseAnalysis } from "@/lib/services/analysis-view-service";
import { canRemoveDocumentType } from "@/lib/services/document-type-removal-service";
import { analysisMissingNotice, withSheetTab, type SheetTab } from "@/lib/services/document-sheet-tabs-service";
import { DocumentScopeToggle } from "@/components/checklist/DocumentScopeToggle";
import { DocumentVersionHistory } from "@/components/checklist/DocumentVersionHistory";
import { RestrictedFileNotice } from "@/components/checklist/RestrictedFileNotice";
import { DocumentStepTrail } from "@/components/checklist/DocumentStepTrail";
import { DocumentUploadButton } from "@/components/checklist/DocumentUploadButton";
import { DocumentSheetTabs } from "@/components/structure/DocumentSheetTabs";
import {
  AnalysisLabPanel,
  CriterionLinker,
  DocumentAnalysisPanel,
  DocumentFolderPicker,
  DocumentSettingsPanel,
  MissingDocumentJustification,
  ParticipationFormPicker,
  RemoveDocumentTypeButton,
  RenameDocumentType,
} from "@/components/structure/lazy-document-panels";
import { PARTICIPATION_LINE_CODE } from "@/lib/services/participation-form-service";
import { buttonVariants } from "@/components/ui/button";
import { cabinetConformityHref, documentAssistantEntry } from "@/lib/services/document-assistant-entry-service";

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
  canWriteGuidelines = false,
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
  // Écrire une consigne pour l'IA sur un critère (STRUCTURES_WRITE : administration et
  // consultante) — vérifié aussi par addCriterionGuidelines.
  canWriteGuidelines?: boolean;
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

  const assistant = documentAssistantEntry({
    canWrite: canWriteGuidelines,
    restrictedAccess: item.restrictedAccess,
    versionId: version?.id ?? null,
  });

  const header = (
    <>
      {/* Assistant (11/11/2026) : dans l'en-tête, visible depuis les trois onglets. Il
          ouvre la mise en conformité avec l'assistant à droite ; quand il ne peut pas
          servir, il reste à sa place et dit pourquoi. */}
      {assistant.kind === "OPEN" && (
        <Link href={assistant.href} className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ouvrir avec l&apos;assistant
        </Link>
      )}
      {assistant.kind === "UNAVAILABLE" && (
        <p className="flex items-start gap-2 text-sm text-ink2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {assistant.reason}
        </p>
      )}
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
      {/* Signé et tamponné par la direction (12/11/2026) : EODA voit la copie signée. */}
      {item.currentVersion?.signedAt && (
        <p className="text-sm font-bold text-ink">
          <span aria-hidden="true">✓ </span>Signé par la structure le {formatDate(item.currentVersion.signedAt)} ·{" "}
          <a href={signedCopyPath(item.currentVersion.id)} className="text-accent-text underline underline-offset-4">
            télécharger la version signée
          </a>
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
      {/* Ligne à accès restreint (le tampon, ADR 20261110) : le cabinet voit la ligne,
          son état et ses dates, jamais le fichier. */}
      {item.restrictedAccess && <RestrictedFileNotice />}
      <DocumentVersionHistory versions={item.versions} canManageVersions fileLocked={!item.canOpenFile} />
      {/* Le parcours (analysé, relu, validé) n'existe pas pour une ligne restreinte :
          EODA ne l'ouvre pas, donc ne la valide pas (setDocumentValidated refuse). */}
      {!item.restrictedAccess && (
        <DocumentStepTrail
          establishmentId={establishmentId}
          documentTypeId={item.documentTypeId}
          step={item.step}
          isImage={version ? isImageFile(version.originalFilename) : false}
        />
      )}
      <div className="border-t border-line pt-4">
        <DocumentUploadButton
          establishmentId={establishmentId}
          documentTypeId={item.documentTypeId}
          documentLabel={item.label}
          documentValidated={item.validatedAt !== null}
          showModelSelector
          offerCabinetFinal
          restrictedForCabinet={item.restrictedAccess}
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
      <CriterionLinker
        typeCode={item.code}
        canEdit={canEditScope}
        // Consignes pour l'IA sous chaque critère — jamais sur un document à accès
        // restreint, que l'IA ne lit pas (ADR 20261110).
        {...(item.restrictedAccess
          ? {}
          : { guidelines: { documentVersionId: version?.id ?? null, canWrite: canWriteGuidelines } })}
      />
    </>
  );

  const analysisPanel = (
    <>
      {item.restrictedAccess && (
        <p className="text-ink2">
          Document à accès restreint : il n&apos;est ni analysé ni mis en conformité, et EODA ne l&apos;ouvre pas.
        </p>
      )}
      {version && !item.restrictedAccess && (
        // Bien visible (retours du 09/11/2026) : la mise en conformité côte à côte, qui
        // reste soumise au droit de la mission côté serveur.
        <Link href={cabinetConformityHref(version.id, { assistant: false })} className={buttonVariants({ className: "w-full sm:w-auto" })}>
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
          // Administration seule, comme la matrice : retirer un critère attendu,
          // rattacher un critère détecté (09/11/2026).
          matrixTypeCode={canEditScope ? item.code : undefined}
        />
      ) : item.restrictedAccess ? null : (
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
      {version && !item.restrictedAccess && <AnalysisLabPanel documentVersionId={version.id} />}
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
