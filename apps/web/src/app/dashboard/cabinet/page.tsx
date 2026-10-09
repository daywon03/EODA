import Link from "next/link";
import { requireCabinetSession } from "@/lib/auth/guards";
import { getStructuresOverview } from "@/lib/actions/structures-overview";
import { listDocumentsAwaitingReview } from "@/lib/actions/review-queue";
import { listUpcomingAgenda } from "@/lib/actions/appointment";
import { countUpcomingHasEvaluations } from "@/lib/services/portfolio-kpi-service";
import { formatAgo } from "@/lib/services/elapsed-time-service";
import {
  buildGreetingSummary,
  firstNameOf,
  selectWatchList,
} from "@/lib/services/structures-overview-service";
import { REVIEW_QUEUE_PATH } from "@/lib/design/cabinet-navigation";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { WatchList } from "@/components/cabinet-home/WatchList";
import { UpcomingAppointments } from "@/components/cabinet-home/UpcomingAppointments";

export const metadata = { title: "Accueil · EODA Conseil" };

// Horizon des échéances mises en avant : deux trimestres. Au-delà, une évaluation
// HAS n'appelle aucune action cette semaine ; en deçà, la préparation est engagée.
const HAS_HORIZON_DAYS = 180;

// Accueil du cabinet (maquette « Portail Cabinet v2 », vue Accueil). Tout ce qui
// s'y affiche est DÉRIVÉ : la file « À relire », les KPI de portefeuille (mêmes
// faits que les badges d'étape), les motifs « À surveiller » (service pur),
// l'agenda. « Mes tâches du jour » n'apparaît pas : les tâches n'existent pas encore
// (tranche N5), et un bloc factice serait une fonctionnalité en panne (D6).
export default async function CabinetHomePage() {
  const { session } = await requireCabinetSession();
  const [{ rows, portfolio }, queue, appointments] = await Promise.all([
    getStructuresOverview(),
    listDocumentsAwaitingReview(),
    listUpcomingAgenda(4),
  ]);
  const now = new Date();

  const watch = selectWatchList(rows, now);
  const oldest = queue.items[0];
  const unansweredCount = rows.filter((row) => row.hasUnansweredMessage).length;
  const firstName = firstNameOf(session.user.name);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-ink">{firstName ? `Bonjour ${firstName}.` : "Bonjour."}</h1>
          <p className="mt-1.5 text-lg text-ink2">
            {buildGreetingSummary({ awaitingReview: queue.totalCount, watchCount: watch.length })}
          </p>
        </div>
        <Button asChild size="lg" className="text-base font-bold">
          <Link href={REVIEW_QUEUE_PATH}>Ouvrir la file « À relire »</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          value={String(queue.totalCount)}
          label="Documents à relire"
          hint={oldest ? `Le plus ancien : déposé ${formatAgo(oldest.uploadedAt, now)}` : "Tout est relu."}
          href={REVIEW_QUEUE_PATH}
        />
        <KpiCard
          value={String(countUpcomingHasEvaluations(portfolio, { now, withinDays: HAS_HORIZON_DAYS }))}
          label="Évaluations HAS dans moins de 6 mois"
          hint="Missions en cours, échéance dans les 180 jours"
          href="/dashboard/cabinet/structures"
        />
        <KpiCard
          value={String(unansweredCount)}
          label="Messages sans réponse"
          hint="Structures dont le dernier message attend votre réponse"
          href="/dashboard/cabinet/structures"
        />
      </div>

      <WatchList items={watch} now={now} />

      <UpcomingAppointments appointments={appointments} />
    </div>
  );
}
