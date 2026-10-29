-- Audit de sécurité du 28/10/2026 : le mot de passe temporaire ne voyage plus par
-- e-mail. Un lien à usage unique (empreinte seule en base, 72 h) le remplace.
CREATE TABLE "password_setup_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_setup_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_setup_tokens_token_hash_key" ON "password_setup_tokens"("token_hash");
CREATE INDEX "password_setup_tokens_user_id_idx" ON "password_setup_tokens"("user_id");

ALTER TABLE "password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_SETUP_LINK_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_SET_FROM_LINK';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_SETUP_RATE_LIMITED';
