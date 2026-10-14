import type { BeneficiaryDocumentSummary, BeneficiaryTimeline } from "@/lib/hds/beneficiary-data-port";
import { deriveDeadlineAlerts, isActiveOn } from "./beneficiary-deadline-service";

// ─────────────────────────────────────────────────────────────────────────────
// PERSONNES ACCOMPAGNÉES — CHIFFRES AGRÉGÉS, service PUR (décision de Damon,
// 14/10/2026 : minimisation RGPD/HDS).
//
// Le cabinet ne voit pas de liste nominative : il lit des comptes. Ce service ne
// reçoit d'ailleurs AUCUN nom — seulement des identifiants opaques, des dates et les
// identifiants des personnes enquêtées — et ne rend que des nombres. Tout est
// DÉRIVÉ des faits, comme les échéances (beneficiary-deadline-service) dont il
// réutilise le calcul : un compteur qui recalculerait les échéances à sa façon
// finirait par contredire la liste de la structure.
//
// Partition des personnes en cours d'accompagnement :
//   - « à jour » : feuille de réception (ou DIPC) remise, aucune échéance proche ;
//   - « à remettre ou à renouveler » : au moins une échéance dans les 30 jours ou
//     dépassée (DIPC jamais remis, DIPC ou projet personnalisé à revoir).
// ─────────────────────────────────────────────────────────────────────────────

export type BeneficiaryAggregates = {
  activePeople: number;
  receptionUpToDate: number;
  receptionToRenew: number;
  surveyDone: number;
  alerts: { total: number; overdue: number; toDeliver: number; toRenew: number };
};

export function computeBeneficiaryAggregates(input: {
  timelines: readonly BeneficiaryTimeline[];
  documents: readonly BeneficiaryDocumentSummary[];
  surveyedIds: ReadonlySet<string>;
  today: Date;
}): BeneficiaryAggregates {
  const active = input.timelines.filter((person) => isActiveOn(person, input.today));
  const alerts = deriveDeadlineAlerts(active, input.documents, input.today);
  const needingAction = new Set(alerts.map((alert) => alert.beneficiaryId));

  return {
    activePeople: active.length,
    receptionUpToDate: active.filter((person) => !needingAction.has(person.id)).length,
    receptionToRenew: needingAction.size,
    surveyDone: active.filter((person) => input.surveyedIds.has(person.id)).length,
    alerts: {
      total: alerts.length,
      overdue: alerts.filter((alert) => alert.overdue).length,
      toDeliver: alerts.filter((alert) => alert.kind === "DIPC_A_REMETTRE").length,
      toRenew: alerts.filter((alert) => alert.kind === "RENOUVELLEMENT").length,
    },
  };
}
