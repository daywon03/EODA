// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE D'ARRIVÉE SUR LA CONNEXION — règles pures.
//
// Un changement de mot de passe révoque toutes les sessions, celle en cours
// comprise : l'utilisateur repasse par /deconnexion puis /login. Sans message, il
// croit que son changement a échoué. Le motif circule dans l'adresse, donc c'est
// une entrée NON FIABLE : seule une valeur de la liste ci-dessous produit un texte,
// le texte est écrit ici (jamais recopié de l'adresse), et la redirection ne mène
// jamais ailleurs que /login.
// ─────────────────────────────────────────────────────────────────────────────

export const LOGIN_NOTICE_PARAM = "motif";

const LOGIN_NOTICES = {
  "mot-de-passe-modifie": "Votre mot de passe a bien été modifié. Connectez-vous avec le nouveau.",
} as const;

type LoginNotice = keyof typeof LOGIN_NOTICES;

function isLoginNotice(value: string | null | undefined): value is LoginNotice {
  return value !== null && value !== undefined && Object.hasOwn(LOGIN_NOTICES, value);
}

export function loginNoticeFor(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isLoginNotice(value) ? LOGIN_NOTICES[value] : null;
}

export function loginPathAfterSignOut(raw: string | null): string {
  return isLoginNotice(raw) ? `/login?${LOGIN_NOTICE_PARAM}=${raw}` : "/login";
}
