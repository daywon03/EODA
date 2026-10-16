-- Rôles d'accès dans l'espace d'une structure — tranche N9 (client), 13/10/2026.
--
-- ADDITIVE uniquement : un type neuf, trois valeurs d'audit, trois colonnes avec
-- défaut ou nullables sur establishment_users. Les liens EXISTANTS prennent le rôle
-- DIRECTION (défaut de colonne) : ils gardent exactement ce qu'ils voyaient. Leur
-- `created_at` vaudra l'heure de la migration — la date réelle de rattachement n'a
-- jamais été stockée, rien ne permet de la reconstituer.
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- CreateEnum
CREATE TYPE "ClientAccessRole" AS ENUM ('DIRECTION', 'RESPONSABLE_QUALITE', 'ADMINISTRATIF', 'INTERVENANT');

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_ACCESS_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_ACCESS_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_ACCESS_REVOKED';

-- AlterTable
ALTER TABLE "establishment_users" ADD COLUMN     "access_role" "ClientAccessRole" NOT NULL DEFAULT 'DIRECTION',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "revoked_at" TIMESTAMP(3);

