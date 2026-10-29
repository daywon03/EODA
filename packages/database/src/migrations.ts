// ─────────────────────────────────────────────────────────────────────────────
// MANIFESTE DES MIGRATIONS
//
// Liste, dans l'ordre, les migrations que le code de cette version attend en base.
// Elle sert à une seule chose : détecter au démarrage qu'une base est à moitié
// déployée (schéma en retard sur le code) et le dire fort, plutôt que de laisser
// un utilisateur le découvrir par une erreur Prisma au milieu d'un dépôt de
// document.
//
// La liste n'est PLUS écrite à la main (29/10/2026) : elle est générée depuis
// prisma/migrations par scripts/generate-migration-manifest.mjs, à chaque
// `pnpm db:generate` (installation, CI, build Vercel). Ajouter une migration = créer
// son dossier, rien d'autre — l'ancienne liste manuelle faisait entrer en conflit
// toutes les PR qui ajoutaient une migration.
//
// Pourquoi pas une lecture du dossier à l'exécution : l'application déployée est un
// artefact Next.js qui ne contient pas prisma/migrations — la liste est figée au
// build. `apps/web/src/lib/db/migration-manifest.test.ts` vérifie toujours qu'elle
// correspond au dossier (un fichier généré oublié en local fait échouer le test).
// ─────────────────────────────────────────────────────────────────────────────

export { EXPECTED_MIGRATIONS } from "./migrations.generated";
