import { cache } from "react";
import { effectiveTabletRole } from "@/lib/services/tablet-role-service";
import { prisma, type CommercialTier, type EstablishmentType, type TabletRole, type UserRole } from "@eoda/database";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { PASSWORD_ROTATION_PATH, SIGN_OUT_PATH } from "./routes";
import { getEnv } from "@/lib/config/env";
import { hashOneTimeToken, isOneTimeTokenWellFormed } from "@/lib/security/one-time-token";
import { DEVICE_COOKIE, pinStamp, readTabletSessionToken, TABLET_SESSION_COOKIE } from "@/lib/security/tablet-session";
import {
  canClientRead,
  deriveMissionAccessState,
  type MissionAccessFacts,
  type MissionAccessState,
} from "@/lib/services/mission-access-service";
import {
  clientAllows,
  clientOwnOnly,
  type ClientAccessRole,
  cabinetCapabilityFor,
  cabinetLandingPath,
  hasCabinetCapability,
  isCabinetRole,
  prospectSpaceExitPath,
  roleHomePath,
  isInStructureScope,
  resolveStructureScope,
  structureAccessFor,
  type CabinetCapability,
  type EstablishmentNeed,
  type StructureAccess,
  type StructureScope,
} from "./capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// COUCHE D'AUTORISATION UNIQUE — fail-closed par construction
//
// Toute lecture ou écriture touchant un établissement DOIT passer par une des
// gardes de ce fichier. Ne jamais réécrire un contrôle d'accès ad hoc dans une
// action : c'est ainsi qu'on obtient des divergences (une action qui vérifie le
// tenant, une autre qui l'oublie) et donc des IDOR.
//
// Deux axes de cloisonnement, cumulatifs :
//   1. Rôle          — capacités du rôle (capabilities.ts, matrice pure et testée)
//   2. Appartenance  — tenant + affectation (côté Cabinet) ou lien EstablishmentUser
//                      (côté Client)
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
  // Rôle RELU EN BASE par la garde, pas celui du jeton : c'est lui qui décide de
  // ce que la coquille affiche (section Commercial), à la même source que le refus.
  role: UserRole;
  // Structures que l'appelant peut voir (affectation consultante, N9). Résolu ICI :
  // une liste filtrée par une action qui le recalculerait finirait par l'oublier.
  structureScope: StructureScope;
};

// Contexte d'accès à un établissement, quel que soit le côté (Cabinet ou Client).
// `tenantId` est null pour un CLIENT_USER : son cloisonnement vient du lien
// EstablishmentUser, pas du tenant.
export type EstablishmentAccessContext = {
  session: Session;
  userId: string;
  establishmentId: string;
  isClient: boolean;
  // État d'accès issu de la fin de mission (mission-access-service). Résolu ICI et
  // rendu à l'appelant : une action qui le relirait de son côté finirait par
  // l'oublier, et c'est exactement le mode de défaillance que cette couche unique
  // existe pour empêcher.
  missionAccess: MissionAccessState;
  // Côté client : rôle d'accès dans la structure (N9) et limitation à « ce qui est à
  // soi » (ses tâches, ses quiz). Côté cabinet : null / false.
  clientAccessRole: ClientAccessRole | null;
  ownOnly: boolean;
};

// Deux faits, une décision : la clôture de la mission et la révocation de l'accès
// client. Lecture étroite, jamais mise en cache entre deux requêtes — une révocation
// prend effet à la navigation suivante, pas à la prochaine session. MÉMOÏSÉE PAR
// RENDU (`react.cache`, comme `resolveUser`) : une page de fiche appelle six ou sept
// gardes, qui relisaient chacune la même ligne (mesuré le 21/10/2026 : 7 lectures
// de la mission pour une seule vue d'ensemble).
const readMissionClosure = cache(async (establishmentId: string): Promise<MissionAccessFacts | null> => {
  return prisma.mission.findUnique({
    where: { establishmentId },
    select: { closedAt: true, clientAccessRevokedAt: true },
  });
});

// Appartenance d'une structure au cabinet, mémoïsée par rendu pour la même raison
// (10 lectures identiques sur la vue d'ensemble d'une fiche). Clé : (structure,
// cabinet) — jamais la structure seule, le cloisonnement est dans la clé.
const findEstablishmentInTenant = cache(async (establishmentId: string, tenantId: string) => {
  return prisma.establishment.findFirst({
    where: { id: establishmentId, tenantId },
    select: { id: true, type: true },
  });
});

