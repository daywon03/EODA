-- SAD MIXTE — intitulés complets de 3.6.1, 3.6.3 et 3.6.5, 14/10/2026.
--
-- La migration 20261011110000_sad_mixte_criteria a inséré ces trois critères avec un
-- intitulé tronqué (« […] (intitulé tronqué — à compléter depuis le manuel HAS) »),
-- faute de texte complet dans le CSV source. Décision de Damon (14/10/2026) : les
-- compléter depuis le manuel HAS complet (« Manuel d'évaluation de la qualité des
-- ESSMS », juillet 2025, objectif 3.6 « L'ESSMS définit et déploie sa stratégie de
-- gestion du risque médicamenteux »). Les 12 autres intitulés SAD mixte ont été
-- relus contre le manuel le même jour : identiques, rien à corriger.
--
-- Une migration commitée ne se modifie jamais (elle a pu être appliquée par un build
-- Vercel sur la base partagée) : la correction est donc une NOUVELLE migration.
--
-- DONNÉE DE RÉFÉRENTIEL, mise à jour CIBLÉE et IDEMPOTENTE :
--   - ciblée par code, et seulement sur les critères SAD_MIXTE ;
--   - `label <> …` : rejouée, elle ne touche plus rien ;
--   - base neuve (référentiel absent) : aucune ligne visée, rien ne se passe — le
--     seed (`SAD_MIXTE_CRITERIA`) porte déjà les intitulés complets.

UPDATE "criteria"
SET "label" = 'L''ESSMS définit sa stratégie de gestion du risque médicamenteux et s''assure de sa mise en œuvre.'
WHERE "code" = '3.6.1' AND "applicable_to" = 'SAD_MIXTE'::"ApplicableTo"
  AND "label" <> 'L''ESSMS définit sa stratégie de gestion du risque médicamenteux et s''assure de sa mise en œuvre.';

UPDATE "criteria"
SET "label" = 'Les professionnels accompagnent les personnes dans la continuité de leur prise en charge médicamenteuse.'
WHERE "code" = '3.6.3' AND "applicable_to" = 'SAD_MIXTE'::"ApplicableTo"
  AND "label" <> 'Les professionnels accompagnent les personnes dans la continuité de leur prise en charge médicamenteuse.';

UPDATE "criteria"
SET "label" = 'Les professionnels sont régulièrement sensibilisés et/ou formés à la prévention et à la gestion du risque médicamenteux.'
WHERE "code" = '3.6.5' AND "applicable_to" = 'SAD_MIXTE'::"ApplicableTo"
  AND "label" <> 'Les professionnels sont régulièrement sensibilisés et/ou formés à la prévention et à la gestion du risque médicamenteux.';
