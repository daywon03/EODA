import { prisma, type AuditAction } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL D'AUDIT — écriture des accès aux données sensibles
//
// Objectif RGPD/santé-social : pouvoir répondre à « qui a déposé ou consulté quel
// document, et quand » (cf. specs/03-roadmap-developpement.md Jalon 5).
//
// Deux règles de conception :
//
//  1. Jamais bloquant. Un échec d'écriture du journal ne doit pas faire échouer
//     l'action métier (un document consultable mais non journalisé vaut mieux
//     qu'un document inaccessible). L'échec est journalisé en console pour être
//     visible dans les logs d'infrastructure.
//
//  2. Jamais de donnée personnelle dans `detail`. On y met un libellé de type de
//     document ou un motif technique, jamais un nom de personne accompagnée, un
//     extrait de document ou une adresse. Le journal d'audit ne doit pas devenir
//     lui-même un gisement de données à protéger.
//
// Pas de port/adapter ici (contrairement au stockage ou au LLM) : la persistance
// se fait dans notre propre base, il n'y a pas de fournisseur externe à pouvoir
// remplacer — l'abstraction serait de la cérémonie sans bénéfice.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditEvent = {
  action: AuditAction;
  actorUserId?: string | null;
  actorRole?: string | null;
  establishmentId?: string | null;
  targetId?: string | null;
  detail?: string | null;
};

const MAX_DETAIL_LENGTH = 300;

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLogEntry.create({
      data: {
        action: event.action,
        actorUserId: event.actorUserId ?? null,
        actorRole: event.actorRole ?? null,
        establishmentId: event.establishmentId ?? null,
        targetId: event.targetId ?? null,
        detail: event.detail ? event.detail.slice(0, MAX_DETAIL_LENGTH) : null,
      },
    });
  } catch (error) {
    console.error("Écriture du journal d'audit échouée (action métier poursuivie) :", error);
  }
}