async function resolveMissionAccess(establishmentId: string): Promise<MissionAccessState> {
  return deriveMissionAccessState(await readMissionClosure(establishmentId));
}

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
type ResolvedUser = {
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  emailVerifiedAt: Date | null;
};

// MÉMOÏSÉ PAR RENDU (`react.cache`) — pas un cache applicatif : la mémoïsation ne
// survit pas à la requête HTTP, une révocation de droits prend effet à la navigation
// suivante comme avant.
//
// Ce qu'elle supprime : une même navigation traverse le layout, la page et parfois
// une action de lecture, et CHACUN appelait une garde, donc relisait l'utilisateur.
// Trois allers-retours identiques vers la base pour la même question, mesurés à
// ~290 ms pièce depuis un poste de développement — presque une seconde de latence
// avant que le premier octet ne parte.
const resolveUser = cache(async (userId: string): Promise<ResolvedUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      tenantId: true,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: true,
      emailVerifiedAt: true,
    },
  });
  return user ?? null;
});

// ── Rotation du mot de passe ─────────────────────────────────────────────────
// Deux contrôles, portés ici et nulle part ailleurs (une vérification recopiée dans
// une page est une vérification qu'une autre page oubliera) :
//
//  1. Session périmée. `authAt` est l'heure de connexion, figée dans le jeton. Si le
//     mot de passe a été changé APRÈS, cette session appartient à l'avant : elle est
//     refusée, y compris ouverte sur un autre appareil. C'est la seule invalidation
//     de session possible avec une stratégie JWT sans table de sessions — elle est
//     réelle parce que `authAt` ne bouge pas quand Auth.js réémet le jeton.
//  2. Rotation due. Tant que `mustChangePassword` est vrai en base, aucune route
//     authentifiée n'est servie hormis la page de rotation elle-même.
//
// La déconnexion passe par /deconnexion (route handler) et jamais par redirect(
// "/login") : le cookie de session est encore posé, le middleware renverrait
// aussitôt vers le tableau de bord et on boucherait indéfiniment.
export function isSessionStale(session: Session, user: ResolvedUser): boolean {
  if (!user.passwordChangedAt) return false;
  // Jeton émis avant l'introduction de la revendication : rien à comparer.
  if (session.user.authAt === null) return false;
  return session.user.authAt < user.passwordChangedAt.getTime();
}

// ── Révocation d'un compte ───────────────────────────────────────────────────
// Un compte désactivé (départ d'un salarié de la structure cliente, suspension) est
// refusé ICI, dans la couche d'autorisation, et pas seulement à la connexion : une
// session déjà ouverte au moment de la désactivation doit cesser de servir à la
// requête suivante, exactement comme un compte supprimé ou rétrogradé (§4.1
// « révocation immédiate »). Le masquer d'une liste ne révoque rien.
export function isAccountRevoked(user: ResolvedUser): boolean {
  return !user.isActive;
}

// Contrôles communs à TOUTES les gardes redirigeantes. `allowRotationPending` est
// réservé à la garde de la page de rotation elle-même — un compte désactivé, lui,
// n'est exempté par rien : il ne peut même pas changer son mot de passe.
function enforceAccountState(
  session: Session,
  user: ResolvedUser,
  options: { allowRotationPending: boolean }
): void {
  if (isAccountRevoked(user)) redirect(SIGN_OUT_PATH);
  if (isSessionStale(session, user)) redirect(SIGN_OUT_PATH);
  if (user.mustChangePassword && !options.allowRotationPending) redirect(PASSWORD_ROTATION_PATH);
}

// Côté client d'une garde partagée : lien EstablishmentUser (le cloisonnement client
// ne vient pas du tenant), puis état d'accès de fin de mission. Rend null sur tout
// refus.
//
// Le lien doit être ACTIF (un accès retiré par la direction garde sa ligne, pour
// l'historique, mais n'ouvre plus rien) et le rôle d'accès doit permettre le module
// demandé (matrice client de capabilities.ts).
async function resolveClientEstablishmentAccess(
  session: Session,
  establishmentId: string,
  need: EstablishmentNeed
): Promise<EstablishmentAccessContext | null> {
  const userId = session.user.id;
  const link = await prisma.establishmentUser.findUnique({
    where: { userId_establishmentId: { userId, establishmentId } },
    select: { establishmentId: true, accessRole: true, revokedAt: true },
  });
  if (!link || link.revokedAt) return null;
  if (!clientAllows(link.accessRole, need)) return null;

  const missionAccess = await resolveMissionAccess(establishmentId);
  if (!canClientRead(missionAccess)) return null;

  return {
    session,
    userId,
    establishmentId,
    isClient: true,
    missionAccess,
    clientAccessRole: link.accessRole,
    ownOnly: clientOwnOnly(link.accessRole, need.module),
  };
}

