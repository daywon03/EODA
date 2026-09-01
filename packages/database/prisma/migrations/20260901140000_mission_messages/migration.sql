-- Fil d'échange mission ↔ client (CDC §5 « messagerie / échanges »).
--
-- Un fil par établissement, APPEND-ONLY : ni modification, ni suppression, même règle
-- et même raison que `prospect_timeline_entries` — un échange réécrivable ne prouve
-- rien le jour où il faut expliquer ce qui avait été demandé, et quand.
--
-- `author_side` est FIGÉ à l'écriture plutôt que déduit du rôle de l'auteur à la
-- lecture : un compte peut changer de rôle, et le fil doit continuer de dire qui
-- parlait au nom de qui ce jour-là.
--
-- Cascade sur l'établissement : la rétention porte sur les documents et le journal
-- d'audit, pas sur une conversation.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

CREATE TYPE "MessageAuthorSide" AS ENUM ('CABINET', 'CLIENT');

CREATE TABLE "mission_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "author_side" "MessageAuthorSide" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mission_messages_establishment_id_created_at_idx"
    ON "mission_messages"("establishment_id", "created_at");

ALTER TABLE "mission_messages"
    ADD CONSTRAINT "mission_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mission_messages"
    ADD CONSTRAINT "mission_messages_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mission_messages"
    ADD CONSTRAINT "mission_messages_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
