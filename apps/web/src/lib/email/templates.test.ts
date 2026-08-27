import { describe, expect, it } from "vitest";
import { buildClientInvitationEmail, buildOptionRequestEmail, escapeHtml } from "./templates";

describe("escapeHtml", () => {
  it("neutralise une balise injectée dans un champ de saisie", () => {
    // Un nom de structure vient d'une saisie : collé brut dans du HTML, il y injecte
    // ce qu'on veut. Un e-mail n'est pas moins une surface qu'une page.
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
});

describe("buildClientInvitationEmail", () => {
  const invitation = buildClientInvitationEmail({
    recipientName: "Tania Leborgne",
    email: "tania@structure.fr",
    temporaryPassword: "Xk7-mots-de-passe",
    loginUrl: "https://portail.eoda-conseil.com/login",
    establishmentName: "ASSAD BENOIT",
  });

  it("nomme la structure dans l'objet — la personne accompagne peut en suivre plusieurs", () => {
    expect(invitation.subject).toContain("ASSAD BENOIT");
  });

  it("donne l'identifiant, le mot de passe temporaire et le lien", () => {
    expect(invitation.html).toContain("tania@structure.fr");
    expect(invitation.html).toContain("Xk7-mots-de-passe");
    expect(invitation.html).toContain("https://portail.eoda-conseil.com/login");
  });

  it("annonce que le mot de passe devra être changé", () => {
    // La plateforme l'impose de toute façon (guards.ts) : le dire évite le ticket
    // « ça me redemande un mot de passe ».
    expect(invitation.html).toContain("temporaire");
  });

  it("échappe le nom de la structure", () => {
    const hostile = buildClientInvitationEmail({
      recipientName: "X",
      email: "x@y.fr",
      temporaryPassword: "abc",
      loginUrl: "https://x",
      establishmentName: '<img src=x onerror="alert(1)">',
    });
    expect(hostile.html).not.toContain("<img src=x");
    expect(hostile.html).toContain("&lt;img");
  });
});

describe("buildOptionRequestEmail", () => {
  const alert = buildOptionRequestEmail({
    establishmentName: "ASSAD BENOIT",
    optionLabel: "Audit de conformité flash",
    message: "On aimerait le faire avant la visite.",
    requestedByName: "Tania Leborgne",
    requestUrl: "https://portail.eoda-conseil.com/dashboard/cabinet/commercial",
  });

  it("dit qui demande quoi, dès l'objet", () => {
    expect(alert.subject).toContain("ASSAD BENOIT");
    expect(alert.subject).toContain("Audit de conformité flash");
  });

  it("reprend le message du client et renvoie vers l'outil", () => {
    expect(alert.html).toContain("On aimerait le faire avant la visite.");
    expect(alert.html).toContain("/dashboard/cabinet/commercial");
  });

  it("se passe du bloc citation quand aucun message n'a été laissé", () => {
    const withoutMessage = buildOptionRequestEmail({
      establishmentName: "ASSAD BENOIT",
      optionLabel: "Audit",
      message: "   ",
      requestedByName: "Tania",
      requestUrl: "https://x",
    });
    expect(withoutMessage.html).not.toContain("blockquote");
  });

  it("échappe le message du client", () => {
    const hostile = buildOptionRequestEmail({
      establishmentName: "S",
      optionLabel: "O",
      message: "<script>alert(1)</script>",
      requestedByName: "T",
      requestUrl: "https://x",
    });
    expect(hostile.html).not.toContain("<script>");
  });
});
