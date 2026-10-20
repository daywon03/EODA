"use client";

import { useState } from "react";
import { ChevronDown, FileText, Sparkles } from "lucide-react";
import type { DocumentVersionItem } from "@/lib/actions/checklist";
import { formatDate } from "@/lib/services/date-format-service";
import { DocumentPreviewLink } from "./DocumentPreviewLink";
import { DocumentDownloadLink } from "./DocumentDownloadLink";
import { DeleteDocumentVersionButton } from "./DeleteDocumentVersionButton";
import { AnalyzeDocumentButton } from "./AnalyzeDocumentButton";
import { CorrectedDraftPanel } from "./CorrectedDraftPanel";
import { canRenderDocumentPages, isImageFile } from "@/lib/services/file-type-service";
import { INLINE_ACTION_MUTED_CLASS } from "@/components/ui/inline-action";

type Props = {
  versions: DocumentVersionItem[];
  // Côté cabinet ou côté client — la règle de suppression n'est pas « qui a le
  // droit », c'est « qui a déposé » : chacun peut retirer son dernier dépôt, personne
  // ne peut effacer celui de l'autre (document-workflow-service.canDeleteVersion).
  // L'action serveur applique la même règle ; ce drapeau ne fait que ne pas proposer
  // un bouton qui serait refusé.
  canManageVersions?: boolean;
};

// Toutes les versions d'un document, de la plus récente à la plus ancienne.
//
// Elles étaient déjà toutes conservées en base ; seule la dernière s'affichait. Or
// c'est la comparaison qui fait le travail : la version du client, ce que le cabinet
// en a fait, et les reprises successives. « J'ai trois pièces pour un seul document. »
//
// La plus récente reste toujours visible ; le reste se déplie. Une liste de sept
// versions ouverte en permanence noierait la checklist.
export function DocumentVersionHistory({ versions, canManageVersions = false }: Props) {
  const [open, setOpen] = useState(false);

  if (versions.length === 0) return null;

  const [latest, ...older] = versions;
  if (!latest) return null;

  return (
    <div className="mt-1 space-y-1">
      <VersionRow version={latest} canManageVersions={canManageVersions} isLatest />

      {older.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className={INLINE_ACTION_MUTED_CLASS}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
              aria-hidden="true"
            />
            {open
              ? "Masquer les versions précédentes"
              : `${older.length} version${older.length > 1 ? "s" : ""} précédente${older.length > 1 ? "s" : ""}`}
          </button>

          {open && (
            <ul className="space-y-1 border-l border-gris-light pl-3">
              {older.map((version) => (
                <li key={version.id}>
                  <VersionRow version={version} canManageVersions={canManageVersions} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function VersionRow({
  version,
  canManageVersions,
  isLatest = false,
}: {
  version: DocumentVersionItem;
  canManageVersions: boolean;
  isLatest?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink2">
        <FileText className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        <span className="font-medium text-brun-ancre tabular-nums">v{version.versionNumber}</span>
        <span className="truncate">{version.originalFilename}</span>
      </p>

      <p className="text-xs text-ink2">
        {formatDate(version.uploadedAt)} ·{" "}
        {/* D'où vient la version : c'est ce qui distingue l'original du client du
            travail de mise en conformité. */}
        {version.producedByCabinet ? "EODA" : version.uploadedByName}
      </p>

      {/* Réservé au cabinet, comme AnalyzeDocumentButton juste en dessous : côté
          client, un dépôt doit rester un dépôt — révéler qu'une analyse IA a
          tourné dessus n'a rien à faire dans cet écran (Damon, 22/09/2026). */}
      {canManageVersions && version.hasAnalysis && (
        <span
          className="inline-flex items-center gap-1 text-xs text-amber-text"
          title="Cette version a été analysée"
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          analysée
        </span>
      )}

      {/* `flex-wrap` : cinq gestes au bout d'une ligne de 480 px débordaient à droite
          — il fallait faire glisser le panneau pour voir « Réanalyser » (20/10/2026).
          Ils passent à la ligne suivante, dans le panneau, jamais hors de lui. */}
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <DocumentPreviewLink documentVersionId={version.id} canViewExtractedText={canManageVersions} />
        <DocumentDownloadLink
          documentVersionId={version.id}
          // Même prédicat que celui qui décide de l'aperçu paginé : ce dont on sait
          // produire les pages s'exporte en PDF. Absent pour un `.doc`/`.xls`, qu'aucun
          // convertisseur du dépôt ne prend en charge — mieux vaut pas de bouton qu'un
          // bouton qui répond « aperçu indisponible ».
          pdfUrl={
            canRenderDocumentPages(version.originalFilename)
              ? `/api/documents/${version.id}/pdf?download=1`
              : null
          }
        />
        {/* Réservé au cabinet et à la version courante : réanalyser une version
            reléguée à l'historique écrirait un résultat qui n'appartient plus au
            document tel qu'il se présente aujourd'hui. Absent pour une image :
            aucun texte à en extraire, donc rien pour une IA à analyser (call du
            15/09/2026) — le bouton n'aurait fait qu'échouer avec une erreur. */}
        {isLatest && canManageVersions && !isImageFile(version.originalFilename) && (
          <AnalyzeDocumentButton documentVersionId={version.id} hasAnalysis={version.hasAnalysis} />
        )}
        {/* La génération s'appuie sur les manques/suggestions de l'analyse : sans
            analyse, il n'y a rien à corriger (cf. document-generation-service.ts) —
            et une image n'en a jamais. */}
        {isLatest && canManageVersions && version.hasAnalysis && !isImageFile(version.originalFilename) && (
          <CorrectedDraftPanel documentVersionId={version.id} />
        )}
        {isLatest && version.producedByCabinet === canManageVersions && (
          <DeleteDocumentVersionButton
            documentVersionId={version.id}
            filename={version.originalFilename}
          />
        )}
      </span>
    </div>
  );
}
