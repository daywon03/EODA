import { cache, Suspense } from "react";
import Link from "next/link";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEstablishmentChecklist } from "@/lib/actions/checklist";
import { getMission } from "@/lib/actions/mission";
import { getEvaluationChapter, listChapters } from "@/lib/actions/evaluation-chapter";
import { listAppointmentsFor } from "@/lib/actions/appointment";
import { getStructureCriteriaProof } from "@/lib/actions/criteria-proof";
import { listEstablishmentActionItems } from "@/lib/actions/task";
import { getStructureDiagnostic } from "@/lib/actions/diagnostic";
import { DiagnosticReviewCard } from "@/components/diagnostic/DiagnosticReviewCard";
import {
  deriveNextActions,
  describeChapterMeasure,
  describeImperativesMeasure,
  describeLoi2002Measure,
  toTimelinePhases,
} from "@/lib/services/structure-sheet-service";
import { documentsHref, flattenChecklist } from "@/lib/services/structure-documents-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { MeasureCard } from "@/components/ui/measure-card";
import { PhaseTimeline } from "@/components/ui/phase-timeline";
import { StatusPill } from "@/components/ui/status-pill";
import { RowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";
import { AppointmentList } from "@/components/agenda/AppointmentList";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const establishment = await loadEstablishment(id);
  return { title: `${establishment.name}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue d'ensemble de la fiche structure. Tout ce qui s'y lit est DÉRIVÉ
// (structure-sheet-service) : aucun cadre n'affiche un chiffre qui ne se calcule
// pas encore. « Critères impératifs » (N4) se dérive de la matrice validée.
//
// AFFICHAGE PAR MORCEAUX (21/10/2026, demande de Damon : « efficacité des appels et
// du rendu ») : la page attendait TOUTES ses lectures avant d'afficher quoi que ce
// soit (2,8 s depuis un poste). Chaque section est désormais un composant serveur
// sous <Suspense> : les titres et les cadres s'affichent tout de suite, chaque
// section se remplit dès que SES données arrivent. Les lectures partagées entre
// sections (checklist, mission, rendez-vous…) sont mémoïsées pour ce rendu
// (`react.cache`) : découper ne relit rien deux fois. Chaque lecture garde sa
// propre garde (requireEstablishmentInTenant : notFound hors tenant), et l'en-tête
// (layout.tsx) a déjà répondu notFound pour une fiche hors périmètre.
// ─────────────────────────────────────────────────────────────────────────────
const loadEstablishment = cache(getEstablishment);
const loadChecklist = cache(getEstablishmentChecklist);
const loadMission = cache(getMission);
const loadAppointments = cache((establishmentId: string) => listAppointmentsFor({ establishmentId }));
const loadTasks = cache(listEstablishmentActionItems);

export default async function StructureOverviewPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-9">
      <section aria-labelledby="overview-scope">
        <h2 id="overview-scope" className="mb-3.5 text-xl font-bold text-ink">
          Où en est la structure
        </h2>
        <Suspense fallback={<MeasuresSkeleton />}>
          <MeasuresSection id={id} />
        </Suspense>
      </section>

      <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
        <DiagnosticSection id={id} />
      </Suspense>

      <section aria-labelledby="overview-mission">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h2 id="overview-mission" className="text-xl font-bold text-ink">
            Mission
          </h2>
          <Link href={structureHref(id, "mission")} className="inline-flex min-h-11 items-center font-bold text-accent-text hover:underline">
            Ouvrir le suivi de mission →
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-24 rounded-xl" />}>
          <MissionSection id={id} />
        </Suspense>
      </section>

      <section aria-labelledby="overview-next">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <h2 id="overview-next" className="text-xl font-bold text-ink">
            Les prochaines actions
          </h2>
          <Link href={structureHref(id, "documents")} className="inline-flex min-h-11 items-center font-bold text-accent-text hover:underline">
            Voir les documents →
          </Link>
        </div>
        <Suspense fallback={<RowsSkeleton count={4} />}>
          <NextActionsSection id={id} />
        </Suspense>
      </section>

      {/* Agenda de la structure : visio, sur site ou téléphone — la structure voit ces
          créneaux depuis son espace. */}
      <section aria-labelledby="overview-rdv" className="space-y-4 rounded-xl border border-line bg-card p-5">
        <h2 id="overview-rdv" className="text-xl font-bold text-ink">
          Rendez-vous
        </h2>
        <Suspense fallback={<RowsSkeleton count={2} />}>
          <AppointmentsSection id={id} />
        </Suspense>
      </section>
    </div>
  );
}

function MeasuresSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}

// Chaque mesure mène à son détail (call du 18/10/2026).
async function MeasuresSection({ id }: { id: string }) {
  // Les chapitres partent avec le reste — chacun répond `missionRequired` sans mission.
  const [checklist, mission, proof, allChapters] = await Promise.all([
    loadChecklist(id),
    loadMission(id),
    getStructureCriteriaProof(id),
    listChapters().then((list) => Promise.all(list.map((c) => getEvaluationChapter(id, c.number)))),
  ]);
  // Les chapitres ne se lisent qu'avec une mission (le périmètre de critères en
  // dépend) — même règle que l'onglet Auto-évaluation.
  const chapters = mission ? allChapters.filter((c) => !c.missionRequired) : [];
  const measures = [
    { ...describeImperativesMeasure(proof.imperatives, proof.expectedImperatives), href: structureHref(id, "criteres") },
    ...chapters.map((c) => ({
      ...describeChapterMeasure({
        number: c.chapter.number,
        name: c.chapter.name,
        score: c.chapterScore,
        imperatifsAtRisk: c.imperatifsAtRisk.length,
      }),
      href: `${structureHref(id, "evaluation")}/chapitre/${c.chapter.number}`,
    })),
    {
      ...describeLoi2002Measure(checklist.LOI_2002_2 ?? []),
      href: documentsHref(structureHref(id, "documents"), { bucket: "validated", category: "LOI_2002_2" }),
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {measures.map((m) => (
          <MeasureCard key={m.label} label={m.label} value={m.value} percent={m.percent} note={m.note} href={m.href} />
        ))}
      </div>
      <p className="mt-2.5 text-sm text-ink2">
        Auto-évaluation préparatoire, sur le périmètre de critères de la formule — pas une évaluation HAS officielle.
        {!mission && " Les chapitres apparaîtront une fois la mission démarrée."}
      </p>
    </>
  );
}

async function DiagnosticSection({ id }: { id: string }) {
  return <DiagnosticReviewCard data={await getStructureDiagnostic(id)} />;
}

async function MissionSection({ id }: { id: string }) {
  const mission = await loadMission(id);
  return mission ? (
    <PhaseTimeline label="Phases de la mission" phases={toTimelinePhases(mission, new Date())} />
  ) : (
    <p className="rounded-xl border border-line bg-card p-5 text-ink2">
      Aucune mission pour l&apos;instant. Elle se crée depuis l&apos;onglet Mission.
    </p>
  );
}

async function NextActionsSection({ id }: { id: string }) {
  const [checklist, appointments, tasks] = await Promise.all([loadChecklist(id), loadAppointments(id), loadTasks(id)]);
  const nextActions = deriveNextActions({
    establishmentId: id,
    documents: flattenChecklist(checklist),
    appointments,
    now: new Date(),
    tasks: tasks.items,
  });

  if (nextActions.length === 0) {
    return <p className="py-4 text-ink2">Rien à relire, aucune pièce réclamée en attente, aucun rendez-vous prévu.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {nextActions.map((action) => (
        <li key={action.id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3.5">
          <span className="flex min-w-0 flex-col">
            {action.href ? (
              <Link href={action.href} className="inline-flex min-h-11 items-center font-bold text-ink hover:underline">
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
  );
}

async function AppointmentsSection({ id }: { id: string }) {
  const [establishment, appointments] = await Promise.all([loadEstablishment(id), loadAppointments(id)]);
  return (
    <>
      <AppointmentList appointments={appointments} emptyMessage="Aucun rendez-vous programmé avec cette structure pour l'instant." />
      <div className="border-t border-line pt-5">
        <AppointmentForm establishmentId={establishment.id} structureName={establishment.name} />
      </div>
    </>
  );
}
