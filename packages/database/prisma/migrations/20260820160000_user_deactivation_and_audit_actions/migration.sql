-- Révocation d'un accès client, suppression d'une version de document, et lecture du
-- journal d'audit (audit CRUD du 20/08/2026 — écarts réglementaires, pas de confort).
--
-- Trois trous fermés ici :
--   1. Un compte utilisateur ne pouvait pas être désactivé : le départ d'un salarié de
--      la structure cliente exigeait un UPDATE SQL manuel. D'où `is_active`.
--   2. `deleteEstablishment` supprimait les liens establishment_users mais laissait les
--      lignes `users` : des comptes orphelins pouvaient toujours s'authentifier.
--   3. Onze types d'événements étaient écrits, aucun n'était lisible ; et aucun n'existait
--      pour la révocation, la réinitialisation de mot de passe ou la suppression d'une
--      version de document.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (ils détruisent et rejouent la base désignée en shadow database — incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── Nouvelles valeurs du journal d'audit ─────────────────────────────────────
-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PostgreSQL 12 tant
-- que la nouvelle valeur n'est pas UTILISÉE dans la même transaction : aucun INSERT sur
-- audit_log_entries plus bas.
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_USER_UNLINKED';
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_USER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DELETED_WITH_ESTABLISHMENT';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_RESET_BY_ADMIN';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_REFUSED_INACTIVE';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_VERSION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_JUSTIFICATION_UPDATED';

-- ── Désactivation d'un compte ────────────────────────────────────────────────
-- DEFAULT true : les comptes existants restent actifs (aucune coupure d'accès du fait
-- de cette migration). Le fail-closed est porté par le code — un compte est refusé dès
-- que la colonne passe à false, à la connexion ET à chaque contrôle d'autorisation.
ALTER TABLE "users"
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "deactivated_at" TIMESTAMP(3);

-- ── Lecture du journal ───────────────────────────────────────────────────────
-- Les trois index existants sont composites et commencent par une colonne de filtre.
-- La consultation par défaut (tout le tenant, du plus récent au plus ancien, paginée)
-- n'en utilise aucun : sans cet index, chaque page est un tri complet de la table.
CREATE INDEX "audit_log_entries_occurred_at_idx" ON "audit_log_entries"("occurred_at");
