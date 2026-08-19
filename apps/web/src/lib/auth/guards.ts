import { prisma, type UserRole } from "@eoda/database";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// COUCHE D'AUTORISATION UNIQUE — fail-closed par construction
//
// Toute lecture ou écriture touchant un établissement DOIT passer par une des
// gardes de ce fichier. Ne jamais réécrire un contrôle d'accès ad hoc dans une
// action : c'est ainsi qu'on obtient des divergences (une action qui vérifie le
// tenant, une autre qui l'oublie) et donc des IDOR.
//
// Deux axes de cloisonnement, cumulatifs :
//   1. Rôle          — CLIENT_USER / CABINET_EVALUATOR / CABINET_ADMIN
//   2. Appartenance  — tenant (côté Cabinet) ou lien EstablishmentUser (côté Client)
//
// Règle fail-closed : un utilisateur Cabinet SANS tenant n'a accès à RIEN. Ne
// jamais retomber sur un filtre absent (`where.tenantId` conditionnel) — un
// filtre omis rend la requête globale et casse le cloisonnement, cf. CLAUDE.md §6.
// ─────────────────────────────────────────────────────────────────────────────

// Contexte Cabinet résolu — `tenantId` est toujours non-null ici, c'est
// l'invariant qui permet aux actions de filtrer sans re-tester.
export type CabinetContext = {
  session: Session;
  userId: string;
  tenantId: string;
};

// Contexte d'accès à un établissement, quel que soit le côté (Cabinet ou Client).
// `tenantId` est null pour un CLIENT_USER : son cloisonnement vient du lien
// EstablishmentUser, pas du tenant.
export type EstablishmentAccessContext = {
  session: Session;
  userId: string;
  establishmentId: string;
  isClient: boolean;
};

async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}

// Relit le rôle ET le tenant en base à chaque contrôle, plutôt que de se fier au
// seul JWT. Deux raisons :
//   - révocation immédiate : un compte supprimé ou rétrogradé perd l'accès tout de
//     suite, sans attendre l'expiration du jeton (8 h) ;
//   - le tenant n'est pas dans le jeton, il doit de toute façon être résolu.
// Le coût est une requête indexée sur clé primaire, négligeable devant les
// requêtes métier qui suivent.
async function resolveUser(userId: string): Promise<{ role: UserRole; tenantId: string | null } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true },
  });
  return user ?? null;
}

// Garde commun à tout l'espace Cabinet (établissements, suivi de mission, évaluation) —
// exclut CLIENT_USER. CABINET_ADMIN et CABINET_EVALUATOR passent tous les deux : la
// distinction plus stricte est portée par requireCabinetAdminSession() ci-dessous,
// réservée aux données commerciales.
//
// Résout systématiquement le tenant : un compte Cabinet orphelin (tenantId null)
// est refusé plutôt que de se voir accorder un accès non filtré.
export async function requireCabinetSession(): Promise<CabinetContext> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  if (user.role === "CLIENT_USER") redirect("/dashboard/client");
  if (!user.tenantId) redirect("/login");

  return { session, userId: session.user.id, tenantId: user.tenantId };
}

// Garde strict pour le pipeline commercial (prospects/devis/catalogue) — réservé à
// CABINET_ADMIN. Redirige vers /dashboard/cabinet (pas /login) car un
// CABINET_EVALUATOR est légitimement connecté, juste non autorisé sur ce module.
export async function requireCabinetAdminSession(): Promise<CabinetContext> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  if (user.role !== "CABINET_ADMIN") redirect("/dashboard/cabinet");
  if (!user.tenantId) redirect("/dashboard/cabinet");

  return { session, userId: session.user.id, tenantId: user.tenantId };
}

// Garde Cabinet + appartenance de l'établissement au tenant de l'appelant.
// À utiliser dès qu'un `establishmentId` vient de la requête (paramètre de route,
// champ de formulaire, argument d'action) : sans ce contrôle, un utilisateur
// Cabinet d'un tenant peut agir sur l'établissement d'un autre tenant (IDOR).
//
// notFound() plutôt que redirect() — ne jamais révéler qu'un identifiant existe
// dans un autre tenant.
export async function requireEstablishmentInTenant(
  establishmentId: string
): Promise<CabinetContext & { establishmentId: string }> {
  const context = await requireCabinetSession();

  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, tenantId: context.tenantId },
    select: { id: true },
  });
  if (!establishment) notFound();

  return { ...context, establishmentId: establishment.id };
}

// Accès à un établissement depuis les deux côtés :
//   - CLIENT_USER : uniquement si un lien EstablishmentUser existe (cloisonnement
//     client — un client ne voit jamais les données d'un autre client, CLAUDE.md §6).
//   - Cabinet     : uniquement si l'établissement appartient à son tenant.
// C'est la garde des actions partagées (dépôt de document, aperçu, checklist).
export async function requireEstablishmentAccess(
  establishmentId: string
): Promise<EstablishmentAccessContext> {
  const session = await requireSession();
  const userId = session.user.id;

  const user = await resolveUser(userId);
  if (!user) redirect("/login");

  if (user.role === "CLIENT_USER") {
    const link = await prisma.establishmentUser.findUnique({
      where: { userId_establishmentId: { userId, establishmentId } },
      select: { establishmentId: true },
    });
    if (!link) notFound();
    return { session, userId, establishmentId, isClient: true };
  }

  if (!user.tenantId) redirect("/login");

  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!establishment) notFound();

  return { session, userId, establishmentId, isClient: false };
}

// Variante non-redirigeante de requireEstablishmentAccess() — pour les actions qui
// doivent répondre `null` (aperçu/téléchargement appelés depuis un composant client)
// plutôt que déclencher une navigation. Retourne null en cas de refus, jamais une
// exception : l'appelant traite ça comme "introuvable".
export async function tryEstablishmentAccess(
  establishmentId: string
): Promise<EstablishmentAccessContext | null> {
  const session = await auth();
  if (!session) return null;
  const userId = session.user.id;

  const user = await resolveUser(userId);
  if (!user) return null;

  if (user.role === "CLIENT_USER") {
    const link = await prisma.establishmentUser.findUnique({
      where: { userId_establishmentId: { userId, establishmentId } },
      select: { establishmentId: true },
    });
    return link ? { session, userId, establishmentId, isClient: true } : null;
  }

  if (!user.tenantId) return null;

  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, tenantId: user.tenantId },
    select: { id: true },
  });
  return establishment ? { session, userId, establishmentId, isClient: false } : null;
}

// Garde côté espace Client uniquement (dashboard client) — retourne l'établissement
// rattaché à l'utilisateur, résolu depuis le lien EstablishmentUser plutôt que depuis
// un identifiant fourni par la requête (donc non falsifiable).
export async function requireClientEstablishment(): Promise<{
  session: Session;
  userId: string;
  establishment: { id: string; name: string; type: string } | null;
}> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  if (user.role !== "CLIENT_USER") redirect("/dashboard/cabinet");

  const link = await prisma.establishmentUser.findFirst({
    where: { userId: session.user.id },
    include: { establishment: { select: { id: true, name: true, type: true } } },
  });

  return {
    session,
    userId: session.user.id,
    establishment: link?.establishment ?? null,
  };
}
