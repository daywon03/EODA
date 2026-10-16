-- Libre-service, tranche 11 (13/10/2026, décisions de Damon) : confirmation de
-- l'adresse e-mail avant d'ouvrir un compte créé en ligne, et bascule du compte en
-- client à la signature du devis.
--
-- ADDITIVE uniquement : une colonne NULLABLE (users.email_verified_at), une table
-- neuve (email_verification_tokens, clé étrangère indexée — convention P6), cinq
-- valeurs d'audit. Aucune donnée réécrite : les comptes existants gardent
-- email_verified_at à NULL, et la règle ne l'exige que des comptes créés en
-- libre-service (ceux qui ont une ligne prospect_accounts) — un compte créé par le
-- cabinet n'est pas concerné.
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFICATION_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFICATION_RATE_LIMITED';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_REFUSED_UNVERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'PROSPECT_ACCOUNT_PROMOTED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
