import Link from "next/link";
import type { SupportMode } from "@eoda/database";
import type { ChecklistItem } from "@/lib/actions/checklist";
import {
  clientDocumentPill,
  depositNoticeFor,
  versionsVisibleToClient,
  viewableVersionFor,
  type ClientDocumentState,
} from "@/lib/services/client-documents-view-service";
import { ClientDocumentViewer } from "./ClientDocumentViewer";
import { clientWaitingLine } from "@/lib/services/client-document-waiting-service";
import { canRenderDocumentPages } from "@/lib/services/file-type-service";
import { StatusPill } from "@/components/ui/status-pill";
import { DocumentAnalysisPanel } from "@/components/checklist/DocumentAnalysisPanel";
import { ParticipationFormPicker } from "@/components/checklist/ParticipationFormPicker";
import { PARTICIPATION_LINE_CODE } from "@/lib/services/participation-form-service";
import { DocumentDownloadLink } from "@/components/checklist/DocumentDownloadLink";
import { ClientDocumentActions } from "./ClientDocumentActions";

// Une carte de « Mes documents » : le nom, la pastille (mot + glyphe), un geste
// principal, et — quand il y a quelque chose à lire — l'analyse sous sa mention
// (review-mention-service, calculée par la couche de lecture).
//
// « Voir » est là depuis le 20/10/2026 : la structure ne pouvait ouvrir ses pièces
// que dans « Mes livrables », qui ne montre que ce qu'EODA a validé. Sa propre pièce
// déposée n'était consultable nulle part. Ce qui est montrable est décidé une seule
// fois, dans `viewableVersionFor` (pure, testée) — pas ici : un brouillon EODA non
// validé ne se restitue pas, une pièce déposée par la structure, si.
export function ClientDocumentCard({
  item,
  state,
  mode,
  establishmentId,
  canAct,
  complianceHref = null,
}: {
  item: ChecklistItem;
  state: ClientDocumentState;
  mode: SupportMode;
  establishmentId: string;
  // Dépôts ouverts (mission active) ; en bibliothèque, la carte se lit seulement.
  canAct: boolean;
  // « Mettre en conformité » (N8) : en autonomie, si l'offre comprend la génération
  // de ce document et qu'une analyse est lisible. Calculé par la page.
  complianceHref?: string | null;
}) {
  const version = item.currentVersion;
  const notice = depositNoticeFor(item.code);
  const waiting = clientWaitingLine(state, mode);
  // La pièce à ouvrir peut ne PAS être la version en cours : quand EODA a déposé un
  // brouillon par-dessus le dépôt du client, on montre le dépôt du client (règle 1
  // de `viewableVersionFor`).
  const viewable = viewableVersionFor(item);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          {/* Le nom ouvre le document (ses dépôts, et ceux d'EODA une fois validés). */}
          <ClientDocumentViewer
            label={item.label}
            versions={versionsVisibleToClient(item.versions, item.validatedAt)}
            mention={version?.clientMention ?? null}
          />
          {item.expiryNotice && <p className="text-base font-bold">{item.expiryNotice}</p>}
          {/* Le DIPC se réclame en modèle vierge : un exemplaire signé est une donnée
              de santé nominative (HDS). Dit à l'écran, pas seulement au dépôt. */}
          {notice && state === "TO_DEPOSIT" && <p className="text-base text-ink2">{notice}</p>}
          {waiting && <p className="text-base text-ink2">{waiting}</p>}
          {/* Ligne « Autre forme de participation » : la structure dit laquelle (21/10/2026). */}
          {item.code === PARTICIPATION_LINE_CODE && canAct && (
            <ParticipationFormPicker
              establishmentId={establishmentId}
              form={item.participationForm}
              otherLabel={item.participationOtherLabel}
            />
          )}
          {/* Ce qu'on ouvre est DIT, pas seulement cliquable : « votre dépôt » et
              « document produit par EODA » ne sont pas la même chose juridiquement
              (CLAUDE.md §7, deux mentions jamais interchangeables). */}
          {viewable && (
            <p className="text-base text-ink2">
              {viewable.producedByCabinet ? "Document produit par EODA" : "Votre dépôt"} · version{" "}
              {viewable.versionNumber}
            </p>
          )}
        </div>
        <StatusPill pill={clientDocumentPill(state, mode, { reviewedByEoda: version?.reviewedByEoda ?? false })} className="text-base" />
        {viewable && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* « Voir » est porté par le nom du document (ClientDocumentViewer) : un
                second bouton identique ici serait un doublon. */}
            <DocumentDownloadLink
              documentVersionId={viewable.id}
              // Le PDF existe là où le format se convertit ; ailleurs, le lien natif
              // suffit (document-pdf-service décide par SIGNATURE, pas par extension).
              pdfUrl={
                canRenderDocumentPages(viewable.filename)
                  ? `/api/documents/${viewable.id}/pdf?download=1`
                  : null
              }
            />
          </div>
        )}
        {complianceHref && (
          <Link
            href={complianceHref}
            className="inline-flex min-h-12 items-center rounded-[10px] border-2 border-accent-text bg-card px-4 text-[17px] font-bold text-ink hover:bg-soft"
          >
            Mettre en conformité
          </Link>
        )}
        {canAct && (
          <ClientDocumentActions
            establishmentId={establishmentId}
            documentTypeId={item.documentTypeId}
            label={item.label}
            category={item.category}
            code={item.code}
            state={state}
            depositNotice={notice}
          />
        )}
      </div>

      {version?.analysis ? (
        <DocumentAnalysisPanel analysis={version.analysis} clientMention={version.clientMention} />
      ) : (
        version?.clientMention && <p className="text-base font-bold">{version.clientMention}</p>
      )}
    </article>
  );
}
