-- Conversion prospect → client : la charnière manuelle du parcours §12.4 est fermée.
--
-- Contexte. `context/07-outil-pilotage-missions.md` §12.4 désigne « prospection →
-- devis → contrat → création de la fiche client avec sélection de l'offre et des
-- options → génération du profil client externe » comme LE parcours à verrouiller en
-- priorité. Il était verrouillé partout sauf à sa charnière : `Prospect.establishment_id`
-- se renseignait À LA MAIN après signature, et la Mission — qui porte le périmètre
-- réellement ouvert au client — se créait séparément depuis la fiche établissement.
-- Deux gestes humains, donc deux occasions de produire un client sans profil, ou un
-- profil qui ne correspond pas à ce qui a été signé.
--
-- Deux ajouts ici, et rien d'autre :
--
--   1. `mission_options` — les options souscrites, portées par la MISSION. Le devis
--      reste le document commercial (il fait contrat, ses snapshots ne se réécrivent
--      jamais) ; la mission est ce qui gouverne le périmètre ouvert. CLAUDE.md §7 :
--      la décision contractuelle vit sur Mission, jamais sur
--      Establishment.commercial_tier. Jusqu'ici le périmètre d'options n'était lisible
--      qu'en remontant Establishment → Prospect → Devis, chemin qui casse dès qu'un
--      établissement n'a pas de prospect rattaché (limite connue du §12.6).
--
--   2. `missions.source_devis_id` — quel devis a produit cette mission. Trace, pas
--      source de vérité : le périmètre reste porté par `formule` + `gratuit`.
--
-- IDEMPOTENCE. Rejouer une signature ne doit rien dupliquer. Trois contraintes déjà
-- en base, plus une créée ici, s'en chargent — le code s'appuie dessus, il ne les
-- réimplémente pas :
--   · `prospects_establishment_id_key`  → un établissement ne peut être rattaché qu'à
--     un seul prospect : une seconde conversion ne peut pas en fabriquer un second ;
--   · `missions_establishment_id_key`   → une seule mission par établissement ;
--   · `mission_options_mission_id_catalogue_option_id_key` (ci-dessous) → une ligne
--     d'option au plus par couple (mission, option) ;
--   · la table de transitions du devis (SIGNE n'est pas atteignable depuis SIGNE)
--     refuse la double signature avant même d'ouvrir la transaction.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (ils détruisent et rejouent la base désignée en shadow database — incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ── Traçabilité ──────────────────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PostgreSQL 12 tant
-- que la valeur ajoutée n'est pas UTILISÉE dans la même transaction : aucun INSERT sur
-- audit_log_entries ici.
ALTER TYPE "AuditAction" ADD VALUE 'PROSPECT_CONVERTED';

-- ── Devis à l'origine de la mission ──────────────────────────────────────────
-- Nullable, sans valeur par défaut : les missions créées à la main avant cette
-- migration n'ont pas de devis d'origine, et leur en inventer un serait un mensonge.
-- ON DELETE RESTRICT : un devis signé qui a produit une mission ne se supprime pas
-- (il ne se supprimait déjà pas — seul un BROUILLON est supprimable).
ALTER TABLE "missions" ADD COLUMN "source_devis_id" TEXT;

ALTER TABLE "missions"
    ADD CONSTRAINT "missions_source_devis_id_fkey"
    FOREIGN KEY ("source_devis_id") REFERENCES "devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "missions_source_devis_id_idx" ON "missions"("source_devis_id");

-- ── Options souscrites, portées par la mission ───────────────────────────────
CREATE TABLE "mission_options" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "catalogue_option_id" TEXT NOT NULL,
    "label_snapshot" TEXT NOT NULL,
    "price_snapshot_euros" INTEGER NOT NULL,
    "pricing_unit_snapshot" "PricingUnit" NOT NULL DEFAULT 'FORFAIT',
    "price_max_snapshot_euros" INTEGER,
    "min_quantity_snapshot" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_options_pkey" PRIMARY KEY ("id")
);

-- La contrainte qui rend la conversion idempotente côté options.
CREATE UNIQUE INDEX "mission_options_mission_id_catalogue_option_id_key"
    ON "mission_options"("mission_id", "catalogue_option_id");

ALTER TABLE "mission_options"
    ADD CONSTRAINT "mission_options_mission_id_fkey"
    FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mission_options"
    ADD CONSTRAINT "mission_options_catalogue_option_id_fkey"
    FOREIGN KEY ("catalogue_option_id") REFERENCES "catalogue_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pas de reprise de données. Les missions existantes n'ont pas d'options : leurs
-- options souscrites restent lisibles sur les snapshots du devis, et
-- `client-contract-service.resolveSubscribedOptions()` retombe explicitement dessus
-- quand la mission n'en porte aucune. Écrire une reprise reviendrait à deviner quel
-- devis fait contrat pour un prospect qui en a plusieurs signés — c'est précisément
-- ce que l'état AMBIGUOUS refuse de faire.
