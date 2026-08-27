-- Les libellés d'offre perdent leurs codes de module.
--
-- Call du 26/08 : « Il faudra enlever un max de détails qui génèrent des objections et
-- des questions. […] Tu enlèves les M, pourquoi pas. Et tu ne laisses que réunion
-- hebdomadaire de suivi, création documentaire. »
--
-- « M3 » désignait trois journées d'atelier en Performance ; en Excellence, ce sont cinq
-- jours. Le même code recouvrait deux choses, et le client le lisait sur son portail
-- (« Modules : M1 · M2 · M3 … »). Supprimer les codes règle la contradiction sans avoir
-- à l'expliquer.
--
-- ⚠️ Les devis existants ne bougent pas : ils portent leurs propres instantanés de
-- libellé et de prix (`formule_label_snapshot`, `formule_price_snapshot_euros`). Un
-- document commercial signé ne se réécrit jamais.
--
-- La clause WHERE compare au texte SEEDÉ : si Sandrine a déjà réécrit une ligne depuis
-- l'écran catalogue, sa version est conservée.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

UPDATE "catalogue_formules"
SET "modules_label" = 'Diagnostic des critères impératifs'
WHERE "formule" = 'ESSENTIEL' AND "modules_label" = 'M1 (critères impératifs)';

UPDATE "catalogue_formules"
SET "modules_label" = 'Diagnostic complet · Analyse documentaire · Ateliers de validation',
    "description" = 'Tout Essentiel + les 141 critères standards (2 jours) + analyse documentaire et mise en conformité (PLAC) + 3 journées d''atelier de validation documentaire — 3 mois'
WHERE "formule" = 'PERFORMANCE' AND "modules_label" = 'M1 complet · M2 · M3';

UPDATE "catalogue_formules"
SET "modules_label" = 'Tout Performance · Suivi hebdomadaire · Création documentaire · Reporting · Ateliers · 2e auto-évaluation',
    "description" = 'Tout Performance + réunions hebdomadaires de suivi du plan d''action + création documentaire (procédures, registres) + reporting Excel ou Power BI + 5 jours d''atelier en présentiel + nouvelle session d''auto-évaluation — 10 mois'
WHERE "formule" = 'EXCELLENCE' AND "modules_label" = 'M1 · M2 · M3 · M4 · M5-M6 · M7 · M8 · M10';
