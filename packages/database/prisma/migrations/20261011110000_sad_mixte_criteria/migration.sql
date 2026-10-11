-- SAD MIXTE — critères du manuel HAS absents des grilles Synaé SAD aide (tranche N4),
-- 11/10/2026.
--
-- Les grilles chargées par `seed-has-referential.ts` sont celles d'un SAD AIDE (137
-- critères). Un SAD MIXTE (aide + soins) relève aussi des critères du champ
-- « Médico-social » du manuel (juillet 2025). Source :
-- `.claude/specs/data/20261008_criteres-manuel-has-niveau-champ.csv`, croisée le
-- 11/10/2026 avec les trois grilles : **15** critères « Médico-social » n'y figurent
-- pas (le bilan annonçait 13 = 150 − 137, mais ce 150 excluait 1.7.2 et 2.5.1, que la
-- grille SAD aide contient bien). Les 5 critères « Établissement » absents restent
-- hors périmètre SAD et ne sont pas ajoutés.
--
-- DONNÉE DE RÉFÉRENTIEL, ajout CIBLÉ et IDEMPOTENT :
--   - `applicable_to = SAD_MIXTE` : un SAD aide ne les voit jamais (filtres de
--     l'auto-évaluation et des critères & preuves, criterion-applicability-service) ;
--   - 3.6.2 est IMPÉRATIF (manuel : impératif pour le seul champ médico-social —
--     context/02 §4 : 16 impératifs SAD aide, 17 SAD mixte) ;
--   - rattachés à l'objectif existant de même code (1.15, 1.16, 2.6, 2.7, 3.6), dans
--     le référentiel `has-referentiel-juillet-2025` : si le référentiel n'est pas
--     chargé (base neuve), rien n'est inséré ;
--   - `ON CONFLICT (code) DO NOTHING` : un critère déjà présent n'est jamais modifié.
--
-- ⚠️ SANS éléments d'évaluation : le CSV du manuel ne les porte pas, et aucune grille
-- Synaé SAD mixte n'a été fournie. Ces critères sont visibles (critères & preuves,
-- chapitres) mais pas encore cotables. Trois intitulés (3.6.1, 3.6.3, 3.6.5) sont
-- tronqués dans le CSV et marqués comme tels : à compléter depuis le manuel PDF.
-- Les autres viennent de l'index du manuel (texte HAS, aucune donnée client).

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-1', o."id", '1.15.1', 'La personne accompagnée est informée des soins qui lui sont proposés, selon des modalités adaptées.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-2', o."id", '1.15.2', 'La personne accompagnée bénéficie de temps d''échange et de soutien autour de son état de santé, des soins possibles et de la stratégie thérapeutique proposée.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-3', o."id", '1.15.3', 'La personne bénéficie d''un accompagnement adapté, en cas de refus de soins.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-4', o."id", '1.15.4', 'La personne accompagnée est associée à la gestion de son traitement médicamenteux pour favoriser sa compréhension et son adhésion et s''assurer de sa continuité.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-7', o."id", '1.15.7', 'Les professionnels tiennent compte du rapport bénéfice/risque pour proposer des modalités d''accompagnement adaptées à la santé de la personne.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-8', o."id", '1.15.8', 'Les professionnels s''appuient sur des activités et des approches non médicamenteuses dans l''accompagnement de la personne.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-15-9', o."id", '1.15.9', 'Les professionnels sont régulièrement sensibilisés et/ou formés aux activités et approches non médicamenteuses.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.15'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-1-16-4', o."id", '1.16.4', 'Les professionnels coconstruisent avec la personne accompagnée, la stratégie de prise en charge de la douleur.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 1 AND o."code" = '1.16'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-2-6-2', o."id", '2.6.2', 'Les professionnels coconstruisent le projet d''accompagnement en santé mentale avec la personne et le réévaluent régulièrement.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 2 AND o."code" = '2.6'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-2-7-1', o."id", '2.7.1', 'Les professionnels recueillent et tracent les volontés de la personne sur son accompagnement de fin de vie et ses directives anticipées, selon des modalités adaptées.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 2 AND o."code" = '2.7'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-2-7-2', o."id", '2.7.2', 'Les professionnels échangent en équipe pour adapter l''accompagnement à la fin de vie de la personne, dans le respect des volontés exprimées.', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 2 AND o."code" = '2.7'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-3-6-1', o."id", '3.6.1', 'L''ESSMS définit sa stratégie de gestion du risque […] (intitulé tronqué — à compléter depuis le manuel HAS)', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 3 AND o."code" = '3.6'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-3-6-2', o."id", '3.6.2', 'Les professionnels respectent la sécurisation du circuit du médicament.', 'IMPERATIF'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 3 AND o."code" = '3.6'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-3-6-3', o."id", '3.6.3', 'Les professionnels accompagnent les personnes dans la […] (intitulé tronqué — à compléter depuis le manuel HAS)', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 3 AND o."code" = '3.6'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "criteria" ("id", "objective_id", "code", "label", "requirement_level", "applicable_to")
SELECT 'crit-sad-mixte-3-6-5', o."id", '3.6.5', 'Les professionnels sont régulièrement sensibilisés et/ou […] (intitulé tronqué — à compléter depuis le manuel HAS)', 'STANDARD'::"RequirementLevel", 'SAD_MIXTE'::"ApplicableTo"
FROM "objectives" o
JOIN "themes" t ON t."id" = o."theme_id"
JOIN "chapters" c ON c."id" = t."chapter_id"
WHERE c."referential_version_id" = 'has-referentiel-juillet-2025' AND c."number" = 3 AND o."code" = '3.6'
ON CONFLICT ("code") DO NOTHING;

