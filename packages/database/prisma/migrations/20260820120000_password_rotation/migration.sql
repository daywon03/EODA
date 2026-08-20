-- Rotation du mot de passe temporaire (Jalon 5 — durcissement avant mise en usage réel).
--
-- Contexte : `inviteClientUser` génère un mot de passe temporaire de 16 caractères,
-- l'affiche une fois, et rien n'obligeait ensuite le client à en changer. Un compte
-- remis en septembre gardait indéfiniment un mot de passe transmis de vive voix ou
-- par messagerie. Ces deux colonnes rendent la rotation obligatoire et traçable.
--
-- Migration écrite à la main : `prisma migrate dev` est interdit sur ce dépôt (il
-- détruit et rejoue la base désignée en shadow database — incident du 19/08/2026).
-- Application en production : `pnpm db:migrate:deploy` uniquement.

-- ── Nouvelles valeurs du journal d'audit ─────────────────────────────────────
-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PostgreSQL 12
-- tant que la nouvelle valeur n'est pas UTILISÉE dans la même transaction — ce qui
-- est le cas ici (aucun INSERT sur audit_log_entries plus bas).
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_CHANGE_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_CHANGE_RATE_LIMITED';

-- ── Colonnes de rotation ─────────────────────────────────────────────────────
-- DEFAULT true = fail-closed : tout compte créé sans décision explicite doit tourner
-- son mot de passe avant d'accéder à quoi que ce soit.
ALTER TABLE "users"
    ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "password_changed_at" TIMESTAMP(3);

-- ── Backfill des lignes existantes ───────────────────────────────────────────
-- Faute de mieux, la date de création fait office de dernière date de mot de passe
-- connue : c'est bien à ce moment-là que l'empreinte actuelle a été posée.
UPDATE "users" SET "password_changed_at" = "created_at";

-- Les comptes Cabinet existants (Sandrine, évaluateurs) ont choisi leur mot de passe
-- eux-mêmes : on ne leur impose pas une rotation rétroactive.
UPDATE "users" SET "must_change_password" = false WHERE "role" <> 'CLIENT_USER';

-- Les comptes CLIENT_USER existants portent tous un mot de passe temporaire généré
-- par la plateforme et affiché une seule fois : ils DOIVENT en changer. C'est
-- exactement le trou que cette migration ferme, le backfill ne peut pas l'exempter.
UPDATE "users" SET "must_change_password" = true WHERE "role" = 'CLIENT_USER';
