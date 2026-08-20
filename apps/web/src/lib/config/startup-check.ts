import { EXPECTED_MIGRATIONS } from "@eoda/database";
import { getEnv, isBuildPhase, isProductionRuntime, type AppEnv } from "./env";
import { productionConfigProblems, productionConfigWarnings } from "./production-profile";
import {
  describeMigrationStatus,
  diffMigrations,
  isSchemaUpToDate,
} from "@/lib/db/migration-status";
import { readMigrationRows } from "@/lib/db/read-migration-rows";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRÔLES DE DÉMARRAGE — appelés une fois par `src/instrumentation.ts`
//
// Ce que ce module remplace : trois refus PARESSEUX et dispersés
// (`lib/storage/index.ts`, `lib/llm/index.ts`, `lib/email/index.ts`), chacun
// déclenché au premier appel réel du service concerné. Conséquence mesurée : un
// déploiement sans `S3_*` démarrait vert, servait les pages, et n'échouait qu'au
// moment où un client déposait son premier document. Les trois refus restent en
// place (défense en profondeur, et ils protègent aussi les chemins de test), mais
// ils ne sont plus le premier filet : la configuration est jugée AU DÉMARRAGE.
// ─────────────────────────────────────────────────────────────────────────────

const BANNER = "[EODA] CONFIGURATION DE PRODUCTION INCOMPLÈTE — démarrage refusé";

function formatProblems(problems: string[]): string {
  return `${BANNER}\n${problems.map((p) => `  - ${p}`).join("\n")}\n\nVoir .env.example et README.md §Déploiement.`;
}

// Sortie en code 1, et non exception : vérifié sur l'artefact standalone, une
// exception levée depuis register() laisse Next.js annoncer « Ready » puis échouer
// en unhandledRejection — c'est-à-dire un processus à moitié vivant, exactement
// l'état qu'on cherche à éviter. Sortir fait voir à l'orchestrateur un démarrage
// échoué, donc aucun trafic routé vers l'instance.
function refuseToStartInProduction(problems: string[]): never {
  console.error(formatProblems(problems));
  process.exit(1);
}

function resolveEnv(): AppEnv {
  try {
    return getEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${BANNER}\n${message}`);
    // Vérifié en conditions réelles sur l'artefact standalone : une exception levée
    // depuis register() n'empêche PAS Next.js d'annoncer « Ready » — elle ressort en
    // unhandledRejection et laisse un processus à moitié vivant. La seule façon de
    // refuser réellement de servir est de sortir. `isProductionRuntime()` ne
    // déclenche aucune validation, il lit juste NODE_ENV.
    if (isProductionRuntime()) process.exit(1);
    throw error;
  }
}

// Non bloquant, volontairement. Une base injoignable une fraction de seconde au
// démarrage ne doit pas empêcher l'instance de se lever (elle se soignera), et une
// base « en avance » (retour arrière applicatif) est un état légitime. Ce qu'on veut
// est qu'un schéma en retard ne soit JAMAIS découvert par un utilisateur : une seule
// ligne d'erreur, complète, dans les journaux d'infrastructure.
async function reportSchemaState(): Promise<void> {
  try {
    const status = diffMigrations(EXPECTED_MIGRATIONS, await readMigrationRows());
    if (isSchemaUpToDate(status)) return;
    console.error(
      `[EODA] SCHÉMA DE BASE DE DONNÉES DÉSYNCHRONISÉ — ${describeMigrationStatus(status)}. ` +
        "Appliquer les migrations avec `pnpm db:migrate:deploy` (jamais `migrate dev`, cf. CLAUDE.md §7)."
    );
  } catch (error) {
    console.error(
      "[EODA] Impossible de vérifier l'état des migrations au démarrage (base injoignable ?) :",
      error
    );
  }
}

export async function runStartupChecks(): Promise<void> {
  // `next build` s'exécute avec NODE_ENV=production sur une machine de CI qui n'a
  // légitimement aucun secret : valider le profil de production y ferait échouer le
  // build, pas le déploiement.
  if (isBuildPhase()) return;

  const env = resolveEnv();

  if (env.isProduction) {
    const problems = productionConfigProblems(env);
    if (problems.length > 0) refuseToStartInProduction(problems);

    for (const warning of productionConfigWarnings(env)) {
      console.warn(`[EODA] ${warning}`);
    }
  }

  await reportSchemaState();
}
