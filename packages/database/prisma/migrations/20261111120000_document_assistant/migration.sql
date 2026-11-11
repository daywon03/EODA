-- ASSISTANT DE LA FICHE DOCUMENT (lot F, 11/11/2026, construit comme MusicPlanner).
-- Conversations d'un compte du cabinet sur UN document d'UNE structure, messages
-- (propositions en JSON), crédits du jour par compte (40, remis à minuit à Paris).
--
-- Additive : trois tables neuves, une énumération, deux actions de journal ; aucune
-- réécriture. Supprimer un compte, une structure ou une ligne supprime ses
-- conversations (ON DELETE CASCADE). Migration écrite à la main ; application :
-- `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ASSISTANT_QUESTION_ASKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ASSISTANT_CONVERSATION_DELETED';

CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "document_type_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "AssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "proposals_json" JSONB,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_credit_days" (
    "user_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assistant_credit_days_pkey" PRIMARY KEY ("user_id","day")
);

CREATE INDEX "assistant_conversations_user_id_establishment_id_document_type_id_idx" ON "assistant_conversations"("user_id", "establishment_id", "document_type_id");
CREATE INDEX "assistant_conversations_establishment_id_idx" ON "assistant_conversations"("establishment_id");
CREATE INDEX "assistant_conversations_document_type_id_idx" ON "assistant_conversations"("document_type_id");
CREATE INDEX "assistant_messages_conversation_id_created_at_idx" ON "assistant_messages"("conversation_id", "created_at");

ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_credit_days" ADD CONSTRAINT "assistant_credit_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
