-- Retrait du stade INITIALE (call du 20/09/2026) : « on ne fait que version
-- vierge, qui sera le template en gros, et version finale ». Postgres ne sait pas
-- retirer une valeur d'enum directement — on recrée le type. Vérifié avant
-- d'écrire cette migration : aucune ligne de template_versions ne portait
-- INITIALE (0/6), le CAST ci-dessous ne perd donc aucune donnée réelle.

ALTER TYPE "TemplateStage" RENAME TO "TemplateStage_old";
CREATE TYPE "TemplateStage" AS ENUM ('VIERGE', 'FINALE');

ALTER TABLE "template_versions"
  ALTER COLUMN "stage" TYPE "TemplateStage"
  USING ("stage"::text::"TemplateStage");

DROP TYPE "TemplateStage_old";