// ── Gardes Cabinet ───────────────────────────────────────────────────────────
// Depuis N9 (13/10/2026), le rôle seul ne dit plus ce qu'un compte cabinet peut
// faire : quatre rôles, une matrice de capacités (capabilities.ts, pur, testé). Toute
// garde cabinet reçoit donc la CAPACITÉ demandée, en argument OBLIGATOIRE — c'est ce
// qui a forcé, à la bascule, la relecture de chaque appel (le compilateur refusait
// les anciens). `ANY_CABINET_ROLE` est réservé à la coquille (barre latérale, menu
// du compte), qui doit s'afficher pour tout compte cabinet.
//
// Résout systématiquement le tenant : un compte Cabinet orphelin (tenantId null)
// est refusé plutôt que de se voir accorder un accès non filtré.
export type CabinetNeed = CabinetCapability | "ANY_CABINET_ROLE";

function grants(role: UserRole, need: CabinetNeed): boolean {
  return need === "ANY_CABINET_ROLE" ? isCabinetRole(role) : hasCabinetCapability(role, need);
}

// Affectations d'un compte (consultante ↔ structures). Lues seulement pour un
// CABINET_EVALUATOR : c'est le seul rôle qu'elles restreignent. Mémoïsées par rendu,
// comme resolveUser — une désaffectation prend effet à la navigation suivante.
const resolveAssignedEstablishmentIds = cache(async (userId: string): Promise<string[]> => {
  const rows = await prisma.establishmentAssignment.findMany({
    where: { userId },
    select: { establishmentId: true },
  });
  return rows.map((row) => row.establishmentId);
});

async function resolveStructureScopeFor(userId: string, role: UserRole): Promise<StructureScope> {
  const assigned = role === "CABINET_EVALUATOR" ? await resolveAssignedEstablishmentIds(userId) : [];
  return resolveStructureScope(role, assigned);
}

async function buildCabinetContext(session: Session, role: UserRole, tenantId: string): Promise<CabinetContext> {
  return {
    session,
    userId: session.user.id,
    tenantId,
    role,
    structureScope: await resolveStructureScopeFor(session.user.id, role),
  };
}

export async function requireCabinetSession(need: CabinetNeed): Promise<CabinetContext> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  enforceAccountState(session, user, { allowRotationPending: false });
  // Client ou structure inscrite seule : renvoyé à SON portail, jamais servi.
  if (!isCabinetRole(user.role)) redirect(roleHomePath(user.role));
  if (!user.tenantId) redirect("/login");
  // Compte légitimement connecté, mais pas habilité sur ce module : renvoyé à SA page
  // d'arrivée (un commercial vers le commercial), jamais vers /login.
  if (!grants(user.role, need)) redirect(cabinetLandingPath(user.role));

  return buildCabinetContext(session, user.role, user.tenantId);
}

// Variante non-redirigeante de requireCabinetSession() — mêmes contrôles, mais pour
// les actions appelées depuis un composant client qui doivent répondre `null` plutôt
// que déclencher une navigation (même raison d'être que tryEstablishmentAccess
// ci-dessous).
export async function tryCabinetSession(need: CabinetNeed): Promise<CabinetContext | null> {
  const session = await auth();
  if (!session) return null;

  const user = await resolveUser(session.user.id);
  if (!user) return null;
  if (isAccountRevoked(user) || user.mustChangePassword || isSessionStale(session, user)) return null;
  if (!isCabinetRole(user.role)) return null;
  if (!user.tenantId) return null;
  if (!grants(user.role, need)) return null;

  return buildCabinetContext(session, user.role, user.tenantId);
}

// Réglages de cabinet (matrice des critères, documents réclamés, écriture de la
// bibliothèque, mode d'accompagnement, clôture, suppression d'une fiche) —
// CABINET_ADMIN seul, par la capacité CABINET_SETTINGS.
export async function requireCabinetAdminSession(): Promise<CabinetContext> {
  return requireCabinetSession("CABINET_SETTINGS");
}

