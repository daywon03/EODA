import { prisma, type EstablishmentType, type PracticeAnswerValue } from "@eoda/database";
import { isCriterionApplicable } from "@/lib/services/criterion-applicability-service";
import { isCriterionImperativeForEstablishment } from "@/lib/services/criterion-imperativeness-service";
import { latestAnswersByCriterion, type PracticeAnswerFacts } from "@/lib/services/practice-service";
import { deriveDiagnosticProgress, type DiagnosticProgress } from "@/lib/services/prospect-diagnostic-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE du diagnostic déclaratif des structures inscrites seules (D5, 13/10).
//
// Aucune garde ici : l'appelant a DÉJÀ résolu le(s) prospect(s) sous sa garde
// (requireProspectSession pour l'espace, requireCommercialSession + tenant pour le
// cabinet). Les impératifs viennent de la BASE, jamais d'un nombre écrit (16 SAD
// aide, 17 SAD mixte — context/02 §4).
// ─────────────────────────────────────────────────────────────────────────────

export type ProspectImperative = {
  id: string;
  code: string;
  label: string;
  expectedDocuments: { id: string; label: string }[];
};

// Impératifs par profil, lus une fois pour toute une liste de prospects.
export async function readImperativesByType(): Promise<Record<EstablishmentType, ProspectImperative[]>> {
  const criteria = await prisma.criterion.findMany({
    where: { applicableTo: { in: ["BOTH", "SAD_AIDE", "SAD_MIXTE"] } },
    select: {
      id: true,
      code: true,
      label: true,
      requirementLevel: true,
      applicableTo: true,
      documentTypes: { select: { documentType: { select: { id: true, label: true } } } },
    },
  });
  const forType = (type: EstablishmentType): ProspectImperative[] =>
    criteria
      .filter((c) => isCriterionApplicable(c.applicableTo, type) && isCriterionImperativeForEstablishment(c, type))
      .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }))
      .map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        expectedDocuments: c.documentTypes.map((d) => d.documentType),
      }));
  return { SAD_AIDE: forType("SAD_AIDE"), SAD_MIXTE: forType("SAD_MIXTE") };
}

export type ProspectAnswersSummary = {
  latest: Map<string, PracticeAnswerFacts>;
  lastAnswerAt: Date | null;
};

export async function readProspectAnswers(prospectIds: readonly string[]): Promise<Map<string, ProspectAnswersSummary>> {
  const result = new Map<string, ProspectAnswersSummary>();
  if (prospectIds.length === 0) return result;
  const rows = await prisma.prospectPracticeAnswer.findMany({
    where: { prospectId: { in: [...prospectIds] } },
    select: { prospectId: true, criterionId: true, questionVersion: true, answer: true, text: true, answeredAt: true },
  });
  for (const id of prospectIds) {
    const own = rows.filter((r) => r.prospectId === id);
    result.set(id, {
      latest: latestAnswersByCriterion(own),
      lastAnswerAt: own.reduce<Date | null>((max, r) => (max === null || r.answeredAt > max ? r.answeredAt : max), null),
    });
  }
  return result;
}

// Avancement : les impératifs du profil auxquels une réponse a été donnée. Un
// prospect sans profil (démarché, type de SAD inconnu) n'a pas de diagnostic en ligne.
export function progressFor(
  imperatives: readonly ProspectImperative[] | null,
  latest: ReadonlyMap<string, { answer: PracticeAnswerValue }>
): DiagnosticProgress | null {
  if (!imperatives) return null;
  return deriveDiagnosticProgress(imperatives.filter((c) => latest.has(c.id)).length, imperatives.length);
}
