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
import { primaryCardAction } from "@/lib/services/client-documents-page-service";
import { clientWaitingLine } from "@/lib/services/client-document-waiting-service";
import { StatusPill } from "@/components/ui/status-pill";
import { DocumentAnalysisPanel } from "@/components/checklist/DocumentAnalysisPanel";
import { ParticipationFormPicker } from "@/components/checklist/ParticipationFormPicker";
import { PARTICIPATION_LINE_CODE } from "@/lib/services/participation-form-service";
import { ClientDocumentActions } from "./ClientDocumentActions";
import { RestrictedFileNotice } from "@/components/checklist/RestrictedFileNotice";
import { formatDate } from "@/lib/services/date-format-service";
import { cardSignatureOffer, signedCopyPath, signingPagePath } from "@/lib/services/document-signature-service";

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
  isDirection = false,
  complianceHref = null,
}: {
  item: ChecklistItem;
  state: ClientDocumentState;
  mode: SupportMode;
  establishmentId: string;
  // Dépôts ouverts (mission active) ; en bibliothèque, la carte se lit seulement.
  canAct: boolean;
  // La personne connectée est la DIRECTION : elle seule signe et tamponne (12/11/2026).
  isDirection?: boolean;
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
  //
  // Ligne à accès restreint (le tampon, ADR 20261110) : seule la direction ouvre le
  // fichier et dépose (`canOpenFile`, calculé par la couche de lecture) ; les autres rôles
  // voient la ligne et un cadenas. Les routes refusent de toute façon.
  const fileLocked = !item.canOpenFile;
  const viewable = fileLocked ? null : viewableVersionFor(item);
  const visibleVersions = versionsVisibleToClient(item.versions, item.validatedAt, item.restrictedAccess);
  const canDeposit = canAct && !fileLocked;
  // UN geste principal (09/11/2026) : déposer, accepter, sinon voir. Le reste est
  // secondaire — lien ou contour, jamais un second aplat.
  const primary = primaryCardAction(state, { canAct: canDeposit, hasViewable: viewable !== null });
  // Signer et tamponner un document accepté (12/11/2026) — la direction seule ; la copie
  // signée se télécharge ensuite par tous ceux qui ouvrent le document.
  const signature = cardSignatureOffer({
    accepted: state === "ACCEPTED",
    isDirection,
    canAct: canDeposit,
    restricted: item.restrictedAccess,
    filename: version?.originalFilename ?? null,
    signedAt: version?.signedAt ?? null,
  });
  // Toute carte qui a une pièce visible montre « Voir le document », au même endroit.
  const viewer = viewable ? (
    <ClientDocumentViewer
      label={item.label}
      versions={visibleVersions}
      mention={version?.clientMention ?? null}
      emphasis={primary === "VIEW" ? "primary" : "secondary"}
    />
  ) : null;

  // Même gabarit pour toutes les cartes (QA du 09/11/2026) : titre et pastille, les
  // lignes d'information (dont « Relu par EODA, le … »), puis UNE rangée d'actions où
  // le geste principal vient en premier.
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="min-w-0 flex-1 basis-[240px] text-[19px] font-bold leading-snug">{item.label}</h3>
        <StatusPill pill={clientDocumentPill(state, mode, { reviewedByEoda: version?.reviewedByEoda ?? false })} className="text-base" />
      </div>

      <div className="flex flex-col gap-1">
          {!version?.analysis && version?.clientMention && <p className="text-base font-bold">{version.clientMention}</p>}
          {item.expiryNotice && <p className="text-base font-bold">{item.expiryNotice}</p>}
          {/* Le DIPEC se réclame en modèle vierge : un exemplaire signé est une donnée
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
          {item.restrictedAccess && fileLocked && <RestrictedFileNotice className="text-base" />}
          {signature === "SIGNED" && version?.signedAt && (
            <p className="text-base font-bold">Signé par la direction le {formatDate(version.signedAt)}</p>
          )}
          {viewable && (
            <p className="text-base text-ink2">
              {viewable.producedByCabinet ? "Document produit par EODA" : "Votre dépôt"} · version{" "}
              {viewable.versionNumber}
            </p>
          )}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {primary === "VIEW" && viewer}
        {canDeposit && (
          <ClientDocumentActions
            establishmentId={establishmentId}
            documentTypeId={item.documentTypeId}
            label={item.label}
            category={item.category}
            code={item.code}
            state={state}
            depositNotice={notice}
            canAccept={primary === "ACCEPT"}
          />
        )}
        {primary !== "VIEW" && viewer}
        {signature === "SIGN" && (
          <Link
            href={signingPagePath(item.documentTypeId)}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-[10px] border-2 border-line bg-card px-5 text-[17px] font-bold text-ink hover:bg-soft"
          >
            Signer et tamponner
            <span className="sr-only"> : {item.label}</span>
          </Link>
        )}
        {signature === "SIGNED" && version && (
          <a
            href={signedCopyPath(version.id)}
            className="inline-flex min-h-12 items-center font-bold text-accent-text underline underline-offset-4"
          >
            Télécharger la version signée
            <span className="sr-only"> : {item.label}</span>
          </a>
        )}
        {complianceHref && (
          <Link
            href={complianceHref}
            className="inline-flex min-h-12 items-center font-bold text-accent-text underline underline-offset-4"
          >
            Mettre en conformité
          </Link>
        )}
      </div>

      {version?.analysis && <DocumentAnalysisPanel analysis={version.analysis} clientMention={version.clientMention} />}
    </article>
  );
}
