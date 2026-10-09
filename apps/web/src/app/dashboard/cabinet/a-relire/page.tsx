import Link from "next/link";
import { getReviewQueueEntry, listDocumentsAwaitingReview } from "@/lib/actions/review-queue";
import { describeReviewMention } from "@/lib/services/analysis-view-service";
import { formatAgo } from "@/lib/services/elapsed-time-service";
import { nextQueueHref, pluralizeProposals, type ReviewQueueItem } from "@/lib/services/review-queue-service";
import { InlineDocumentPreview } from "@/components/review/InlineDocumentPreview";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { EodaMark } from "@/components/layout/EodaLogo";
import { cn } from "@/lib/utils";

export const metadata = { title: "À relire · EODA Conseil" };

type SearchParams = { v?: string | string[] };

// File « À relire » (maquette « Portail Cabinet v2 », vue À relire) : la file à
// gauche, l'original au centre, l'analyse à vérifier à droite.
//
// L'élément ouvert vient de l'URL (`?v=`) : partageable, et c'est le SERVEUR qui
// décide de ce qui s'affiche — getReviewQueueEntry vérifie que la version
// appartient au tenant (notFound() sinon). Sans `?v=`, le plus ancien s'ouvre.
export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requested = typeof params.v === "string" ? params.v : null;
  const { items, totalCount } = await listDocumentsAwaitingReview();

  const selectedId = requested ?? items[0]?.versionId ?? null;
  const entry = selectedId ? await getReviewQueueEntry(selectedId) : null;
  const now = new Date();
  const hiddenCount = totalCount - items.length;

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100vh-4rem)] sm:-mx-6 sm:-my-8 lg:-mx-8 lg:grid-cols-[288px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-2.5 border-b border-line bg-paper px-4 py-7 lg:border-b-0 lg:border-r">
        <h1 className="mx-2 text-2xl font-bold text-ink">À relire</h1>
        {items.length > 0 ? (
          <>
            <p className="mx-2 mb-2 text-base text-ink2">Du plus ancien au plus récent, toutes structures.</p>
            <nav aria-label="File des documents à relire">
              <ul className="flex flex-col gap-2.5">
                {items.map((item) => (
                  <QueueLink key={item.versionId} item={item} now={now} isCurrent={item.versionId === entry?.versionId} />
                ))}
              </ul>
            </nav>
            {hiddenCount > 0 && (
              <p className="mx-2 text-sm text-ink2">
                {hiddenCount} autre{hiddenCount > 1 ? "s" : ""}, plus récent{hiddenCount > 1 ? "s" : ""}, apparaîtront
                à mesure que la file se vide.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <EodaMark size={48} />
            <p className="text-lg font-bold text-ink">Tout est relu.</p>
            <p className="text-base text-ink2">Les prochains dépôts analysés arriveront ici.</p>
          </div>
        )}
      </aside>

      {entry && (
        <div className="grid min-h-0 content-start xl:grid-cols-2">
          <section aria-labelledby="preview-heading" className="flex flex-col gap-3 border-line p-6 lg:p-7 xl:border-r">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="preview-heading" className="text-xl font-bold text-ink">
                {entry.documentLabel}
              </h2>
              <span className="text-sm text-ink2">
                {entry.versionLabel} · déposé {formatAgo(entry.uploadedAt, now)}
              </span>
            </div>
            <InlineDocumentPreview key={entry.versionId} versionId={entry.versionId} />
            <Link
              href={`/dashboard/cabinet/etablissements/${entry.establishmentId}`}
              className="text-base font-bold text-accent-text underline-offset-4 hover:underline"
            >
              Ouvrir la fiche de {entry.establishmentName}
            </Link>
          </section>
          <section aria-label="Analyse à vérifier" className="flex flex-col bg-card p-6 lg:p-7">
            <ReviewPanel
              key={entry.versionId}
              entry={entry}
              nextHref={nextQueueHref(items, entry.versionId)}
              todayMention={describeReviewMention(now)}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function QueueLink({ item, now, isCurrent }: { item: ReviewQueueItem; now: Date; isCurrent: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          "flex min-h-11 flex-col gap-0.5 rounded-lg border p-3.5 text-ink hover:border-accent-text",
          isCurrent ? "border-ink bg-card" : "border-line bg-paper"
        )}
      >
        <span className="font-bold">{item.documentLabel}</span>
        <span className="text-sm text-ink2">{item.establishmentName}</span>
        <span className="text-sm text-ink2">
          Déposé {formatAgo(item.uploadedAt, now)} · {pluralizeProposals(item.proposalCount)}
        </span>
      </Link>
    </li>
  );
}
