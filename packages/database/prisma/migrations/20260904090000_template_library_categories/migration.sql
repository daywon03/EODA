-- Bibliothèque de modèles : dossiers créés à la main, et documents de référence.
--
-- Trois demandes du call du 03/09, qui n'en font qu'une : la bibliothèque doit
-- devenir la base de connaissances de l'IA, donc accueillir TOUT le matériau de
-- travail du cabinet — pas seulement ce qui rentre dans quatre catégories figées.
--
--  1. « Il faudrait que tu puisses au moins rajouter toi-même à la main » — la
--     catégorie cesse d'être l'enum `DocumentCategory` (qui classe les pièces
--     ATTENDUES d'une structure au regard de la loi 2002-2, et qui ne s'invente pas)
--     pour devenir une table du cabinet. Sandrine voulait ranger un gabarit dans
--     « Phase 0 — prise de contact », qui est une étape de son mode opératoire et
--     n'existe dans aucun référentiel.
--
--  2. « Le manuel HAS y sera, et lui n'aura pas forcément plusieurs versions » — d'où
--     `TemplateDocumentKind`. Un document qu'EODA ne produit pas n'a ni stade ni
--     numéro de version : les lui imposer découragerait de le déposer.
--
--  3. Le rangement se corrige : `category_id` est modifiable, `position` est décidée
--     à la main. Un import de dossier range au mieux, pas juste à tous les coups.
--
-- REPRISE DES DONNÉES : aucune fiche existante n'est perdue. Les quatre libellés de
-- l'enum deviennent quatre dossiers réels, créés pour CHAQUE tenant (y compris ceux
-- qui n'ont pas encore de modèle : une bibliothèque vide mais rangée s'amorce, une
-- bibliothèque sans aucun dossier oblige à en inventer un avant le premier dépôt).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (destruction de la base désignée en shadow database, incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── Nature d'une fiche ───────────────────────────────────────────────────────
CREATE TYPE "TemplateDocumentKind" AS ENUM ('GABARIT', 'REFERENCE');

-- ── Les dossiers ─────────────────────────────────────────────────────────────
CREATE TABLE "template_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_categories_tenant_id_name_key"
    ON "template_categories"("tenant_id", "name");

-- Lecture unique de cette table : « les dossiers de ce cabinet, dans l'ordre ».
CREATE INDEX "template_categories_tenant_id_position_idx"
    ON "template_categories"("tenant_id", "position");

ALTER TABLE "template_categories"
    ADD CONSTRAINT "template_categories_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Reprise : les quatre catégories documentaires deviennent quatre dossiers ──
-- `gen_random_uuid()` est fourni par PostgreSQL 13+ sans extension. L'identifiant
-- n'est pas un cuid comme ceux que produit l'application : c'est sans conséquence,
-- la colonne est un texte opaque et rien ne dérive de sa forme.
INSERT INTO "template_categories" ("id", "tenant_id", "name", "position", "created_at", "updated_at")
SELECT gen_random_uuid()::text, t."id", c."name", c."position", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (VALUES
    ('Loi 2002-2', 1),
    ('Fonctionnement de la structure', 2),
    ('Qualité et gestion des risques', 3),
    ('Ressources humaines', 4)
) AS c("name", "position");

-- ── La fiche pointe vers son dossier ─────────────────────────────────────────
ALTER TABLE "template_documents" ADD COLUMN "category_id" TEXT;
ALTER TABLE "template_documents"
    ADD COLUMN "kind" "TemplateDocumentKind" NOT NULL DEFAULT 'GABARIT';

UPDATE "template_documents" d
SET "category_id" = c."id"
FROM "template_categories" c
WHERE c."tenant_id" = d."tenant_id"
  AND c."name" = CASE d."category"
        WHEN 'LOI_2002_2' THEN 'Loi 2002-2'
        WHEN 'FONCTIONNEMENT' THEN 'Fonctionnement de la structure'
        WHEN 'QUALITE_RISQUES' THEN 'Qualité et gestion des risques'
        WHEN 'RH' THEN 'Ressources humaines'
      END;

-- Le NOT NULL n'est posé qu'APRÈS la reprise : posé avant, il ferait échouer la
-- migration sur toute base contenant déjà des fiches.
ALTER TABLE "template_documents" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "template_documents" DROP COLUMN "category";

ALTER TABLE "template_documents"
    ADD CONSTRAINT "template_documents_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "template_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Clé étrangère indexée (convention P6) : « les fiches de ce dossier » est la lecture
-- principale de l'écran de bibliothèque.
CREATE INDEX "template_documents_category_id_idx" ON "template_documents"("category_id");

-- ── Un document de référence n'a ni stade ni numéro de version ───────────────
-- L'obligation devient métier (elle dépend du parent) et vit dans l'action serveur,
-- avec ses tests : la base ne sait pas exprimer « obligatoire si le parent est un
-- gabarit ».
ALTER TABLE "template_versions" ALTER COLUMN "version_label" DROP NOT NULL;
ALTER TABLE "template_versions" ALTER COLUMN "stage" DROP NOT NULL;
