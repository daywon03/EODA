import type { UserRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// « UN COMPTE EXISTE DÉJÀ » — que peut-on en dire, et que peut-on en faire ?
//
// Retour de démo des 15 et 22/09 : quand Sandrine invite un interlocuteur déjà
// présent dans une autre structure qu'elle accompagne (un directeur de deux SAD),
// le refus sec « un compte existe déjà » ne lui disait ni OÙ, ni quoi faire.
//
// Mais dire où, c'est révéler l'existence d'un compte : on ne le fait QUE si tout ce
// que ce compte touche appartient déjà au cabinet de l'appelant. Dès qu'un seul de
// ses rattachements est dans un autre cabinet — ou qu'il n'en a aucun sans être
// déclaré dans ce cabinet, ou que c'est un compte Cabinet —, la réponse redevient la phrase opaque historique. Fail-closed :
// un tenant inconnu vaut un tenant étranger.
//
// Règles PURES : ni Prisma (types seulement), ni horloge.
// ─────────────────────────────────────────────────────────────────────────────

export type ExistingAccountFacts = {
  role: UserRole;
  isActive: boolean;
  // Cabinet auquel le compte est déclaré appartenir (`User.tenantId`). `null` pour les
  // comptes clients historiques, créés par invitation sans tenant : seuls leurs
  // rattachements disent alors à quel cabinet ils appartiennent.
  tenantId: string | null;
  // `revoked` : lien retiré. Il dit toujours à quel cabinet le compte appartient (règle
  // d'opacité inchangée), mais n'est plus un rattachement : on peut le rétablir.
  links: ReadonlyArray<{ establishmentId: string; establishmentName: string; tenantId: string; revoked?: boolean }>;
};

export type ExistingAccountDecision =
  | { kind: "NONE" }
  | { kind: "OPAQUE" }
  | { kind: "ALREADY_LINKED" }
  | { kind: "INACTIVE"; establishmentNames: string[] }
  | { kind: "LINKABLE"; establishmentNames: string[] };

export const OPAQUE_EXISTING_ACCOUNT_MESSAGE = "Un compte existe déjà pour cette adresse email.";

export function decideExistingAccount(
  account: ExistingAccountFacts | null,
  target: { establishmentId: string; tenantId: string }
): ExistingAccountDecision {
  if (account === null) return { kind: "NONE" };
  if (account.role !== "CLIENT_USER") return { kind: "OPAQUE" };
  // Déclaré dans un autre cabinet : opaque, quels que soient ses rattachements.
  if (account.tenantId !== null && account.tenantId !== target.tenantId) return { kind: "OPAQUE" };
  // Sans aucun rattachement, seul un tenant DÉCLARÉ égal à celui de l'appelant prouve
  // l'appartenance (compte préparé avant la signature, compte de test du seed). Sans
  // lui, tenant inconnu = tenant étranger (fail-closed).
  if (account.links.length === 0) {
    if (account.tenantId !== target.tenantId) return { kind: "OPAQUE" };
    return account.isActive
      ? { kind: "LINKABLE", establishmentNames: [] }
      : { kind: "INACTIVE", establishmentNames: [] };
  }
  if (account.links.some((link) => link.tenantId !== target.tenantId)) return { kind: "OPAQUE" };
  if (account.links.some((link) => link.establishmentId === target.establishmentId && !link.revoked)) {
    return { kind: "ALREADY_LINKED" };
  }
  const establishmentNames = [...new Set(account.links.filter((link) => !link.revoked).map((link) => link.establishmentName))].sort(
    (a, b) => a.localeCompare(b, "fr")
  );
  return account.isActive
    ? { kind: "LINKABLE", establishmentNames }
    : { kind: "INACTIVE", establishmentNames };
}

// Phrase affichée au cabinet. `null` quand il n'y a rien à dire (aucun compte).
export function describeExistingAccount(decision: ExistingAccountDecision): string | null {
  switch (decision.kind) {
    case "NONE":
      return null;
    case "OPAQUE":
      return OPAQUE_EXISTING_ACCOUNT_MESSAGE;
    case "ALREADY_LINKED":
      return "Cet interlocuteur a déjà accès à cette structure.";
    case "INACTIVE":
      if (decision.establishmentNames.length === 0) {
        return "Un compte désactivé existe pour cette adresse. Réactivez-le avant de le rattacher ici.";
      }
      return (
        `Un compte désactivé existe pour cette adresse (${decision.establishmentNames.join(", ")}). ` +
        "Réactivez-le depuis cette structure avant de le rattacher ici."
      );
    case "LINKABLE":
      if (decision.establishmentNames.length === 0) {
        return (
          "Un compte existe déjà pour cette adresse, sans structure rattachée. " +
          "Vous pouvez le rattacher à cette structure."
        );
      }
      return (
        `Un compte existe déjà pour cette adresse : il a accès à ${decision.establishmentNames.join(", ")}. ` +
        "Vous pouvez le rattacher aussi à cette structure."
      );
  }
}
