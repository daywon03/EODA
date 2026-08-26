-- Le dossier du prospect : qui on a en face, et ce qui s'est dit.
--
-- Tout est additif — aucune colonne supprimée, aucune valeur réécrite. Les prospects
-- existants restent valides : civilité, fonction et précisions sont nullables, parce
-- qu'on ne connaît pas ces informations pour les fiches déjà saisies et qu'aucune
-- valeur par défaut ne serait vraie (poser « MONSIEUR » ou « DIRECTION » pour tout le
-- monde ferait entrer une donnée inventée dans un courrier client).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (ils détruisent et rejouent la base désignée en shadow database — incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── 1. Identité du contact ───────────────────────────────────────────────────
-- La civilité était jusqu'ici écrite à la main dans `contact_name` (« Madame Dupont »),
-- ce qui rend le nom inexploitable : ni tri, ni adressage, ni pré-remplissage de devis
-- sans le redécouper.
CREATE TYPE "Civility" AS ENUM ('MONSIEUR', 'MADAME', 'MADEMOISELLE');

-- Fonction dans la structure. Liste courte à compléter au fil des rôles rencontrés ;
-- `AUTRE` + précision libre évite une migration de schéma par cas nouveau.
CREATE TYPE "ContactRole" AS ENUM ('DIRECTION', 'COORDINATION', 'ASSISTANAT', 'AUTRE');

ALTER TABLE "prospects" ADD COLUMN "civility" "Civility";
ALTER TABLE "prospects" ADD COLUMN "contact_role" "ContactRole";
ALTER TABLE "prospects" ADD COLUMN "contact_role_other" TEXT;

-- ── 2. Canal d'acquisition « Autre » ─────────────────────────────────────────
-- Sans précision, `AUTRE` enregistre qu'on ne sait pas : l'analyse d'acquisition perd
-- exactement les cas nouveaux qu'il faudrait repérer.
ALTER TABLE "prospects" ADD COLUMN "channel_other" TEXT;

-- ── 3. Historique du prospect ────────────────────────────────────────────────
-- Le dossier reconstitué jusqu'ici dans une boîte mail. Commentaires et changements de
-- statut sur la même frise : les séparer obligerait à lire deux écrans pour répondre à
-- « où en est-on, et pourquoi ? ». Append-only côté application — aucune action ne
-- modifie ni ne supprime une entrée.
CREATE TYPE "ProspectTimelineKind" AS ENUM ('COMMENTAIRE', 'CHANGEMENT_STATUT');

CREATE TABLE "prospect_timeline_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "kind" "ProspectTimelineKind" NOT NULL,
    "author_user_id" TEXT,
    "body" TEXT,
    "status_from" "ProspectStatus",
    "status_to" "ProspectStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- Lecture par défaut : la frise d'un prospect, du plus récent au plus ancien.
CREATE INDEX "prospect_timeline_entries_prospect_id_created_at_idx"
    ON "prospect_timeline_entries"("prospect_id", "created_at");

ALTER TABLE "prospect_timeline_entries"
    ADD CONSTRAINT "prospect_timeline_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cascade : l'historique n'existe que par son prospect.
ALTER TABLE "prospect_timeline_entries"
    ADD CONSTRAINT "prospect_timeline_entries_prospect_id_fkey"
    FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull : désactiver ou supprimer un compte ne doit pas emporter l'historique
-- commercial (même principe que la piste d'audit).
ALTER TABLE "prospect_timeline_entries"
    ADD CONSTRAINT "prospect_timeline_entries_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
