// ─────────────────────────────────────────────────────────────────────────────
// Retire des intitulés de `DocumentType` les suffixes « (Obj. 3.13) »,
// « (Objectif 3.14) », « - Objectif 3.13 », « (3.13) » (retour du 09/11/2026, #4).
//
//   pnpm --filter @eoda/database labels:strip-objectives            → ESSAI À BLANC
//   pnpm --filter @eoda/database labels:strip-objectives -- --apply → écrit
//
// ⚠ La base est PARTAGÉE avec la production (CLAUDE.md §4) : l'essai à blanc est le
// défaut, il n'écrit rien et affiche « ancien → nouveau » pour chaque ligne. Seul
// Damon lance `--apply`, après avoir lu l'essai.
//
// Règles (pures, testées) : `src/objective-labels.ts` — loi 2002-2 jamais renommée,
// doublon d'intitulé refusé, idempotent. Chaque renommage écrit est journalisé
// `DOCUMENT_TYPE_RENAMED` avec le même texte que `renameDocumentType`, dans la même
// transaction que la mise à jour : un intitulé ne change jamais sans sa trace.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "../src/index";
import { objectiveRenameAuditDetail, planObjectiveLabelRenames } from "../src/objective-labels";

const SCRIPT_ACTOR = "SCRIPT strip-objective-labels";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const types = await prisma.documentType.findMany({
    select: { id: true, code: true, label: true, category: true },
    orderBy: { code: "asc" },
  });
  const plan = planObjectiveLabelRenames(types);

  process.stdout.write(`${apply ? "APPLICATION" : "ESSAI À BLANC (rien n'est écrit — relancer avec --apply)"}\n`);
  for (const rename of plan.renames) {
    process.stdout.write(`  ${rename.code} : « ${rename.from} » → « ${rename.to} »\n`);
  }
  for (const refused of plan.refused) {
    process.stdout.write(`  REFUSÉ ${refused.code} : « ${refused.from} » → « ${refused.to} » — ${refused.reason}\n`);
  }
  process.stdout.write(`${plan.renames.length} à renommer, ${plan.refused.length} refusé(s), ${types.length} lignes lues.\n`);
  if (!apply || plan.renames.length === 0) return;

  let written = 0;
  for (const rename of plan.renames) {
    written += await prisma.$transaction(async (tx) => {
      // Garde optimiste : si l'intitulé a changé depuis la lecture, rien n'est écrit.
      const updated = await tx.documentType.updateMany({
        where: { id: rename.id, label: rename.from },
        data: { label: rename.to },
      });
      if (updated.count === 0) return 0;
      await tx.auditLogEntry.create({
        data: {
          action: "DOCUMENT_TYPE_RENAMED",
          actorUserId: null,
          actorRole: SCRIPT_ACTOR,
          targetId: rename.id,
          detail: objectiveRenameAuditDetail(rename).slice(0, 300),
        },
      });
      return 1;
    });
  }
  process.stdout.write(`${written} intitulé(s) renommé(s) et journalisé(s) sur ${plan.renames.length}.\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Échec : ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
