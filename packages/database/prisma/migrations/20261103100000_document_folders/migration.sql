-- DOSSIERS DE LA LISTE « DOCUMENTS » — call du 29/10/2026 avec Sandrine.
--
-- Une table de dossiers, globale comme `document_types`, et un rattachement FACULTATIF
-- de chaque ligne à un dossier. Additive : aucune suppression, aucune colonne renommée.
-- `ON DELETE SET NULL` : supprimer un dossier remet ses lignes à plat, jamais ne les
-- efface.
--
-- Données de configuration, IDEMPOTENTES (mêmes règles que les migrations de types) :
--   - sept dossiers, identifiants stables `docfolder-…`, `ON CONFLICT ("id") DO NOTHING` ;
--   - lignes du référentiel rangées d'office, SEULEMENT si elles n'ont pas déjà de
--     dossier (`folder_id IS NULL`) — un rangement fait par le cabinet n'est jamais
--     défait.
-- Même liste que `DOCUMENT_FOLDER_SEEDS` (`packages/database/src/document-folders.ts`),
-- concordance tenue par `apps/web/src/lib/db/seed-data.test.ts`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_FOLDER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_FOLDER_RENAMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_FOLDER_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPES_IMPORTED';

CREATE TABLE "document_folders" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "document_types" ADD COLUMN "folder_id" TEXT;

CREATE INDEX "document_types_folder_id_idx" ON "document_types"("folder_id");

ALTER TABLE "document_types" ADD CONSTRAINT "document_types_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "document_folders" ("id", "label", "position", "updated_at")
VALUES
  ('docfolder-sensibilisation-pro', 'Sensibilisation des professionnels', 1, CURRENT_TIMESTAMP),
  ('docfolder-sensibilisation-pa', 'Sensibilisation des personnes accompagnées', 2, CURRENT_TIMESTAMP),
  ('docfolder-strategie', 'Stratégie', 3, CURRENT_TIMESTAMP),
  ('docfolder-pilotage-qualite', 'Pilotage qualité', 4, CURRENT_TIMESTAMP),
  ('docfolder-notes-service', 'Notes de service', 5, CURRENT_TIMESTAMP),
  ('docfolder-process-has', 'Process HAS', 6, CURRENT_TIMESTAMP),
  ('docfolder-process-structure', 'Process de la structure', 7, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "document_types" SET "folder_id" = 'docfolder-sensibilisation-pro'
  WHERE "folder_id" IS NULL AND "code" IN ('QUALITE_FICHE_SENSIBILISATION');
UPDATE "document_types" SET "folder_id" = 'docfolder-sensibilisation-pa'
  WHERE "folder_id" IS NULL AND "code" IN ('PA_FICHE_P1_PLAINTES', 'PA_FICHE_P2_EVENEMENTS_INDESIRABLES', 'PA_FICHE_P3_MALTRAITANCE', 'PA_FICHE_P4_GESTION_CRISE', 'PA_FICHE_P5_DONNEES');
UPDATE "document_types" SET "folder_id" = 'docfolder-pilotage-qualite'
  WHERE "folder_id" IS NULL AND "code" IN ('QUALITE_POLITIQUE_INDEX', 'QUALITE_GABARIT_CR_REUNION');
UPDATE "document_types" SET "folder_id" = 'docfolder-notes-service'
  WHERE "folder_id" IS NULL AND "code" IN ('FONCT_NOTE_SERVICE');
UPDATE "document_types" SET "folder_id" = 'docfolder-process-has'
  WHERE "folder_id" IS NULL AND "code" IN ('P12_PROCEDURE', 'P13_PROCEDURE', 'P11_PROCEDURE', 'P22_PROCEDURE_RGPD', 'QUALITE_PROCEDURE_EI_PLAINTES');
