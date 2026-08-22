-- Correction / annulation d'un devis (audit CRUD du 20/08/2026).
--
-- Constat : un devis émis était définitivement figé. Un montant saisi de travers
-- restait en base, et son numéro restait consommé dans la série annuelle
-- DEVIS-AAAA-NNN. Trois manques fermés ici :
--   1. la modification d'un BROUILLON (l'action existait, sans route ni appelant) ;
--   2. la suppression d'un BROUILLON (suppression réelle : rien de commercial
--      n'a eu lieu, aucun numéro n'a circulé) ;
--   3. l'annulation d'un devis ENVOYE ou SIGNE — la ligne et son numéro sont
--      CONSERVÉS, seul le statut passe à ANNULE. Une série commerciale numérotée
--      ne doit pas comporter de trou.
--
-- Choix ANNULE (valeur d'enum) plutôt qu'une colonne `annulled_at` : le statut est
-- le seul champ sur lequel l'application branche déjà (badge, table de transitions,
-- filtres KPI). Un horodatage parallèle serait une seconde source de vérité que
-- chaque filtre `status = 'SIGNE'` existant ignorerait en silence — un devis annulé
-- continuerait d'alimenter le « CA signé ». Une valeur d'enum, elle, casse la
-- compilation de tous les `Record<DevisStatus, …>` tant que le cas n'est pas traité.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (destruction de la base désignée en shadow database, incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── Nouveau statut de devis ──────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PostgreSQL 12
-- tant que la valeur ajoutée n'est pas UTILISÉE dans la même transaction : aucune
-- écriture sur `devis` ni sur `audit_log_entries` plus bas, la contrainte est tenue.
ALTER TYPE "DevisStatus" ADD VALUE 'ANNULE';

-- ── Traçabilité des opérations destructrices du module commercial ────────────
ALTER TYPE "AuditAction" ADD VALUE 'DEVIS_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVIS_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'CATALOGUE_ITEM_RETIRED';
ALTER TYPE "AuditAction" ADD VALUE 'CATALOGUE_ITEM_RESTORED';
