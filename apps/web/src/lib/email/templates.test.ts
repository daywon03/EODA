import { describe, expect, it } from "vitest";
import {
  buildCabinetInvitationEmail,
  buildClientInvitationEmail,
  buildDocumentAvailableEmail,
  buildDocumentReminderEmail,
  buildNewDocumentTypeEmail,
  buildOptionRequestEmail,
  buildStructureActivityEmail,
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
    recipientName: "Camille Durand",
    email: "camille@structure.fr",
    temporaryPassword: "Xk7-mots-de-passe",
    loginUrl: "https://portail.eoda-conseil.com/login",
    establishmentName: "SAD Les Glycines (fictif)",
  });

  it("nomme la structure dans l'objet — la personne accompagne peut en suivre plusieurs", () => {
    expect(invitation.subject).toContain("SAD Les Glycines (fictif)");
  });

  it("donne l'identifiant, le mot de passe temporaire et le lien", () => {
    expect(invitation.html).toContain("camille@structure.fr");
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
    establishmentName: "SAD Les Glycines (fictif)",
    optionLabel: "Audit de conformité flash",
    message: "On aimerait le faire avant la visite.",
    requestedByName: "Camille Durand",
    requestUrl: "https://portail.eoda-conseil.com/dashboard/cabinet/commercial",
  });

  it("dit qui demande quoi, dès l'objet", () => {
    expect(alert.subject).toContain("SAD Les Glycines (fictif)");
    expect(alert.subject).toContain("Audit de conformité flash");
  });

  it("reprend le message du client et renvoie vers l'outil", () => {
    expect(alert.html).toContain("On aimerait le faire avant la visite.");
    expect(alert.html).toContain("/dashboard/cabinet/commercial");
  });

  it("se passe du bloc citation quand aucun message n'a été laissé", () => {
    const withoutMessage = buildOptionRequestEmail({
      establishmentName: "SAD Les Glycines (fictif)",
      optionLabel: "Audit",
      message: "   ",
      requestedByName: "Camille",
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

describe("buildCabinetInvitationEmail", () => {
  const invitation = buildCabinetInvitationEmail({
    recipientName: "Consultante <fictive>",
    email: "consultante@example.org",
    temporaryPassword: "Xk7-mots-de-passe",
    loginUrl: "https://portail.example.org/login",
    roleLabel: "Consultante",
  });

  it("nomme le rôle, donne l'identifiant, le mot de passe temporaire et le lien", () => {
    expect(invitation.html).toContain("Consultante</strong>");
    expect(invitation.html).toContain("consultante@example.org");
    expect(invitation.html).toContain("Xk7-mots-de-passe");
    expect(invitation.html).toContain("https://portail.example.org/login");
    expect(invitation.html).toContain("Ouvrir le portail");
  });

  it("échappe le nom saisi", () => {
    expect(invitation.html).toContain("Consultante &lt;fictive&gt;");
  });
});

describe("buildDocumentAvailableEmail", () => {
  const base = {
    recipientName: "Camille Martin",
    establishmentName: "Structure test",
    documentLabel: "Livret d'accueil",
    kind: "DELIVERABLE" as const,
    portalUrl: "https://portail.test/dashboard/client/livrables",
  };

  it("nomme le document dans l'objet — la personne doit savoir LEQUEL a été déposé", () => {
    expect(buildDocumentAvailableEmail(base).subject).toBe(
      "Nouveau livrable disponible — Livret d'accueil"
    );
  });

  it("renvoie vers « Mes livrables » pour un document produit par EODA", () => {
    const email = buildDocumentAvailableEmail(base);
    expect(email.html).toContain("Mes livrables");
    expect(email.html).toContain("https://portail.test/dashboard/client/livrables");
  });

  it("n'annonce pas un livrable quand c'est la pièce du client qui a été validée", () => {
    // EODA n'a rien remis : parler de « livrable » gonflerait la prestation.
    const email = buildDocumentAvailableEmail({ ...base, kind: "VALIDATED_PIECE" });
    expect(email.subject).toBe("Document validé — Livret d'accueil");
    expect(email.html).not.toContain("Mes livrables");
    expect(email.html).toContain("https://portail.test/dashboard/client/livrables");
  });

  it("échappe un intitulé et un nom de structure venus d'une saisie", () => {
    const email = buildDocumentAvailableEmail({
      ...base,
      documentLabel: '<img src=x onerror="alert(1)">',
      establishmentName: "<script>alert(2)</script>",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<script>");
  });
});

// Ce que la STRUCTURE fait → le cabinet (16/10/2026). Le pendant des trois messages
// ci-dessus : jusqu'ici le cabinet informait le client, jamais l'inverse.
describe("buildStructureActivityEmail", () => {
  const base = {
    establishmentName: "Structure test",
    documentLabel: "Livret d'accueil",
    structureUrl: "https://portail.test/dashboard/cabinet/etablissements/etab-1",
  };

  it("nomme le document dans l'objet des trois gestes — lequel, jamais un « un document »", () => {
    expect(buildStructureActivityEmail({ ...base, kind: "DEPOSIT" }).subject).toBe(
      "Dépôt de la structure — Livret d'accueil"
    );
    expect(buildStructureActivityEmail({ ...base, kind: "ACCEPTED" }).subject).toBe(
      "Document accepté par la structure — Livret d'accueil"
    );
    expect(buildStructureActivityEmail({ ...base, kind: "DECLARED_MISSING" }).subject).toBe(
      "Pièce absente — Livret d'accueil"
    );
  });

  it("un dépôt annonce une pièce à RELIRE, pas une pièce validée", () => {
    const email = buildStructureActivityEmail({ ...base, kind: "DEPOSIT" });
    expect(email.html).toContain("a déposé une pièce");
    expect(email.html).toContain("à relire");
    expect(email.html).not.toContain("accepté");
  });

  it("une acceptation dit qui a accepté, sans jamais parler de validation EODA", () => {
    // Deux gestes distincts (décision du 08/10, « c'est lui qui valide, ce n'est pas
    // moi ») : écrire « validé » ici attribuerait au cabinet la parole de la structure.
    const email = buildStructureActivityEmail({ ...base, kind: "ACCEPTED" });
    expect(email.html).toContain("Structure test");
    expect(email.html).toContain("a accepté le document");
    expect(email.html).not.toContain("validé");
    expect(email.html).not.toContain("relu");
  });

  it("« je ne l'ai pas » est écrit comme une pièce À PRODUIRE, pas comme une absence", () => {
    // N3 : la structure déclare l'absence, le document reste à produire par EODA.
    const email = buildStructureActivityEmail({ ...base, kind: "DECLARED_MISSING" });
    expect(email.html).toContain("ne pas disposer");
    expect(email.html).toContain("reste à produire");
    expect(email.html).not.toContain("non concerné");
  });

  it("mène à la fiche de la structure, jamais à un fichier", () => {
    for (const kind of ["DEPOSIT", "ACCEPTED", "DECLARED_MISSING"] as const) {
      const email = buildStructureActivityEmail({ ...base, kind });
      expect(email.html).toContain(base.structureUrl);
    }
  });

  it("échappe un intitulé et un nom de structure venus d'une saisie", () => {
    const email = buildStructureActivityEmail({
      ...base,
      kind: "DEPOSIT",
      documentLabel: '<img src=x onerror="alert(1)">',
      establishmentName: "<script>alert(2)</script>",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<script>");
  });
});

describe("buildNewDocumentTypeEmail", () => {
  const base = {
    recipientName: "Camille Martin",
    establishmentName: "Structure test",
    documentLabel: "Plan de continuité <d'activité>",
    portalUrl: "https://portail.test/dashboard/client",
  };

  it("dit à la structure si le document lui est demandé ou si EODA le prépare", () => {
    const requested = buildNewDocumentTypeEmail({ ...base, requestedFromClient: true });
    const produced = buildNewDocumentTypeEmail({ ...base, requestedFromClient: false });
    expect(requested.subject).toBe("Nouveau document à déposer — Plan de continuité <d'activité>");
    expect(requested.html).toContain("Il vous est demandé");
    expect(produced.subject).toBe("Nouveau document préparé par EODA — Plan de continuité <d'activité>");
    expect(produced.html).toContain("Vous n'avez rien à faire");
  });

  it("échappe l'intitulé dans le corps", () => {
    const { html } = buildNewDocumentTypeEmail({ ...base, requestedFromClient: true });
    expect(html).toContain("&lt;d&#39;activité&gt;");
    expect(html).not.toContain("<d'activité>");
  });
});
