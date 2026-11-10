// ─────────────────────────────────────────────────────────────────────────────
// Efface le contenu DÉRIVÉ (texte extrait, analyse, brouillon, essais, suggestions,
// images, propositions) des versions de documents à accès restreint — le tampon de la
// structure analysé avant la restriction (ADR 20261110, relecture du 10/11/2026).
//
//   pnpm --filter @eoda/database documents:purge-restricted-content            → ESSAI À BLANC
//   pnpm --filter @eoda/database documents:purge-restricted-content -- --apply → écrit
//
// ⚠ La base est PARTAGÉE avec la production (CLAUDE.md §4) : l'essai à blanc est le
// défaut, il n'écrit rien et affiche ce qui serait effacé (des nombres, jamais un
// contenu). Seul Damon lance `--apply`, après avoir lu l'essai.
//
// Logique (testée) : `src/restricted-content-purge.ts`. Le fichier déposé n'est pas
// touché ; les images extraites quittent la base, pas le stockage.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "../src/index";
import { purgeRestrictedDocumentContent } from "../src/restricted-content-purge";
import { RESTRICTED_DOCUMENT_TYPE_CODES } from "../src/restricted-document-types";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  process.stdout.write(`${apply ? "APPLICATION" : "ESSAI À BLANC (rien n'est écrit — relancer avec --apply)"}\n`);
  process.stdout.write(`Types restreints : ${RESTRICTED_DOCUMENT_TYPE_CODES.join(", ")}\n`);

  const report = await purgeRestrictedDocumentContent(prisma, { codes: RESTRICTED_DOCUMENT_TYPE_CODES, apply });
  const { counts } = report;
  process.stdout.write(
    [
      `  versions concernées      : ${counts.versions}`,
      `  textes extraits          : ${counts.extractedTexts}`,
      `  analyses                 : ${counts.analyses}`,
      `  brouillons corrigés      : ${counts.correctedDrafts}`,
      `  essais du laboratoire    : ${counts.analysisTrials}`,
      `  suggestions de critères  : ${counts.criterionSuggestions}`,
      `  images extraites (base)  : ${counts.versionImages}`,
      `  propositions de mise en conformité : ${counts.correctionProposals}`,
      "",
    ].join("\n")
  );
  process.stdout.write(report.applied ? "Effacé et journalisé (une ligne par version).\n" : "Rien n'a été écrit.\n");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Échec : ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