// Pipeline commercial (prospects, devis, catalogue, signature, demandes d'option) —
// CABINET_ADMIN et CABINET_COMMERCIAL. Vérifié page par page et export par export
// par commercial-pages-guard.test.ts.
export async function requireCommercialSession(): Promise<CabinetContext> {
  return requireCabinetSession("COMMERCIAL");
}

// « Contenus à valider » (lecture et export) — CABINET_ADMIN et CABINET_EVALUATOR.
export async function requireContentReviewSession(): Promise<CabinetContext> {
  return requireCabinetSession("CONTENT_REVIEW");
}

// Équipe EODA : inviter, changer un rôle, affecter, retirer l'accès.
export async function requireTeamManagerSession(): Promise<CabinetContext> {
  return requireCabinetSession("TEAM_MANAGE");
}

// ── Périmètre des structures ─────────────────────────────────────────────────
// Filtre Prisma d'une LISTE de structures pour l'appelant : le tenant, toujours, et
// la liste des structures affectées quand le périmètre est restreint. Toute lecture
// de liste de structures (ou de leurs documents, tâches, messages) passe par lui :
// un `findMany` filtré sur le seul tenant montrerait à une consultante tout le
// portefeuille.
export function structureScopeWhere(context: CabinetContext): { tenantId: string; id?: { in: string[] } } {
  const scope = context.structureScope;
  if (scope.kind === "ALL") return { tenantId: context.tenantId };
  return { tenantId: context.tenantId, id: { in: [...scope.establishmentIds] } };
}

// Pour une action qui reçoit l'identifiant d'un AUTRE objet (mission, session
// d'évaluation, rendez-vous) et vient d'en résoudre la structure dans le tenant :
// la structure doit aussi être dans le périmètre de l'appelant. notFound() sinon,
// comme pour un autre tenant.
export function requireStructureInScope(context: CabinetContext, establishmentId: string): void {
  if (!isInStructureScope(context.structureScope, establishmentId)) notFound();
}

// Garde Cabinet + appartenance de l'établissement au tenant de l'appelant + périmètre
// d'affectation. À utiliser dès qu'un `establishmentId` vient de la requête
// (paramètre de route, champ de formulaire, argument d'action) : sans ce contrôle,
// un utilisateur Cabinet d'un tenant peut agir sur l'établissement d'un autre
// tenant (IDOR).
//
// `access` est OBLIGATOIRE : READ (lecture seule acceptée), WRITE (toute écriture),
// CONTRACT (montants de la structure). notFound() plutôt que redirect() sur un
// identifiant hors périmètre — ne jamais révéler qu'il existe ailleurs.
type EstablishmentInTenantContext = CabinetContext & { establishmentId: string; establishmentType: EstablishmentType };

async function resolveEstablishmentInTenant(
  context: CabinetContext,
  establishmentId: string
): Promise<EstablishmentInTenantContext> {
  requireStructureInScope(context, establishmentId);
  const establishment = await findEstablishmentInTenant(establishmentId, context.tenantId);
  if (!establishment) notFound();

  return { ...context, establishmentId: establishment.id, establishmentType: establishment.type };
}

export async function requireEstablishmentInTenant(
  establishmentId: string,
  access: StructureAccess
): Promise<EstablishmentInTenantContext> {
  return resolveEstablishmentInTenant(await requireCabinetSession(cabinetCapabilityFor(access)), establishmentId);
}

// Même contrôle d'appartenance, réservé à CABINET_ADMIN : les gestes de gérance sur
// une fiche (la supprimer) ne sont pas du suivi opérationnel. Le rôle d'abord — un
// évaluateur est renvoyé à l'accueil sans qu'on lui dise si la fiche existe.
export async function requireAdminEstablishmentInTenant(
  establishmentId: string
): Promise<EstablishmentInTenantContext> {
  return resolveEstablishmentInTenant(await requireCabinetAdminSession(), establishmentId);
}

