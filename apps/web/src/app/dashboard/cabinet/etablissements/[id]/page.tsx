import Link from "next/link";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEstablishmentChecklist } from "@/lib/actions/checklist";
import { getMission } from "@/lib/actions/mission";
import { getEvaluationChapter, listChapters } from "@/lib/actions/evaluation";
import { listAppointmentsFor } from "@/lib/actions/appointment";
import {
  deriveNextActions,
  describeChapterMeasure,
  describeLoi2002Measure,
  toTimelinePhases,
} from "@/lib/services/structure-sheet-service";
import { flattenChecklist } from "@/lib/services/structure-documents-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { MeasureCard } from "@/components/ui/measure-card";
import { PhaseTimeline } from "@/components/ui/phase-timeline";
import { StatusPill } from "@/components/ui/status-pill";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";
import { AppointmentList } from "@/components/agenda/AppointmentList";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);
  return { title: `${establishment.name} · EODA Conseil` };
}

// Vue d'ensemble de la fiche structure. Tout ce qui s'y lit est DÉRIVÉ
// (structure-sheet-service) : aucun cadre n'affiche un chiffre qui ne se calcule
// pas encore. « Critères impératifs prouvés » arrive avec les rattachements
// documents ↔ critères (tranche N4), les tâches avec le plan d'action (N5).
export default async function StructureOverviewPage({ params }: Props) {
  const { id } = await params;
  // Lectures parallèles, chacune sous sa garde (getEstablishment et la checklist
  // passent par requireEstablishmentInTenant : notFound hors tenant).
  const [establishment, checklist, mission, appointments] = await Promise.all([
    getEstablishment(id),
    getEstablishmentChecklist(id),
    getMission(id),
    listAppointmentsFor({ establishmentId: id }),
  ]);
  const now = new Date();

  // Les chapitres ne se lisent qu'avec une mission (le périmètre de critères en
  // dépend) — même règle que l'onglet Auto-évaluation.
  const chapters = mission
    ? await Promise.all((await listChapters()).map((c) => getEvaluationChapter(id, c.number)))
    : [];

  const documents = flattenChecklist(checklist);
  const measures = [
    ...chapters.map((c) =>
      describeChapterMeasure({
        number: c.chapter.number,
        name: c.chapter.name,
        score: c.chapterScore,
        imperatifsAtRisk: c.imperatifsAtRisk.length,
      })
    ),
    describeLoi2002Measure(checklist.LOI_2002_2 ?? []),
  ];
  const nextActions = deriveNextActions({ establishmentId: id, documents, appointments, now });

  return (
    <div className="space-y-9">
      <section aria-labelledby="overview-scope">
        <h2 id="overview-scope" className="mb-3.5 text-xl font-bold text-ink">
          Où en est la structure
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {measures.map((m) => (
            <MeasureCard key={m.label} label={m.label} value={m.value} percent={m.percent} note={m.note} />
          ))}
        </div>
        <p className="mt-2.5 text-sm text-ink2">
          Auto-évaluation préparatoire, sur le périmètre de critères de la formule — pas une évaluation HAS
          officielle.
          {!mission && " Les chapitres apparaîtront une fois la mission démarrée."}
        </p>
      </section>

      <section aria-labelledby="overview-mission">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h2 id="overview-mission" className="text-xl font-bold text-ink">
            Mission
          </h2>
          <Link href={structureHref(id, "mission")} className="font-bold text-accent-text hover:underline">
            Ouvrir le suivi de mission →
          </Link>
        </div>
        {mission ? (
          <PhaseTimeline label="Phases de la mission" phases={toTimelinePhases(mission, now)} />
        ) : (
          <p className="rounded-xl border border-line bg-card p-5 text-ink2">
            Aucune mission pour l&apos;instant. Elle se crée depuis l&apos;onglet Mission.
          </p>
        )}
      </section>

      <section aria-labelledby="overview-next">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <h2 id="overview-next" className="text-xl font-bold text-ink">
            Les prochaines actions
          </h2>
          <Link href={structureHref(id, "documents")} className="font-bold text-accent-text hover:underline">
            Voir les documents →
          </Link>
        </div>
        {nextActions.length === 0 ? (
          <p className="py-4 text-ink2">Rien à relire, aucune pièce réclamée en attente, aucun rendez-vous prévu.</p>
        ) : (
          <ul className="divide-y divide-line">
            {nextActions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3.5">
                <span className="flex min-w-0 flex-col">
                  {action.href ? (
                    <Link href={action.href} className="font-bold text-ink hover:underline">
                      {action.label}
                    </Link>
                  ) : (
                    <span className="font-bold text-ink">{action.label}</span>
                  )}
                  <span className="text-sm text-ink2">{action.detail}</span>
                </span>
                {action.pill && <StatusPill pill={action.pill} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Agenda de la structure : visio, sur site ou téléphone — la structure voit ces
          créneaux depuis son espace. */}
      <section aria-labelledby="overview-rdv" className="space-y-4 rounded-xl border border-line bg-card p-5">
        <h2 id="overview-rdv" className="text-xl font-bold text-ink">
          Rendez-vous
        </h2>
        <AppointmentList
          appointments={appointments}
          emptyMessage="Aucun rendez-vous programmé avec cette structure pour l'instant."
        />
        <div className="border-t border-line pt-5">
          <AppointmentForm establishmentId={establishment.id} structureName={establishment.name} />
        </div>
      </section>
    </div>
  );
}
