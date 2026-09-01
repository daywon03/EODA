-- Actions d'audit du retour d'avenant signé.
--
-- Enregistrer ou retirer la signature d'un avenant verrouille ou déverrouille le
-- retrait d'une prestation du périmètre d'un client : c'est un geste qui change ce
-- que le client garde ou perd, il laisse donc une trace datée et nominative côté
-- acteur (CLAUDE.md §5 bis).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AVENANT_SIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AVENANT_SIGNATURE_CLEARED';
