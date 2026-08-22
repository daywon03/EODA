-- Demande de devis d'option depuis le portail client — « Mon accompagnement ».
--
-- Contexte : le portail client montre désormais au client son propre contrat
-- (offre souscrite, options souscrites, montants signés) ET les options qu'il n'a
-- PAS souscrites avec leur prix « à partir de » — c'est la base du paywall
-- (context/07-outil-pilotage-missions.md §12.6). Exception au cloisonnement
-- commercial écrite dans .claude/CLAUDE.md §7 le 20/08/2026.
--
-- La règle §12.3 tient : le client DEMANDE, Sandrine déclenche. Cette table porte
-- la demande et rien d'autre — aucun paiement, aucun déblocage automatique. Le
-- déblocage réel passe par un devis puis un avenant (§12.6).
--
-- Pourquoi une table plutôt qu'un simple événement d'audit : une demande a un
-- cycle de vie (à traiter → traitée / refusée) et doit être listable et
-- corrigeable côté Cabinet. Le journal d'audit est en écriture seule et ne se
-- corrige pas. Les deux sont écrits ; ils ne se remplacent pas.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (destruction de la base désignée en shadow database, incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── Nouveau type ─────────────────────────────────────────────────────────────
-- CREATE TYPE, pas ALTER TYPE ADD VALUE : le type est créé dans cette transaction,
-- ses valeurs y sont donc utilisables immédiatement (la restriction PostgreSQL ne
-- porte que sur les valeurs ajoutées à un enum préexistant).
CREATE TYPE "OptionRequestStatus" AS ENUM ('DEMANDEE', 'TRAITEE', 'REFUSEE');

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE "client_option_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "catalogue_option_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "OptionRequestStatus" NOT NULL DEFAULT 'DEMANDEE',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "client_option_requests_pkey" PRIMARY KEY ("id")
);

-- File d'attente du Cabinet : les demandes d'un tenant par statut, du plus ancien
-- au plus récent.
CREATE INDEX "client_option_requests_tenant_id_status_created_at_idx"
    ON "client_option_requests"("tenant_id", "status", "created_at");

-- Détection d'un doublon pour un couple (établissement, option).
CREATE INDEX "client_option_requests_establishment_id_catalogue_option_i_idx"
    ON "client_option_requests"("establishment_id", "catalogue_option_id", "status");

-- Une seule demande EN ATTENTE à la fois par couple (établissement, option) — un
-- clic répété ne doit pas produire dix lignes dans la file de Sandrine. Index
-- PARTIEL : après une demande TRAITEE ou REFUSEE, le client peut redemander.
-- Prisma ne sait pas exprimer un index partiel dans le schéma ; la garantie est
-- donc portée par la base (elle, elle tient sous concurrence) et le contrôle
-- applicatif ne sert qu'à produire un message lisible plutôt qu'une erreur.
CREATE UNIQUE INDEX "client_option_requests_pending_unique"
    ON "client_option_requests"("establishment_id", "catalogue_option_id")
    WHERE "status" = 'DEMANDEE';

ALTER TABLE "client_option_requests"
    ADD CONSTRAINT "client_option_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_option_requests"
    ADD CONSTRAINT "client_option_requests_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_option_requests"
    ADD CONSTRAINT "client_option_requests_catalogue_option_id_fkey"
    FOREIGN KEY ("catalogue_option_id") REFERENCES "catalogue_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_option_requests"
    ADD CONSTRAINT "client_option_requests_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Traçabilité ──────────────────────────────────────────────────────────────
ALTER TYPE "AuditAction" ADD VALUE 'OPTION_QUOTE_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'OPTION_REQUEST_HANDLED';
