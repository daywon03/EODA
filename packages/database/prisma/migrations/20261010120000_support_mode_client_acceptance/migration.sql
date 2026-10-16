-- Portail client v2 — tranches N1 (mode seul / accompagné), N2 (acceptation client)
-- et N3 (« Je ne l'ai pas »), 10/10/2026.
--
-- ADDITIVE uniquement : un type, deux valeurs d'audit, trois colonnes (une avec défaut,
-- deux nullables), un index de clé étrangère (convention P6), et une mise à jour
-- CIBLÉE de données de configuration. Aucune suppression, aucun renommage.
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sur la base sont
-- interdits sur ce dépôt. Application : `pnpm db:migrate:deploy` uniquement.

-- N1 — Mode d'accompagnement de la mission. Défaut ACCOMPAGNE : toutes les missions
-- existantes gardent la règle stricte (aucune analyse non relue n'atteint le client).
CREATE TYPE "SupportMode" AS ENUM ('AUTONOMIE', 'ACCOMPAGNE');

ALTER TABLE "missions" ADD COLUMN "support_mode" "SupportMode" NOT NULL DEFAULT 'ACCOMPAGNE';

-- N2 — Acceptation par la structure (D6), fait distinct de `validated_at`.
ALTER TABLE "documents" ADD COLUMN "client_accepted_at" TIMESTAMP(3),
ADD COLUMN "client_accepted_by_user_id" TEXT;

CREATE INDEX "documents_client_accepted_by_user_id_idx" ON "documents"("client_accepted_by_user_id");

ALTER TABLE "documents" ADD CONSTRAINT "documents_client_accepted_by_user_id_fkey"
  FOREIGN KEY ("client_accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Traces d'audit des deux nouveaux gestes.
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_ACCEPTED_BY_CLIENT';
ALTER TYPE "AuditAction" ADD VALUE 'MISSION_SUPPORT_MODE_CHANGED';

-- N3 — Les SEPT documents de la loi 2002-2 sont réclamés à la structure, pas cinq.
-- Décision du 15/09/2026 (bilan specs/05-bilan-2026-10.md, « 7 documents loi 2002-2
-- réclamés par défaut ») : la migration 20260827140000 en réclamait cinq et laissait
-- de côté les comptes rendus de CVS et la liste des personnes qualifiées.
-- Idempotente (une seconde exécution ne change rien) et ciblée par CODE, jamais par
-- libellé. Le drapeau reste modifiable ensuite par CABINET_ADMIN.
UPDATE "document_types"
SET "requested_from_client" = true
WHERE "code" IN ('L2002_CR_CVS', 'L2002_PERSONNES_QUALIFIEES')
  AND "requested_from_client" = false;
