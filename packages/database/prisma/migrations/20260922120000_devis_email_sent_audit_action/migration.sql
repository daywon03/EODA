-- Envoi réel du devis par e-mail (22/09/2026, retour du call Sandrine/Assad Benoît :
-- « Préparer l'e-mail n'envoie pas l'e-mail »). sendDevisEmail (lib/actions/devis.ts)
-- remplace le brouillon `mailto:` par un envoi Resend avec pièce jointe PDF.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (destruction de la base désignée en shadow database, incident du
-- 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

-- ALTER TYPE ... ADD VALUE est autorisé dans une transaction depuis PostgreSQL 12
-- tant que la nouvelle valeur n'est pas UTILISÉE dans la même transaction : aucun
-- INSERT sur audit_log_entries plus bas.
ALTER TYPE "AuditAction" ADD VALUE 'DEVIS_EMAIL_SENT';
