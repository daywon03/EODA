import { defineComputeConfig } from "@prisma/compute-sdk/config";

// ─────────────────────────────────────────────────────────────────────────────
// DÉPLOIEMENT — Prisma Compute (`prisma app deploy`)
//
// ⚠️ Pourquoi `build.command` est renseigné ici, et pourquoi il contient une
// migration.
//
// Le SDK sait appliquer les migrations d'une application (`applyMigrations`), mais
// il localise le schéma en descendant DEPUIS le dossier de l'application
// (`detectAppSchema(appPath)` — voir node_modules/@prisma/compute-sdk/src/detect-schema.ts).
// Ici `root` vaut `apps/web` alors que le schéma vit dans
// `packages/database/prisma/schema.prisma` : la détection ne le trouve pas, et
// AUCUNE migration n'était appliquée au déploiement. La base ne montait de version
// que si quelqu'un pensait à lancer la commande à la main — ce que personne n'avait
// écrit nulle part.
//
// Le contrat de configuration (`ComputeAppConfig`) n'expose ni hook `prebuild`,
// ni hook `release` : les seuls champs sont name / region / root / framework /
// entry / httpPort / env / build. `build.command` est donc le SEUL point
// d'accroche disponible, et il s'exécute avec les variables d'environnement de la
// branche déployée. On y enchaîne donc explicitement migration puis build.
//
// Conséquence assumée : un déploiement dont la migration échoue échoue au build,
// avant qu'aucun trafic ne soit routé. C'est le comportement voulu — mieux vaut un
// déploiement rouge qu'une base à moitié migrée découverte par un utilisateur.
//
// `migrate deploy` UNIQUEMENT. Jamais `migrate dev`, jamais `migrate diff`, jamais
// `--shadow-database-url` : ces commandes détruisent et rejouent la base désignée
// (incident du 19/08/2026 sur la base de développement partagée, cf. CLAUDE.md §7).
//
// Séquence manuelle équivalente, si ce hook devait être retiré : README.md
// §« Déploiement en production ».
// ─────────────────────────────────────────────────────────────────────────────

export default defineComputeConfig({
  app: {
    name: "eoda-platform",
    framework: "nextjs",
    httpPort: 3000,
    root: "apps/web",
    build: {
      command:
        "pnpm --filter @eoda/database generate && pnpm --filter @eoda/database migrate:deploy && pnpm --filter @eoda/web build",
    },
  },
});
