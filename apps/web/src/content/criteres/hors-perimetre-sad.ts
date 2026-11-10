// ─────────────────────────────────────────────────────────────────────────────
// CRITÈRES DU MANUEL HAS RÉSERVÉS AUX ÉTABLISSEMENTS — contenu, pas schéma
//
// La base ne charge que les grilles Synaé des SAD (137 critères) ; le manuel HAS en
// compte 157. Un code du manuel dont le champ d'application est « Établissement »
// (exemple : 2.4.1) ne s'applique pas à un service à domicile : il n'est donc pas en
// base, et ce n'est pas une faute de frappe (retour du 09/11/2026).
//
// Le dépôt ne contient AUCUN catalogue complet des 157 critères. Cette liste reprend
// les seuls codes dont le champ « Établissement » est écrit, d'après le manuel, dans la
// matrice proposée (`matrice-proposition.ts`, colonne remarque : « hors périmètre SAD
// aide selon le manuel (Tous ESSMS | Établissement | Tous publics) »). Elle est courte
// parce que la source l'est : un code absent d'ici n'est pas déclaré inconnu, le
// message lui donne la piste du périmètre (`criterion-code-message.ts`).
//
// Module à part (trois codes) plutôt qu'une lecture de la matrice à l'exécution : le
// message est aussi calculé dans le navigateur (aperçu d'import), où les 400 lignes de
// la matrice n'ont rien à faire. `criterion-code-message.test.ts` échoue si cette liste
// diverge de la matrice.
// ─────────────────────────────────────────────────────────────────────────────

export const ESTABLISHMENT_ONLY_CRITERIA: ReadonlySet<string> = new Set(["1.4.2", "2.4.1", "3.2.2"]);