// Côté cabinet d'une garde partagée : capacité, tenant, périmètre. Rend null sur
// tout refus — l'appelant décide s'il redirige ou s'il répond sec.
async function resolveCabinetEstablishmentAccess(
  session: Session,
  user: ResolvedUser,
  establishmentId: string,
  need: EstablishmentNeed
): Promise<EstablishmentAccessContext | "NO_TENANT" | null> {
  if (!user.tenantId) return "NO_TENANT";
  if (!hasCabinetCapability(user.role, cabinetCapabilityFor(structureAccessFor(need)))) return null;
  const scope = await resolveStructureScopeFor(session.user.id, user.role);
  if (!isInStructureScope(scope, establishmentId)) return null;

  const establishment = await findEstablishmentInTenant(establishmentId, user.tenantId);
  if (!establishment) return null;

  // Le cabinet garde l'accès dans TOUS les états — « rétention côté cabinet, zéro
  // accès client ». L'état est tout de même résolu : le dépôt, lui, se ferme pour
  // tout le monde à la clôture (canDepositDocuments).
  return {
    session,
    userId: session.user.id,
    establishmentId,
    isClient: false,
    missionAccess: await resolveMissionAccess(establishmentId),
    clientAccessRole: null,
    ownOnly: false,
  };
}

// Accès à un établissement depuis les deux côtés :
//   - CLIENT_USER : uniquement si un lien EstablishmentUser existe (cloisonnement
//     client — un client ne voit jamais les données d'un autre client, CLAUDE.md §6).
//   - Cabinet     : capacité du module, tenant, périmètre d'affectation.
// C'est la garde des actions partagées (dépôt de document, aperçu, checklist).
// `need` (module + mode) est OBLIGATOIRE : il dit ce que l'action touche.
export async function requireEstablishmentAccess(
  establishmentId: string,
  need: EstablishmentNeed
): Promise<EstablishmentAccessContext> {
  const session = await requireSession();
  const userId = session.user.id;

  const user = await resolveUser(userId);
  if (!user) redirect("/login");
  enforceAccountState(session, user, { allowRotationPending: false });

  if (user.role === "CLIENT_USER") {
    const access = await resolveClientEstablishmentAccess(session, establishmentId, need);
    // Lien absent, accès révoqué ou module hors du rôle : `notFound()` et pas un
    // message d'explication — on ne renseigne personne sur ce qui existe derrière.
    // Les données, elles, ne sont pas supprimées : la rétention reste côté cabinet.
    if (!access) notFound();
    return access;
  }
  // Ni client ni cabinet (structure inscrite seule) : aucun établissement n'existe
  // pour elle — introuvable, sans rien révéler.
  if (!isCabinetRole(user.role)) notFound();

  const access = await resolveCabinetEstablishmentAccess(session, user, establishmentId, need);
  if (access === "NO_TENANT") redirect("/login");
  if (!access) notFound();
  return access;
}

// Variante non-redirigeante de requireEstablishmentAccess() — pour les actions qui
// doivent répondre `null` (aperçu/téléchargement appelés depuis un composant client)
// plutôt que déclencher une navigation. Retourne null en cas de refus, jamais une
// exception : l'appelant traite ça comme "introuvable".
export async function tryEstablishmentAccess(
  establishmentId: string,
  need: EstablishmentNeed
): Promise<EstablishmentAccessContext | null> {
  const session = await auth();
  if (!session) return null;

  const user = await resolveUser(session.user.id);
  if (!user) return null;
  // Variante non redirigeante : un compte désactivé, une rotation due ou une session
  // périmée se traduisent par un refus sec, jamais par une navigation (l'appelant est
  // un composant client).
  if (isAccountRevoked(user) || user.mustChangePassword || isSessionStale(session, user)) {
    return null;
  }

  if (user.role === "CLIENT_USER") return resolveClientEstablishmentAccess(session, establishmentId, need);
  if (!isCabinetRole(user.role)) return null;

  const access = await resolveCabinetEstablishmentAccess(session, user, establishmentId, need);
  return access === "NO_TENANT" ? null : access;
}

// Garde côté espace Client uniquement (dashboard client) — retourne l'établissement
// rattaché à l'utilisateur, résolu depuis le lien EstablishmentUser plutôt que depuis
// un identifiant fourni par la requête (donc non falsifiable).
//
// `need` est OBLIGATOIRE (N9) : "HOME" pour la coquille et l'accueil, ouverts à tout
// rôle d'accès ; sinon le module touché. Un rôle qui n'a pas le module est renvoyé à
// l'accueil de son portail — jamais une page vide qui laisserait croire à un bug.
export type ClientNeed = EstablishmentNeed | "HOME";

