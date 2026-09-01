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
import { MissionClosureSection } from "@/components/mission/MissionClosureSection";
import { Button } from "@/components/ui/button";
import { FileSignature } from "lucide-react";
import { needsAvenant } from "@/lib/services/avenant-service";
import { auth } from "@/auth";
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
  const [session, establishment, mission, formules, options, documentCounters] = await Promise.all([
    auth(),
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
              {/* Toute option rattachée hors devis signé doit faire l'objet d'un
                  avenant (§12.6) : elle n'est couverte par aucun document signé.
                  Le bouton n'apparaît que dans ce cas — proposer un avenant vide
                  ferait signer un document sans objet. */}
              {needsAvenant(mission.options) && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-ambre/30 bg-ambre/10 px-4 py-3">
                  <p className="text-sm text-brun-ancre flex-1 min-w-0">
                    Des prestations ont été ajoutées hors du devis signé : elles
                    demandent un avenant.
                  </p>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/imprimer/avenant/${id}?auto=1`} target="_blank" rel="noopener noreferrer">
                      <FileSignature className="w-3.5 h-3.5" aria-hidden="true" />
                      Éditer l&apos;avenant
                    </a>
                  </Button>
                </div>
              )}
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

          {/* Fin de mission (§12.5) : trois états d'accès, tous réversibles, aucune
              suppression. Placé après les phases dans la lecture, mais avant elles
              dans le rendu serait faux — on ne clôt pas ce qu'on n'a pas parcouru. */}
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

          <Card>
            <CardContent className="pt-6">
              <MissionClosureSection
                missionId={mission.id}
                closedAt={mission.closedAt}
                clientAccessRevokedAt={mission.clientAccessRevokedAt}
                canManageClosure={session?.user.role === "CABINET_ADMIN"}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
