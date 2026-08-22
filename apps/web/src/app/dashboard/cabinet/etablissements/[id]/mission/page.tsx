import { getEstablishment } from "@/lib/actions/establishment";
import {
  getMission,
  getMissionDocumentCounters,
  listFormulesForMissionSetup,
  listOptionsForMissionSetup,
} from "@/lib/actions/mission";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateMissionForm } from "@/components/mission/CreateMissionForm";
import { MissionScopeEditor } from "@/components/mission/MissionScopeEditor";
import { MissionProgressSummary } from "@/components/mission/MissionProgressSummary";
import { DiagnosticChecklistSection } from "@/components/mission/DiagnosticChecklistSection";
import { PhaseChecklistSection } from "@/components/mission/PhaseChecklistSection";
import { MissionDocumentCounters } from "@/components/mission/MissionDocumentCounters";
import type { MissionChecklistScope } from "@eoda/database";

type Props = { params: Promise<{ id: string }> };

const PHASE_LABELS: Record<Exclude<MissionChecklistScope, "DIAGNOSTIC">, string> = {
  FONDATIONS: "Phase 1 — Fondations",
  DEPLOIEMENT: "Phase 2 — Déploiement",
  CONSOLIDATION: "Phase 3 — Consolidation",
  PREPARATION_FINALE: "Phase 4 — Préparation finale",
};

const PHASE_ORDER: Exclude<MissionChecklistScope, "DIAGNOSTIC">[] = [
  "FONDATIONS",
  "DEPLOIEMENT",
  "CONSOLIDATION",
  "PREPARATION_FINALE",
];

const PHASE_DATE_FIELDS: Record<
  Exclude<MissionChecklistScope, "DIAGNOSTIC">,
  { start: "fondationsStartDate" | "deploiementStartDate" | "consolidationStartDate" | "preparationFinaleStartDate"; end: "fondationsEndDate" | "deploiementEndDate" | "consolidationEndDate" | "preparationFinaleEndDate" }
> = {
  FONDATIONS: { start: "fondationsStartDate", end: "fondationsEndDate" },
  DEPLOIEMENT: { start: "deploiementStartDate", end: "deploiementEndDate" },
  CONSOLIDATION: { start: "consolidationStartDate", end: "consolidationEndDate" },
  PREPARATION_FINALE: { start: "preparationFinaleStartDate", end: "preparationFinaleEndDate" },
};

export default async function MissionPage({ params }: Props) {
  const { id } = await params;
  const [establishment, mission, formules, options, documentCounters] = await Promise.all([
    getEstablishment(id),
    getMission(id),
    listFormulesForMissionSetup(),
    listOptionsForMissionSetup(),
    getMissionDocumentCounters(id),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Suivi de mission"
        subtitle={establishment.name}
        backHref={`/dashboard/cabinet/etablissements/${id}`}
      />

      {!mission ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Démarrer le suivi</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateMissionForm establishmentId={id} formules={formules} options={options} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <MissionProgressSummary
            diagnosticPct={mission.progress.diagnosticPct}
            phasesPct={mission.progress.phasesPct}
            globalPct={mission.progress.globalPct}
          />

          {documentCounters && <MissionDocumentCounters counters={documentCounters} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Périmètre contractuel</CardTitle>
            </CardHeader>
            <CardContent>
              <MissionScopeEditor
                missionId={mission.id}
                formules={formules}
                options={options}
                currentFormule={mission.formule}
                currentGratuit={mission.gratuit}
                subscribedOptions={mission.options}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <DiagnosticChecklistSection
                missionId={mission.id}
                items={mission.items.filter((i) => i.scope === "DIAGNOSTIC")}
                pct={mission.progress.diagnosticPct}
              />
            </CardContent>
          </Card>

          {PHASE_ORDER.map((phase) => (
            <Card key={phase}>
              <CardContent className="pt-6">
                <PhaseChecklistSection
                  missionId={mission.id}
                  phase={phase}
                  label={PHASE_LABELS[phase]}
                  items={mission.items.filter((i) => i.scope === phase)}
                  pct={mission.progress.phasePcts[phase] ?? 0}
                  startDate={mission[PHASE_DATE_FIELDS[phase].start]}
                  endDate={mission[PHASE_DATE_FIELDS[phase].end]}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
