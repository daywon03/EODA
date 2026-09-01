-- Agenda : les rendez-vous du cabinet, et les points que le client doit voir venir.
--
-- Demande du 26/08 : caler un planning prévisionnel, permettre au cabinet de connaître
-- tous ses rendez-vous avec ses différents clients, et au client de savoir quand sont
-- ses prochains points, en visio comme en présentiel.
--
-- Une seule table pour l'avant-vente (R0/R1/R2, rattachés à un prospect) et pour
-- l'accompagnement (rattachés à un établissement). Deux tables obligeraient l'agenda à
-- fusionner deux sources pour répondre à « qu'est-ce que j'ai cette semaine ? », et la
-- signature à recopier des rendez-vous d'une table à l'autre.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

CREATE TYPE "AppointmentKind" AS ENUM (
    'R0_PRISE_CONTACT', 'R1_DECOUVERTE', 'R2_ACCORD',
    'REUNION_CADRAGE', 'VISITE', 'ATELIER', 'REUNION_SUIVI', 'RESTITUTION', 'AUTRE'
);
CREATE TYPE "AppointmentMode" AS ENUM ('VISIO', 'PRESENTIEL', 'TELEPHONE');

-- Le planning est prévisionnel par défaut : « je fais des propositions qu'il valide à
-- chaque fois ». Un créneau proposé n'est pas un créneau tenu.
CREATE TYPE "AppointmentStatus" AS ENUM ('PROPOSE', 'CONFIRME', 'ANNULE');

CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prospect_id" TEXT,
    "establishment_id" TEXT,
    "kind" "AppointmentKind" NOT NULL,
    "mode" "AppointmentMode" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROPOSE',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "location" TEXT,
    -- Notes de préparation du cabinet, jamais transmises au portail client.
    "notes" TEXT,
    "visible_to_client" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- Un rendez-vous appartient à un prospect OU à un établissement, jamais aux deux et
-- jamais à personne. Porté par la BASE et pas seulement par l'action : un rendez-vous
-- orphelin n'apparaîtrait dans aucun agenda tout en occupant un créneau.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_one_owner"
    CHECK (num_nonnulls("prospect_id", "establishment_id") = 1);

-- Une fin avant le début n'est pas une saisie limite, c'est une erreur.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ends_after_starts"
    CHECK ("ends_at" > "starts_at");

-- Lecture par défaut : tout le tenant sur une plage de dates.
CREATE INDEX "appointments_tenant_id_starts_at_idx" ON "appointments"("tenant_id", "starts_at");
-- Les prochains rendez-vous d'un client, côté portail.
CREATE INDEX "appointments_establishment_id_starts_at_idx" ON "appointments"("establishment_id", "starts_at");
CREATE INDEX "appointments_prospect_id_starts_at_idx" ON "appointments"("prospect_id", "starts_at");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cascade des deux côtés : un rendez-vous n'existe que par la structure qu'il concerne.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_prospect_id_fkey"
    FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
