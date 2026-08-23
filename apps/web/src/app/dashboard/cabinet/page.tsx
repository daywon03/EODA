import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listEstablishments } from "@/lib/actions/establishment";
import { EstablishmentCard } from "@/components/etablissement/EstablishmentCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { deriveFunnelStage, isBetaMission } from "@/lib/services/lifecycle-service";
import { toMissionLifecycleFacts } from "@/lib/db/to-mission-lifecycle-facts";
import { Button } from "@/components/ui/button";
import { Plus, Building2, FileText, CalendarClock, ScrollText } from "lucide-react";

export const metadata = { title: "Dashboard Cabinet · EODA Conseil" };

export default async function CabinetDashboardPage() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  const establishments = await listEstablishments();
  const totalDocuments = establishments.reduce((sum, e) => sum + e._count.documents, 0);
  const upcomingEvaluations = establishments.filter((e) => e.hasEvaluationTargetDate).length;

  const stats = [
    { label: "Établissements suivis", value: establishments.length, icon: Building2 },
    { label: "Documents déposés", value: totalDocuments, icon: FileText },
    { label: "Évaluations HAS planifiées", value: upcomingEvaluations, icon: CalendarClock },
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white border border-gris-light rounded-xl p-5 flex items-center gap-4">
              <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-ambre/15 flex-shrink-0">
                <Icon className="w-5 h-5 text-ambre" aria-hidden="true" />
              </span>
              <div>
                <p className="text-2xl font-bold text-brun-ancre leading-none tabular-nums">{value}</p>
                <p className="text-xs text-gris-mid mt-1">{label}</p>
              </div>
            </div>
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
