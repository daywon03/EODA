-- CHARTE COULEUR DE LA STRUCTURE (E1, call du 09/11/2026 — Sandrine : « stocke la
-- charte couleur par client pour que quand il refait un document ça ressorte bien »).
--
-- Deux couleurs facultatives, en hexadécimal « #RRGGBB » (validées et normalisées côté
-- serveur par `parseBrandColors`, apps/web/src/lib/services/brand-color-service.ts),
-- saisies par le cabinet sur la fiche de la structure à côté du logo. Appliquées au
-- document FINAL d'une mise en conformité, jamais à la page de garde EODA.
--
-- Additive : deux colonnes NULL par défaut (NULL = rendu actuel inchangé), aucune
-- réécriture. Migration écrite à la main ; application : `pnpm db:migrate:deploy`
-- uniquement.

ALTER TABLE "establishments" ADD COLUMN "brand_primary_color" TEXT;
ALTER TABLE "establishments" ADD COLUMN "brand_secondary_color" TEXT;
