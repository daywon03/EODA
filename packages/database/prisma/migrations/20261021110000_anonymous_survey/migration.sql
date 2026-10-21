-- Enquête de satisfaction ANONYME (décision de Damon, 21/10/2026). Tables séparées des
-- tables usager : aucun lien vers une personne, aucun texte libre, aucun salarié,
-- date au jour. L'enquête nominative (survey_responses) reste derrière le verrou HDS.

CREATE TYPE "AnonymousSurveyChannel" AS ENUM ('TABLETTE', 'LIEN');

CREATE TABLE "anonymous_survey_invites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "template_code" "SurveyTemplateCode" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_survey_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "anonymous_survey_responses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "template_code" "SurveyTemplateCode" NOT NULL,
    "template_version" INTEGER NOT NULL,
    "respondent_kind" "SurveyRespondentKind" NOT NULL,
    "mode" "SurveyMode" NOT NULL,
    "channel" "AnonymousSurveyChannel" NOT NULL,
    "completed_on" DATE NOT NULL,

    CONSTRAINT "anonymous_survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "anonymous_survey_answers" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "choice" "SurveyChoice" NOT NULL,

    CONSTRAINT "anonymous_survey_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "anonymous_survey_invites_token_hash_key" ON "anonymous_survey_invites"("token_hash");
CREATE INDEX "anonymous_survey_invites_tenant_id_idx" ON "anonymous_survey_invites"("tenant_id");
CREATE INDEX "anonymous_survey_invites_establishment_id_created_at_idx" ON "anonymous_survey_invites"("establishment_id", "created_at");
CREATE INDEX "anonymous_survey_invites_created_by_user_id_idx" ON "anonymous_survey_invites"("created_by_user_id");
CREATE INDEX "anonymous_survey_responses_tenant_id_idx" ON "anonymous_survey_responses"("tenant_id");
CREATE INDEX "anonymous_survey_responses_establishment_id_completed_on_idx" ON "anonymous_survey_responses"("establishment_id", "completed_on");
CREATE UNIQUE INDEX "anonymous_survey_answers_response_id_question_id_key" ON "anonymous_survey_answers"("response_id", "question_id");

ALTER TABLE "anonymous_survey_invites" ADD CONSTRAINT "anonymous_survey_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anonymous_survey_invites" ADD CONSTRAINT "anonymous_survey_invites_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anonymous_survey_invites" ADD CONSTRAINT "anonymous_survey_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anonymous_survey_responses" ADD CONSTRAINT "anonymous_survey_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anonymous_survey_responses" ADD CONSTRAINT "anonymous_survey_responses_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "anonymous_survey_answers" ADD CONSTRAINT "anonymous_survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "anonymous_survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Journal : création de liens, envoi d'une enquête anonyme (sans contenu ni personne).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ANONYMOUS_SURVEY_LINKS_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ANONYMOUS_SURVEY_LINK_RATE_LIMITED';
