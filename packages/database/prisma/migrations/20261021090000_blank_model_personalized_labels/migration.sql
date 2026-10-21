-- Call du 18/10/2026 : « modèle vierge » devient « modèle vierge personnalisé » —
-- le gabarit remis à la structure est celui qu'EODA a adapté pour elle, pas un
-- formulaire générique. Libellés seulement : les codes ne changent pas.
UPDATE "DocumentType"
SET "label" = "label" || ' personnalisé'
WHERE "code" IN (
  'FONCT_PAP_GABARIT',
  'FONCT_FICHE_TACHES_GABARIT',
  'FONCT_GRILLE_EVAL_BESOINS',
  'FONCT_CONSENTEMENT_ENTRETIEN'
)
AND "label" LIKE '% — modèle vierge';
