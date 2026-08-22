-- Nature du montant porté par une option de mission.
--
-- Jusqu'ici, une ligne mission_options ne pouvait naître que d'un devis SIGNÉ
-- (convertDevisToClient), donc son montant était toujours ferme. Le cabinet peut
-- désormais rattacher une option directement au périmètre d'une mission, sans
-- devis : le montant est alors recopié du catalogue, où il s'agit d'un « à partir
-- de ». Le portail client rend les deux différemment — sans ce drapeau, un prix
-- indicatif s'afficherait comme un engagement contractuel.
--
-- DEFAULT true : toutes les lignes existantes viennent d'un devis signé. Rien à
-- recalculer, et aucune écriture de masse sur la table.
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (ils détruisent et rejouent la base désignée en shadow database — incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

ALTER TABLE "mission_options" ADD COLUMN "price_is_firm" BOOLEAN NOT NULL DEFAULT true;

-- Modification du périmètre d'une mission à la main (formule ou options), hors
-- signature. Traçable au même titre que les autres opérations commerciales : elle
-- ouvre ou ferme ce que le client voit sur son portail.
-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PostgreSQL 12 tant
-- que la nouvelle valeur n'est pas UTILISÉE dans la même transaction : aucun INSERT sur
-- audit_log_entries ici.
ALTER TYPE "AuditAction" ADD VALUE 'MISSION_SCOPE_UPDATED';
