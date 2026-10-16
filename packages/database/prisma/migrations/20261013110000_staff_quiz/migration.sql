-- Équipe de la structure et quiz de sensibilisation — lot B, tranche N10, 13/10/2026.
--
-- ADDITIVE uniquement : six valeurs d'audit, quatre tables neuves et leurs index
-- (chaque clé étrangère indexée, convention P6). Aucune donnée réécrite. Les
-- questions des quiz ne sont PAS en base (contenu versionné apps/web/src/content/quiz)
-- ; le statut « à jour / à refaire / pas fait » se dérive des tentatives. Le jeton
-- d'invitation n'est jamais stocké, seulement son empreinte (token_hash).
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MEMBER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MEMBER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_MEMBERS_IMPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'QUIZ_CAMPAIGN_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'QUIZ_ATTEMPT_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'QUIZ_SIGNOFF_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'QUIZ_LINK_RATE_LIMITED';

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "user_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_campaigns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "module_code" TEXT NOT NULL,
    "module_version" INTEGER NOT NULL,
    "sent_by_user_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_invitations" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "staff_member_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "staff_member_id" TEXT NOT NULL,
    "invitation_id" TEXT,
    "module_code" TEXT NOT NULL,
    "module_version" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers_json" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_members_tenant_id_idx" ON "staff_members"("tenant_id");

-- CreateIndex
CREATE INDEX "staff_members_establishment_id_active_idx" ON "staff_members"("establishment_id", "active");

-- CreateIndex
CREATE INDEX "staff_members_user_id_idx" ON "staff_members"("user_id");

-- CreateIndex
CREATE INDEX "quiz_campaigns_tenant_id_idx" ON "quiz_campaigns"("tenant_id");

-- CreateIndex
CREATE INDEX "quiz_campaigns_establishment_id_sent_at_idx" ON "quiz_campaigns"("establishment_id", "sent_at");

-- CreateIndex
CREATE INDEX "quiz_campaigns_sent_by_user_id_idx" ON "quiz_campaigns"("sent_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_invitations_token_hash_key" ON "quiz_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "quiz_invitations_campaign_id_idx" ON "quiz_invitations"("campaign_id");

-- CreateIndex
CREATE INDEX "quiz_invitations_staff_member_id_idx" ON "quiz_invitations"("staff_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_invitation_id_key" ON "quiz_attempts"("invitation_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_tenant_id_idx" ON "quiz_attempts"("tenant_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_establishment_id_completed_at_idx" ON "quiz_attempts"("establishment_id", "completed_at");

-- CreateIndex
CREATE INDEX "quiz_attempts_staff_member_id_module_code_completed_at_idx" ON "quiz_attempts"("staff_member_id", "module_code", "completed_at");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_campaigns" ADD CONSTRAINT "quiz_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_campaigns" ADD CONSTRAINT "quiz_campaigns_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_campaigns" ADD CONSTRAINT "quiz_campaigns_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_invitations" ADD CONSTRAINT "quiz_invitations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "quiz_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_invitations" ADD CONSTRAINT "quiz_invitations_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "quiz_invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