export async function requireClientEstablishment(need: ClientNeed): Promise<{
  session: Session;
  userId: string;
  establishment: { id: string; name: string; type: string; logoDataUri: string | null } | null;
  // Rôle d'accès dans la structure (null sans structure rattachée), et limitation de
  // l'action à ce qui appartient à la personne (niveau OWN de la matrice).
  accessRole: ClientAccessRole | null;
  ownOnly: boolean;
  // Gouverne ce que le portail client propose : dépôt ouvert, bibliothèque en
  // lecture seule, ou rien du tout.
  missionAccess: MissionAccessState;
  // Les FAITS de clôture, rendus tels quels : l'alerte du 5ᵉ mois se calcule à
  // l'affichage, avec l'horloge de l'appelant. Une garde ne décide pas de ce qu'un
  // écran doit annoncer.
  missionClosure: MissionAccessFacts | null;
}> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  enforceAccountState(session, user, { allowRotationPending: false });
  if (user.role !== "CLIENT_USER") redirect(roleHomePath(user.role));

  // Lien ACTIF seulement : un accès retiré par la direction ne rattache plus rien.
  const link = await prisma.establishmentUser.findFirst({
    where: { userId: session.user.id, revokedAt: null },
    include: {
      establishment: { select: { id: true, name: true, type: true, logoDataUri: true } },
    },
  });

  if (!link?.establishment) {
    return {
      session,
      userId: session.user.id,
      establishment: null,
      accessRole: null,
      ownOnly: false,
      missionAccess: "ACTIVE",
      missionClosure: null,
    };
  }

  if (need !== "HOME" && !clientAllows(link.accessRole, need)) redirect("/dashboard/client");
  const ownOnly = need !== "HOME" && clientOwnOnly(link.accessRole, need.module);

  const missionClosure = await readMissionClosure(link.establishment.id);
  const missionAccess = deriveMissionAccessState(missionClosure);
  // Accès révoqué : la page se comporte comme s'il n'y avait pas d'établissement
  // rattaché. Rien n'est supprimé, mais rien n'est montré non plus.
  if (!canClientRead(missionAccess)) {
    return {
      session,
      userId: session.user.id,
      establishment: null,
      accessRole: link.accessRole,
      ownOnly,
      missionAccess,
      missionClosure,
    };
  }

  return {
    session,
    userId: session.user.id,
    establishment: link.establishment,
    accessRole: link.accessRole,
    ownOnly,
    missionAccess,
    missionClosure,
  };
}

// Garde de la page de changement de mot de passe — et d'elle seule. C'est la seule
// route authentifiée accessible à un compte dont la rotation est due : sans cette
// exception, l'utilisateur serait renvoyé vers la page depuis la page elle-même.
// Une session périmée reste refusée (on ne change pas un mot de passe depuis une
// session ouverte avant le dernier changement).
export async function requirePasswordRotationSession(): Promise<{
  session: Session;
  userId: string;
  mustChangePassword: boolean;
}> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  enforceAccountState(session, user, { allowRotationPending: true });

  return {
    session,
    userId: session.user.id,
    mustChangePassword: user.mustChangePassword,
  };
}

// Garde du centre d'aide. Le guide n'est PAS conditionné à l'offre souscrite —
// « le système de prise en main, ce sera pour tout le monde dans tous les cas »
// (call du 16/08/2026, context/07-outil-pilotage-missions.md §12.5) : les trois
// rôles y accèdent. Ce qui change, c'est le CONTENU visible, et il est filtré à
// partir du rôle relu ici en base — jamais d'un rôle envoyé par le navigateur ni
// lu dans le seul jeton (un compte rétrogradé perdrait sinon l'accès aux articles
// Cabinet seulement à l'expiration de sa session).
export async function requireHelpAudience(): Promise<{
  session: Session;
  userId: string;
  role: UserRole;
}> {
  const session = await requireSession();

  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  enforceAccountState(session, user, { allowRotationPending: false });

  return { session, userId: session.user.id, role: user.role };
}

// ── Structure inscrite seule (libre-service, D5 — 13/10/2026) ─────────────────
// Garde de l'espace /espace et de ses actions. Le prospect se résout depuis le lien
// ProspectAccount de l'appelant — JAMAIS depuis un identifiant reçu : un prospect ne
// peut désigner que le sien. Tout autre rôle est renvoyé à son portail ; un compte
// sans lien (prospect supprimé) est déconnecté. Fail-closed.
export type ProspectContext = {
  session: Session;
  userId: string;
  prospect: {
    id: string;
    tenantId: string;
    structureName: string;
    establishmentType: EstablishmentType | null;
    envisagedFormule: CommercialTier | null;
    establishmentId: string | null;
  };
};

