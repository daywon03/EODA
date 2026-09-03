-- Actions d'audit de la bibliothèque : import d'un dossier, rangement.
--
-- Un import de dossier écrit des dizaines de lignes d'un coup, et un déplacement
-- change la façon dont un gabarit sera retrouvé. Les deux méritent une trace.
-- `detail` porte un NOMBRE de fichiers ou un nom de DOSSIER — jamais un nom de
-- fichier, qui porte souvent le nom d'une structure (CLAUDE.md §5 bis).
--
-- Migration séparée de celle qui crée les tables : PostgreSQL refuse d'utiliser une
-- valeur d'enum dans la transaction qui l'ajoute. Ici rien ne l'utilise, mais séparer
-- reste la convention du dépôt — elle évite d'avoir à se poser la question.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEMPLATE_FOLDER_IMPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEMPLATE_DOCUMENT_MOVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEMPLATE_CATEGORY_DELETED';
