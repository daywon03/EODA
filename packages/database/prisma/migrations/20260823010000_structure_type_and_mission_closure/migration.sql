-- Un seul entonnoir commercial, et un état de fiche qui ne ment pas.
--
-- Trois changements, tous additifs ou purement nominaux — aucune donnée détruite,
-- aucune valeur recalculée.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (ils détruisent et rejouent la base désignée en shadow database — incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── 1. ProspectType → StructureType ──────────────────────────────────────────
-- Le type sert désormais aussi à Establishment : le nommer d'après le seul Prospect
-- serait trompeur sur une fiche client. Renommage du TYPE uniquement — la colonne
-- prospects.structure_type et ses valeurs sont inchangées.
--
-- À ne pas confondre avec EstablishmentType (SAD_AIDE / SAD_MIXTE) : deux axes
-- indépendants, jamais fusionnés (CLAUDE.md §7).
ALTER TYPE "ProspectType" RENAME TO "StructureType";

-- ── 2. Statut juridique sur la fiche client ──────────────────────────────────
-- NULLABLE sans valeur par défaut, délibérément. Les fiches existantes n'ont pas
-- cette information et aucune valeur ne serait vraie pour toutes : poser
-- « ASSOCIATION » par défaut ferait entrer une donnée inventée dans un livrable
-- remis au client. Un NULL visible appelle une correction, un défaut faux ne se
-- remarque jamais.
ALTER TABLE "establishments" ADD COLUMN "structure_type" "StructureType";

-- ── 3. Clôture de mission ────────────────────────────────────────────────────
-- Le seul fait du cycle de vie qui ne se dérive pas des données existantes. Les
-- étapes SIGNE et EN_COURS se calculent (items de diagnostic cochés, dates de phase
-- posées) ; « terminé » est une décision. Une checklist à 100 % ne clôt pas une
-- mission : la structure reste accompagnée jusqu'à la visite des évaluateurs HAS.
ALTER TABLE "missions" ADD COLUMN "closed_at" TIMESTAMP(3);
