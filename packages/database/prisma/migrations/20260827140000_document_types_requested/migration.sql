-- Cinq documents réclamés au client, pas vingt-neuf.
--
-- Call du 26/08 : « Il faut enlever pas mal de documents […] les documents qui doivent
-- déjà exister au sein d'une SAD qui a déjà réfléchi à sa démarche qualité, c'est cinq
-- documents qui sont réclamés au moment de l'évaluation. Et tous les restes […] c'est
-- justement la liste de tout ce que je suis en train de créer comme document. Ce n'est
-- pas à eux de me les envoyer, c'est à moi de les créer pour eux. »
--
-- Les 29 types restent en base et restent visibles CÔTÉ CABINET : ils sont le plan de
-- production de l'accompagnement. Seul le portail client cesse de les réclamer.
--
-- ⚠️ Les cinq codes ci-dessous sont une PROPOSITION, à confirmer par Sandrine : ce sont
-- les documents remis à l'usager au titre de la loi 2002-2 (art. L311-4), soit la
-- catégorie loi 2002-2 moins les comptes rendus de CVS. Elle consulte ses deux experts
-- sur la liste exacte. Le drapeau est modifiable depuis l'application (CABINET_ADMIN) :
-- corriger la liste ne demandera pas de migration.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.
ALTER TABLE "document_types" ADD COLUMN "requested_from_client" BOOLEAN NOT NULL DEFAULT false;

UPDATE "document_types"
SET "requested_from_client" = true
WHERE "code" IN (
    'L2002_PROJET_SERVICE',
    'L2002_CHARTE_DROITS',
    'L2002_LIVRET_ACCUEIL',
    'L2002_DIPC',
    'L2002_REGLEMENT_FONCTIONNEMENT'
);

-- Trace du changement de politique documentaire (réclamé / produit).
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_TYPE_SCOPE_CHANGED';
