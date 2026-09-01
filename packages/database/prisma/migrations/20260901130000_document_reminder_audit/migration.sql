-- Action d'audit : relance des pièces manquantes.
--
-- Une relance part vers des personnes réelles. Pouvoir dire quand la dernière a été
-- envoyée est ce qui évite d'en envoyer trois en une semaine — et c'est la seule
-- protection tant que la cadence n'est pas spécifiée (§12.7).
--
-- `detail` porte des NOMBRES (pièces, destinataires), jamais des adresses : le
-- journal d'audit ne contient aucune donnée personnelle (CLAUDE.md §5 bis).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_REMINDER_SENT';
