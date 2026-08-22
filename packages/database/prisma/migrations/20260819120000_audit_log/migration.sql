-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DOCUMENT_UPLOADED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_PREVIEWED', 'DOCUMENT_STATUS_ANSWERED', 'CLIENT_USER_INVITED', 'ESTABLISHMENT_DELETED', 'LOGIN_FAILED', 'LOGIN_RATE_LIMITED');

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "actor_user_id" TEXT,
    "actor_role" TEXT,
    "establishment_id" TEXT,
    "target_id" TEXT,
    "detail" TEXT,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entries_establishment_id_occurred_at_idx" ON "audit_log_entries"("establishment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_entries_actor_user_id_occurred_at_idx" ON "audit_log_entries"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_entries_action_occurred_at_idx" ON "audit_log_entries"("action", "occurred_at");
