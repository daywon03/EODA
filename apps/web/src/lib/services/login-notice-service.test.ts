import { describe, expect, it } from "vitest";
import { LOGIN_NOTICE_PARAM, loginNoticeFor, loginPathAfterSignOut } from "./login-notice-service";

// Après un changement de mot de passe, toutes les sessions sont révoquées et
// l'utilisateur atterrit sur la connexion : sans message, il croit que son
// changement a échoué. Le motif vient de l'adresse — entrée non fiable : seule une
// valeur connue produit un message, et jamais un texte recopié de l'adresse.
const CHANGED = "Votre mot de passe a bien été modifié. Connectez-vous avec le nouveau.";

describe("message d'arrivée sur la connexion", () => {
  it("annonce le mot de passe modifié", () => {
    expect(loginNoticeFor("mot-de-passe-modifie")).toBe(CHANGED);
    expect(loginNoticeFor(["mot-de-passe-modifie", "x"])).toBe(CHANGED);
  });

  it("ignore un motif inconnu ou absent", () => {
    expect(loginNoticeFor("<script>")).toBeNull();
    expect(loginNoticeFor("toString")).toBeNull();
    expect(loginNoticeFor(undefined)).toBeNull();
  });

  it("la déconnexion ne renvoie que vers /login, avec un motif connu seulement", () => {
    expect(loginPathAfterSignOut("mot-de-passe-modifie")).toBe(
      `/login?${LOGIN_NOTICE_PARAM}=mot-de-passe-modifie`
    );
    expect(loginPathAfterSignOut("https://exemple.org")).toBe("/login");
    expect(loginPathAfterSignOut(null)).toBe("/login");
  });

  it("annonce l'adresse confirmée et l'ouverture du portail client (tranche 11)", () => {
    expect(loginNoticeFor("adresse-confirmee")).toMatch(/adresse est confirmée/);
    expect(loginNoticeFor("portail-client-ouvert")).toMatch(/portail client/);
    expect(loginPathAfterSignOut("portail-client-ouvert")).toBe(`/login?${LOGIN_NOTICE_PARAM}=portail-client-ouvert`);
  });
});
