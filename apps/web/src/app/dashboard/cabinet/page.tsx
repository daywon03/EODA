import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listEstablishments } from "@/lib/actions/establishment";
import { EstablishmentCard } from "@/components/etablissement/EstablishmentCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/kpi/KpiCard";
import { deriveFunnelStage, isBetaMission } from "@/lib/services/lifecycle-service";
import {
  countActiveClients,
  countOngoingAccompaniments,
  countUpcomingHasEvaluations,
} from "@/lib/services/portfolio-kpi-service";
import { toMissionLifecycleFacts } from "@/lib/db/to-mission-lifecycle-facts";
import { toPortfolioRow } from "@/lib/db/to-portfolio-row";
import { Button } from "@/components/ui/button";
import { Plus, Building2, FileText, CalendarClock, ScrollText, Activity } from "lucide-react";

// Horizon des échéances mises en avant : deux trimestres. Au-delà, une évaluation
// HAS n'appelle aucune action cette semaine ; en deçà, la préparation est engagée.
const HAS_HORIZON_DAYS = 180;

export const metadata = { title: "Dashboard Cabinet · EODA Conseil" };

export default async function CabinetDashboardPage() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  const establishments = await listEstablishments();
  const totalDocuments = establishments.reduce((sum, e) => sum + e._count.documents, 0);

  // Comptés à partir des fiches DÉJÀ chargées, avec la même conversion que la page
  // commerciale : les deux écrans doivent annoncer le même portefeuille.
  const portfolio = establishments.map(toPortfolioRow);
  // `now` calculé ici et passé au service : les règles restent pures et testables
  // sans dépendre de l'horloge.
  const now = new Date();

  const stats = [
    // « Établissements suivis » comptait aussi les missions closes depuis des mois :
    // un portefeuille qui ne décroît jamais n'est pas un indicateur. Les fiches
    // terminées restent listées ci-dessous, elles ne gonflent plus le compte.
    { label: "Clients actifs", value: countActiveClients(portfolio), icon: Building2 },
    // Distinct du précédent : une structure qui vient de signer n'occupe pas encore
    // de temps de travail.
    { label: "Accompagnements en cours", value: countOngoingAccompaniments(portfolio), icon: Activity },
    { label: "Documents déposés", value: totalDocuments, icon: FileText },
    // Remplace « Évaluations HAS planifiées », devenu le nombre total de fiches
    // depuis que la date d'échéance est exigée à la signature.
    {
      label: "Échéances HAS < 6 mois",
      value: countUpcomingHasEvaluations(portfolio, { now, withinDays: HAS_HORIZON_DAYS }),
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord Cabinet"
        subtitle={`Bienvenue, ${session.user.name ?? session.user.email}`}
        action={
          <div className="flex items-center gap-2">
            {/* Le journal d'audit vit ici plutôt que dans la navigation principale :
                c'est un écran de contrôle, consulté ponctuellement, pas un module. */}
            <Button variant="outline" asChild>
              <Link href="/dashboard/cabinet/journal">
                <ScrollText className="w-4 h-4" aria-hidden="true" />
                Journal d&apos;audit
              </Link>
            </Button>
            {/* Une fiche client ne se crée plus à la main : elle naît de la
                signature d'un devis (convertDevisToClient). Un établissement créé
                hors entonnoir n'aurait ni prospect, ni devis, ni chiffre d'affaires
                — donc n'apparaîtrait dans aucun indicateur commercial. Le point
                d'entrée est le prospect. */}
            <Button asChild>
              <Link href="/dashboard/cabinet/commercial/prospects">
                <Plus className="w-4 h-4" aria-hidden="true" />
                Nouveau prospect
              </Link>
            </Button>
          </div>
        }
      />

      {establishments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Même carte que le tableau de bord commercial : la mise en forme était
              recopiée ici, deux styles pour un même indicateur. */}
          {stats.map(({ label, value, icon }) => (
            <KpiCard key={label} label={label} value={String(value)} icon={icon} />
          ))}
        </div>
      )}

      {establishments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gris-light rounded-xl bg-white/50">
          <Building2 className="w-12 h-12 text-gris-light mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-brun-ancre mb-1">Aucune fiche client</h2>
          <p className="text-gris-mid text-sm mb-6 max-w-md">
            Une fiche client naît de la signature d&apos;un devis. Commencez par
            enregistrer le prospect, établissez son devis, puis signez-le : la fiche,
            la mission et les options souscrites sont créées d&apos;un seul geste.
          </p>
          <Button asChild>
            <Link href="/dashboard/cabinet/commercial/prospects">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Ouvrir le pipeline prospects
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {establishments.map((e) => (
            <EstablishmentCard
              key={e.id}
              id={e.id}
              name={e.name}
              finessNumber={e.finessNumber}
              type={e.type}
              hasEvaluationTargetDate={e.hasEvaluationTargetDate}
              documentCount={e._count.documents}
              stage={deriveFunnelStage({
                prospectStatus: e.prospect?.status ?? null,
                mission: toMissionLifecycleFacts(e.mission),
              })}
              beta={isBetaMission(toMissionLifecycleFacts(e.mission))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
