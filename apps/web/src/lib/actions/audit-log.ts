"use server";

import { prisma, AuditAction, type Prisma } from "@eoda/database";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { isEnumValue } from "@/lib/validation/form-parsers";
import { AUDIT_PAGE_SIZE } from "@/lib/services/pagination-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DU JOURNAL D'AUDIT
//
// Le journal était écrit par onze chemins et lisible par aucun : `auditLogEntry`
// n'apparaissait qu'une fois dans le dépôt, dans un `create`. Une traçabilité que
// personne ne peut consulter ne satisfait pas l'exigence du secteur médico-social
// (CLAUDE.md §5 bis) — elle la simule.
//
// Trois règles portées ici :
//
//  1. CLOISONNEMENT FAIL-CLOSED. La table n'a pas de colonne tenant : le périmètre
//     est reconstruit à chaque requête à partir des établissements du tenant et des
//     comptes qui s'y rattachent. Une entrée qui porte un acteur ou un établissement
//     hors de ce périmètre n'est jamais rendue. Les entrées SANS acteur ni
//     établissement (échec de connexion sur un email inconnu) sont incluses : par
//     construction elles ne contiennent aucune donnée rattachable à qui que ce soit,
//     et les exclure ferait disparaître le signal d'attaque par force brute, qui est
//     la première raison de consulter un journal.
//
//  2. PAGINATION OBLIGATOIRE. La table croît sans borne — chaque échec de connexion
//     est une ligne. Une page qui charge « tout » fonctionne un mois puis meurt.
//
//  3. AUCUN IDENTIFIANT PERSONNEL BRUT AJOUTÉ. On rend l'acteur par son nom et son
//     rôle, résolus en base ; `detail` est rendu tel quel (il ne contient jamais de
//     donnée personnelle, c'est la règle d'écriture) ; `targetId` reste une clé
//     technique.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditLogRow = {
  id: string;
  occurredAt: Date;
  action: AuditAction;
  actorLabel: string;
  actorRole: string | null;
  establishmentName: string | null;
  targetId: string | null;
  detail: string | null;
};

export type AuditLogFilterOption = { value: string; label: string };

export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageCount: number;
  establishmentOptions: AuditLogFilterOption[];
  actorOptions: AuditLogFilterOption[];
};

export type AuditLogQuery = {
  establishmentId?: string | undefined;
  actorUserId?: string | undefined;
  action?: string | undefined;
  page?: number | undefined;
};

const ACTOR_UNKNOWN = "Compte supprimé";
const ACTOR_ANONYMOUS = "Non authentifié";

export async function listAuditLog(query: AuditLogQuery): Promise<AuditLogPage> {
  const { tenantId } = await requireCabinetSession();

  const establishments = await prisma.establishment.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const establishmentIds = establishments.map((e) => e.id);

  // Comptes du périmètre : les comptes du cabinet (tenantId) ET les comptes clients
  // rattachés à l'un de ses établissements. `tenantId` est garanti non-null par la
  // garde — pas de filtre conditionnel, qui rendrait la requête globale.
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { tenantId },
        { establishmentUsers: { some: { establishmentId: { in: establishmentIds } } } },
      ],
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  const userIds = users.map((u) => u.id);

  // L'appartenance se juge d'abord sur l'établissement, et sur l'acteur seulement
  // quand l'entrée n'en porte aucun. Le disjoint « acteur connu » non conditionné
  // rendait visible une entrée portant l'établissement d'un AUTRE tenant dès lors
  // que son acteur appartenait au mien. Inatteignable aujourd'hui — `inviteClientUser`
  // refuse un email déjà pris, donc aucun compte n'est rattaché à deux tenants —
  // mais le multi-cabinet prévu en §5 l'activerait, et une fuite de journal se
  // découvre après coup.
  const scope: Prisma.AuditLogEntryWhereInput = {
    OR: [
      { establishmentId: { in: establishmentIds } },
      { establishmentId: null, actorUserId: { in: userIds } },
      { establishmentId: null, actorUserId: null },
    ],
  };

  const filters: Prisma.AuditLogEntryWhereInput[] = [scope];

  // Un `establishmentId` reçu de la requête est une entrée non fiable : il repasse
  // par la garde, qui déclenche notFound() s'il appartient à un autre tenant.
  if (query.establishmentId) {
    const { establishmentId } = await requireEstablishmentInTenant(query.establishmentId);
    filters.push({ establishmentId });
  }

  // Un acteur hors périmètre ne filtre rien : `scope` reste appliqué en ET, donc au
  // pire la page est vide — jamais élargie.
  if (query.actorUserId) filters.push({ actorUserId: query.actorUserId });

  // Pas de cast d'enum sur une entrée : une valeur inconnue est ignorée, jamais
  // transmise à Prisma (qui répondrait par une erreur technique fuitée à l'écran).
  if (query.action && isEnumValue(query.action, AuditAction)) {
    filters.push({ action: query.action });
  }

  const where: Prisma.AuditLogEntryWhereInput = { AND: filters };

  const total = await prisma.auditLogEntry.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);

  const entries = await prisma.auditLogEntry.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
  });

  const userById = new Map(users.map((u) => [u.id, u]));
  const establishmentById = new Map(establishments.map((e) => [e.id, e.name]));

  const rows: AuditLogRow[] = entries.map((entry) => ({
    id: entry.id,
    occurredAt: entry.occurredAt,
    action: entry.action,
    // Jamais l'identifiant brut : un compte supprimé ou hors périmètre est rendu
    // par une mention, pas par sa clé technique.
    actorLabel: entry.actorUserId
      ? (userById.get(entry.actorUserId)?.name ?? ACTOR_UNKNOWN)
      : ACTOR_ANONYMOUS,
    actorRole: entry.actorRole ?? userById.get(entry.actorUserId ?? "")?.role ?? null,
    establishmentName: entry.establishmentId
      ? (establishmentById.get(entry.establishmentId) ?? null)
      : null,
    targetId: entry.targetId,
    detail: entry.detail,
  }));

  return {
    rows,
    total,
    page,
    pageCount,
    establishmentOptions: establishments.map((e) => ({ value: e.id, label: e.name })),
    actorOptions: users.map((u) => ({ value: u.id, label: u.name })),
  };
}
