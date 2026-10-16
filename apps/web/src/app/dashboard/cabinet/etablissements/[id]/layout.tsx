import type { ReactNode } from "react";
import Link from "next/link";
import { requireCabinetSession } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEstablishmentReviewSummary } from "@/lib/actions/review-queue";
import { toMissionLifecycleFacts } from "@/lib/db/to-mission-lifecycle-facts";
import { deriveFunnelStage, isBetaMission } from "@/lib/services/lifecycle-service";
import { ESTABLISHMENT_TYPE_LABELS } from "@/lib/services/structure-identity-service";
import { derivePrimaryAction, describeEvaluationCountdown } from "@/lib/services/structure-sheet-service";
import { structureHref, visibleStructureTabs } from "@/lib/design/structure-tabs";
import { formuleLabel } from "@/components/mission/formule-labels";
import { StageBadge } from "@/components/crm/StageBadge";
import { Button } from "@/components/ui/button";
import { StructureHeaderFrame } from "@/components/structure/StructureHeaderFrame";
import { StructureTabsNav } from "@/components/structure/StructureTabsNav";
import { MoreActionsMenu, type MoreActionLink } from "@/components/structure/MoreActionsMenu";
import { DeleteEstablishmentButton } from "@/components/etablissement/DeleteEstablishmentButton";

type Props = { children: ReactNode; params: Promise<{ id: string }> };

const CHIP_CLASS = "whitespace-nowrap rounded-md border border-line bg-card px-2.5 py-0.5 text-ink";

// ─────────────────────────────────────────────────────────────────────────────
// FICHE STRUCTURE — gabarit commun aux onglets (maquette « Portail Cabinet v2 »).
//
// L'en-tête et les onglets vivent ici ; chaque onglet est une route enfant qui
// RE-VÉRIFIE elle-même l'appartenance de la fiche au tenant (le gabarit et la page
// se rendent en parallèle : une garde posée ici seulement ne protégerait pas les
// lectures de la page). Contrôle mécanique : structure-pages-guard.test.ts.
// ─────────────────────────────────────────────────────────────────────────────
export default async function StructureLayout({ children, params }: Props) {
  const { id } = await params;
  const [{ role }, establishment, review] = await Promise.all([
    requireCabinetSession("STRUCTURES_READ"),
    getEstablishment(id),
    getEstablishmentReviewSummary(id),
  ]);
  const now = new Date();

  const lifecycle = toMissionLifecycleFacts(establishment.mission);
  const stage = deriveFunnelStage({ prospectStatus: establishment.prospect?.status ?? null, mission: lifecycle });
  const countdown = describeEvaluationCountdown(establishment.hasEvaluationTargetDate, now);
  const primary = derivePrimaryAction(review);
  const formule = establishment.mission ? formuleLabel(establishment.mission.formule) : null;

  // Les gestes de l'ancienne fiche, regroupés — aucun n'a disparu : modifier,
  // comptes et logo (Réglages), contrat, rapport, et la suppression (admin).
  // Ce que le rôle permet (capabilities.ts) : masquer ici n'est qu'un confort, les
  // routes et les actions visées refusent d'elles-mêmes.
  const canWrite = hasCabinetCapability(role, "STRUCTURES_WRITE");
  const canSeeContract = hasCabinetCapability(role, "STRUCTURE_CONTRACT");
  const links: MoreActionLink[] = [
    ...(canWrite
      ? [
          { id: "modifier", label: "Modifier la fiche", href: structureHref(id, "modifier") },
          { id: "reglages", label: "Comptes clients et logo", href: structureHref(id, "reglages") },
        ]
      : []),
    ...(establishment.mission && canSeeContract
      ? [{ id: "contrat", label: "Éditer le contrat", href: `/imprimer/contrat/${id}?auto=1`, newTab: true }]
      : []),
    { id: "rapport", label: "Éditer le rapport de conformité", href: `/imprimer/rapport/${id}?auto=1`, newTab: true },
  ];

  const actions = (
    <>
      {primary && (
        <Button asChild>
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
      )}
      <MoreActionsMenu
        links={links}
        footer={
          hasCabinetCapability(role, "CABINET_SETTINGS") ? (
            <DeleteEstablishmentButton establishmentId={id} establishmentName={establishment.name} />
          ) : undefined
        }
      />
    </>
  );

  return (
    <div className="space-y-6">
      <StructureHeaderFrame
        name={establishment.name}
        chips={
          <>
            <span className={CHIP_CLASS}>{ESTABLISHMENT_TYPE_LABELS[establishment.type]}</span>
            {formule && <span className={CHIP_CLASS}>Formule {formule}</span>}
            <StageBadge stage={stage} beta={isBetaMission(lifecycle)} />
            {countdown && <span className={`${CHIP_CLASS} border-ink font-bold tabular-nums`}>{countdown}</span>}
          </>
        }
        compactLine={countdown ? <span className="tabular-nums">{countdown}</span> : null}
        actions={actions}
        tabs={<StructureTabsNav establishmentId={id} visibleTabIds={visibleStructureTabs(role).map((t) => t.id)} />}
      />
      {!canWrite && (
        <p role="status" className="rounded-lg border border-line bg-card px-4 py-3 text-ink">
          Lecture seule : vous consultez cette structure sans pouvoir la modifier.
        </p>
      )}
      {children}
    </div>
  );
}