export async function requireProspectSession(): Promise<ProspectContext> {
  const session = await requireSession();
  const user = await resolveUser(session.user.id);
  if (!user) redirect("/login");
  enforceAccountState(session, user, { allowRotationPending: false });
  // Compte devenu client à la signature (tranche 11) : sa session porte encore l'ancien
  // rôle — elle est fermée avec un motif, sinon middleware et garde se renverraient la
  // balle. Tout autre rôle va chez lui (prospectSpaceExitPath, testé).
  const exit = prospectSpaceExitPath(user.role, session.user.role);
  if (exit) redirect(exit);
  // Filet : authorize() refuse déjà la connexion d'une adresse non confirmée. Une
  // session qui existerait malgré tout (jeton émis avant la tranche 11) est fermée.
  if (user.emailVerifiedAt === null) redirect(SIGN_OUT_PATH);

  const link = await prisma.prospectAccount.findUnique({
    where: { userId: session.user.id },
    select: {
      prospect: {
        select: {
          id: true,
          tenantId: true,
          structureName: true,
          establishmentType: true,
          envisagedFormule: true,
          establishmentId: true,
        },
      },
    },
  });
  if (!link) redirect(SIGN_OUT_PATH);
  return { session, userId: session.user.id, prospect: link.prospect };
}

// ── Tablette terrain (lot C, décision 7) ─────────────────────────────────────
// « Appareil enregistré + fiche salarié + code, jamais un code seul. » Deux cookies
// httpOnly, relus À CHAQUE requête, comme le rôle d'un compte :
//   1. l'appareil : jeton aléatoire dont seule l'empreinte est en base
//      (`DeviceEnrollment.tokenHash`) ; un appareil révoqué n'ouvre plus rien ;
//   2. la session : jeton signé court (salarié + appareil + expiration).
// Le salarié doit être actif, rattaché à la structure de l'appareil, avec un code
// posé et non bloqué. Tout refus rend null : la page affiche l'écran de connexion,
// sans dire ce qui a manqué.
export type TabletDeviceContext = {
  deviceEnrollmentId: string;
  tenantId: string;
  establishmentId: string;
  establishmentName: string;
};

// Le rôle est relu en base à chaque requête, jamais pris dans le jeton : un rôle
// retiré par la direction vaut dès la page suivante (30/10/2026).
export type TabletSessionContext = TabletDeviceContext & { staffMemberId: string; staffDisplayName: string; tabletRole: TabletRole };

export async function resolveTabletDevice(): Promise<TabletDeviceContext | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!isOneTimeTokenWellFormed(token)) return null;
  const device = await prisma.deviceEnrollment.findUnique({
    where: { tokenHash: hashOneTimeToken(token) },
    select: { id: true, tenantId: true, establishmentId: true, revokedAt: true, establishment: { select: { name: true } } },
  });
  if (!device || device.revokedAt) return null;
  return {
    deviceEnrollmentId: device.id,
    tenantId: device.tenantId,
    establishmentId: device.establishmentId,
    establishmentName: device.establishment.name,
  };
}

export async function resolveTabletSession(now: Date = new Date()): Promise<TabletSessionContext | null> {
  const device = await resolveTabletDevice();
  if (!device) return null;
  const claims = readTabletSessionToken((await cookies()).get(TABLET_SESSION_COOKIE)?.value, getEnv().authSecret, now);
  if (!claims || claims.deviceEnrollmentId !== device.deviceEnrollmentId) return null;
  const staff = await prisma.staffMember.findFirst({
    where: { id: claims.staffMemberId, establishmentId: device.establishmentId, active: true },
    select: { id: true, displayName: true, jobTitle: true, tabletRole: true, pin: { select: { lockedAt: true, pinHash: true } } },
  });
  if (!staff?.pin || staff.pin.lockedAt) return null;
  // Code changé ou remplacé depuis la connexion : la session est coupée (audit du 28/10/2026).
  if (claims.pinStamp !== pinStamp(staff.pin.pinHash)) return null;
  // La direction est toujours administrateur (`effectiveTabletRole`, 30/10/2026).
  return { ...device, staffMemberId: staff.id, staffDisplayName: staff.displayName, tabletRole: effectiveTabletRole(staff) };
}
