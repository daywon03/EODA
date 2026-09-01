import { describe, expect, it } from "vitest";
import {
  buildClientInvitationEmail,
  buildDocumentReminderEmail,
  buildOptionRequestEmail,
  escapeHtml,
} from "./templates";

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

describe("logo dans l'en-tête", () => {
  it("affiche le logo quand une URL absolue est fournie", () => {
    // Un client de messagerie ne connaît pas le domaine de l'application : une URL
    // relative ne mène nulle part.
    const withLogo = buildClientInvitationEmail({
      recipientName: "T",
      email: "t@x.fr",
      temporaryPassword: "abc",
      loginUrl: "https://x/login",
      establishmentName: "S",
      brand: { logoUrl: "https://portail.eoda-conseil.com/logo-eoda.png" },
    });
    expect(withLogo.html).toContain("https://portail.eoda-conseil.com/logo-eoda.png");
    expect(withLogo.html).toContain('alt="EODA conseil"');
  });

  it("retombe sur le nom en toutes lettres sans URL de logo", () => {
    // Une image cassée en tête d'e-mail fait plus de dégâts qu'une ligne de texte.
    const withoutLogo = buildOptionRequestEmail({
      establishmentName: "S",
      optionLabel: "O",
      message: null,
      requestedByName: "T",
      requestUrl: "https://x",
    });
    expect(withoutLogo.html).not.toContain("<img");
    expect(withoutLogo.html).toContain("EODA Conseil");
  });
});

describe("buildDocumentReminderEmail", () => {
  const base = {
    recipientName: "Camille Martin",
    establishmentName: "Structure test",
    missingLabels: ["Projet de service", "DIPC"],
    message: null,
    portalUrl: "https://portail.test/dashboard/client",
  };

  it("liste les pièces DANS le message", () => {
    // Renvoyer « connectez-vous pour voir ce qui manque » ajoute une étape à
    // quelqu'un qui n'a déjà pas trouvé le temps de déposer.
    const email = buildDocumentReminderEmail(base);
    expect(email.html).toContain("Projet de service");
    expect(email.html).toContain("DIPC");
  });

  it("annonce le nombre de pièces dans l'objet, accordé", () => {
    expect(buildDocumentReminderEmail(base).subject).toContain("(2 pièces)");
    expect(
      buildDocumentReminderEmail({ ...base, missingLabels: ["DIPC"] }).subject
    ).toContain("(1 pièce)");
  });

  it("échappe un intitulé et un message venus d'une saisie", () => {
    const email = buildDocumentReminderEmail({
      ...base,
      missingLabels: ['<img src=x onerror="alert(1)">'],
      message: "<script>alert(2)</script>",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("rappelle qu'un document non concerné se justifie depuis l'espace", () => {
    // Sans cette phrase, la seule réponse possible à une relance est le silence.
    expect(buildDocumentReminderEmail(base).html).toContain("ne concerne pas votre structure");
  });

  it("n'affiche aucun bloc de citation sans message", () => {
    expect(buildDocumentReminderEmail(base).html).not.toContain("blockquote");
  });
});
