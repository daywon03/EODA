// ─────────────────────────────────────────────────────────────────────────────
// CONTRÔLE DE CONFIGURATION AU BUILD
//
// Pourquoi ce script existe alors que `src/instrumentation.ts` fait déjà le
// contrôle : sur un hébergement sans serveur (Vercel), il n'y a pas de « démarrage
// du serveur » qu'on puisse refuser. Chaque requête est une fonction éphémère : un
// refus à l'exécution produit des 500 en boucle sur un déploiement déjà en ligne,
// au lieu d'empêcher ce déploiement d'exister.
//
// Ce script déplace donc le jugement au BUILD, là où Vercel injecte déjà les
// variables du projet. Une configuration incomplète fait échouer le déploiement,
// avant qu'aucune URL ne soit publiée.
//
// Il n'y a AUCUNE règle ici : elles vivent toutes dans `production-profile.ts`,
// partagé avec le contrôle de démarrage. Dupliquer la liste des variables requises
// garantirait qu'un jour les deux divergent (D1).
//
// Import relatif volontaire : ce script tourne sous tsx, hors du résolveur d'alias
// de Next.js.
// ─────────────────────────────────────────────────────────────────────────────
import { getEnv } from "../src/lib/config/env";
import { productionConfigProblems, productionConfigWarnings } from "../src/lib/config/production-profile";

function main(): void {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EODA] Configuration invalide — build interrompu.\n${message}`);
    process.exit(1);
  }

  if (!env.isProduction) {
    console.warn(
      "[EODA] NODE_ENV n'est pas « production » : profil de production non vérifié. " +
        "Attendu uniquement en développement local."
    );
    return;
  }

  const problems = productionConfigProblems(env);
  if (problems.length > 0) {
    console.error(
      `[EODA] CONFIGURATION DE PRODUCTION INCOMPLÈTE — build interrompu.\n${problems
        .map((p) => `  - ${p}`)
        .join("\n")}\n\nRenseigner ces variables sur l'environnement de déploiement (cf. README §Déploiement).`
    );
    process.exit(1);
  }

  for (const warning of productionConfigWarnings(env)) {
    console.warn(`[EODA] ${warning}`);
  }

  console.warn("[EODA] Profil de production vérifié : configuration complète.");
}

main();
