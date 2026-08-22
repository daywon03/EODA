// ─────────────────────────────────────────────────────────────────────────────
// POLITIQUE DE MOT DE PASSE — fonction pure, appliquée CÔTÉ SERVEUR
//
// Le formulaire porte les mêmes contraintes en HTML, mais c'est du confort : un
// `minlength` est une suggestion au navigateur, pas un contrôle. La seule
// validation qui compte est celle-ci, appelée par l'action serveur.
//
// Choix de règles : la longueur prime sur la composition (ANSSI / NIST SP 800-63B).
// Imposer « une majuscule, un chiffre, un caractère spécial » produit surtout des
// `Motdepasse1!` ; imposer 12 caractères produit des phrases de passe. On refuse en
// revanche la réutilisation du mot de passe courant, sans quoi « changer son mot de
// passe temporaire » peut se faire en le resaisissant.
//
// Plafond à 72 OCTETS : bcrypt tronque silencieusement au-delà. Sans ce plafond,
// deux mots de passe différents de 100 caractères partageant leurs 72 premiers
// octets ouvriraient le même compte — et l'utilisateur croirait avoir 100
// caractères de force.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 72;

export type PasswordPolicyResult = { ok: true } | { ok: false; error: string };

export function validateNewPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}): PasswordPolicyResult {
  const { currentPassword, newPassword, confirmation } = input;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    };
  }

  if (Buffer.byteLength(newPassword, "utf8") > MAX_PASSWORD_BYTES) {
    return {
      ok: false,
      error: `Le nouveau mot de passe dépasse ${MAX_PASSWORD_BYTES} octets — au-delà, les caractères supplémentaires ne seraient pas pris en compte.`,
    };
  }

  if (newPassword !== confirmation) {
    return { ok: false, error: "La confirmation ne correspond pas au nouveau mot de passe." };
  }

  if (newPassword === currentPassword) {
    return {
      ok: false,
      error: "Le nouveau mot de passe doit être différent du mot de passe actuel.",
    };
  }

  return { ok: true };
}
