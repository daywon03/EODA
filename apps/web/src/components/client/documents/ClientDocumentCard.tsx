import Link from "next/link";
import type { SupportMode } from "@eoda/database";
import type { ChecklistItem } from "@/lib/actions/checklist";
import {
  clientDocumentPill,
  depositNoticeFor,
  type ClientDocumentState,
} from "@/lib/services/client-documents-view-service";
import { clientWaitingLine } from "@/lib/services/client-document-waiting-service";
import { StatusPill } from "@/components/ui/status-pill";
import { DocumentAnalysisPanel } from "@/components/checklist/DocumentAnalysisPanel";
import { ClientDocumentActions } from "./ClientDocumentActions";

// Une carte de « Mes documents » : le nom, la pastille (mot + glyphe), un geste
// principal, et — quand il y a quelque chose à lire — l'analyse sous sa mention
// (review-mention-service, calculée par la couche de lecture).
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

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <h3 className="text-[19px] font-bold leading-snug">{item.label}</h3>
          {item.expiryNotice && <p className="text-base font-bold">{item.expiryNotice}</p>}
          {/* Le DIPC se réclame en modèle vierge : un exemplaire signé est une donnée
              de santé nominative (HDS). Dit à l'écran, pas seulement au dépôt. */}
          {notice && state === "TO_DEPOSIT" && <p className="text-base text-ink2">{notice}</p>}
          {waiting && <p className="text-base text-ink2">{waiting}</p>}
        </div>
        <StatusPill pill={clientDocumentPill(state, mode, { reviewedByEoda: version?.reviewedByEoda ?? false })} className="text-base" />
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
