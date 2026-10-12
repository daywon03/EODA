import {
  REQUESTED_FROM_CLIENT_DOCUMENT_CODES,
  SAD_MIXTE_CRITERIA,
  SEED_CLIENT_USER,
  type SadMixteCriterionSeed,
} from "./seed-data";

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAPES DE SEED TESTABLES SANS BASE
//
// Le seed s'exécute contre une base — jamais dans les tests (garde-fou du dépôt :
// la base de développement est partagée). Ce qui y décide de quelque chose est donc
// extrait ici, sous forme d'arguments d'upsert construits par des fonctions pures et
// d'orchestrations qui reçoivent leurs accès en paramètre. Aucun import de Prisma.
// Tests : apps/web/src/lib/db/seed-steps.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

// Données de CRÉATION d'un type de document, avec le drapeau « réclamé à la
// structure ». Seulement à la création : le drapeau est modifiable par CABINET_ADMIN,
// un re-seed ne doit jamais défaire son choix.
export function withRequestedFromClient<T extends { code: string }>(
  create: T
): T & { requestedFromClient: boolean } {
  return { ...create, requestedFromClient: REQUESTED_FROM_CLIENT_DOCUMENT_CODES.includes(create.code) };
}

// Upsert du compte client de test. Le tenant est posé AUSSI en mise à jour : une base
// seedée avant ce correctif a un compte client sans tenant, donc opaque partout.
// Aucune structure n'est créée — une fiche ne naît que d'une signature.
export function seedClientUserUpsertArgs(
  passwordHash: string,
  rotation: { mustChangePassword: boolean; passwordChangedAt: Date }
) {
  return {
    where: { email: SEED_CLIENT_USER.email },
    update: { passwordHash, tenantId: SEED_CLIENT_USER.tenantId, ...rotation },
    create: {
      email: SEED_CLIENT_USER.email,
      name: SEED_CLIENT_USER.name,
      passwordHash,
      role: "CLIENT_USER" as const,
      tenantId: SEED_CLIENT_USER.tenantId,
      ...rotation,
    },
  };
}

// Même sémantique que la migration 20261011110000 (`ON CONFLICT (code) DO NOTHING`) :
// un critère déjà présent n'est jamais modifié.
export function sadMixteCriterionUpsertArgs(criterion: SadMixteCriterionSeed, objectiveId: string) {
  return {
    where: { code: criterion.code },
    update: {},
    create: {
      id: criterion.id,
      objectiveId,
      code: criterion.code,
      label: criterion.label,
      requirementLevel: criterion.requirementLevel,
      applicableTo: "SAD_MIXTE" as const,
    },
  };
}

export type SadMixteSeedPort = {
  // Identifiant de l'objectif `objectiveCode` du chapitre `chapterNumber` du
  // référentiel chargé, ou null s'il n'existe pas.
  findObjectiveId(chapterNumber: number, objectiveCode: string): Promise<string | null>;
  upsertCriterion(args: ReturnType<typeof sadMixteCriterionUpsertArgs>): Promise<unknown>;
};

// Charge les 15 critères SAD mixte APRÈS les grilles (leurs objectifs doivent exister).
// Un objectif absent est signalé et sauté, comme la migration qui n'insère rien sans
// référentiel. Renvoie les codes chargés et les codes sautés.
export async function seedSadMixteCriteria(
  port: SadMixteSeedPort
): Promise<{ seeded: string[]; skipped: string[] }> {
  const seeded: string[] = [];
  const skipped: string[] = [];
  for (const criterion of SAD_MIXTE_CRITERIA) {
    const objectiveId = await port.findObjectiveId(criterion.chapterNumber, criterion.objectiveCode);
    if (objectiveId === null) {
      skipped.push(criterion.code);
      continue;
    }
    await port.upsertCriterion(sadMixteCriterionUpsertArgs(criterion, objectiveId));
    seeded.push(criterion.code);
  }
  return { seeded, skipped };
}
