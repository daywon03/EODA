import { describe, expect, it } from "vitest";
import {
  buildAccompanimentRequestEmail,
  buildDevisReminderEmail,
  buildProspectReminderEmail,
  buildSelfServiceExistingAccountEmail,
  buildEmailConfirmationEmail,
} from "./commercial-templates";
import { buildDevisEmail } from "./templates";

const brand = { logoUrl: "https://app.example.org/logo-eoda.png" };
const hostile = "SAD <script>alert(1)</script> (fictif)";

describe("relance d'un devis", () => {
  it("nomme le devis et la structure, échappe les saisies, ne dit aucun montant", () => {
    const mail = buildDevisReminderEmail({
      structureName: hostile,
      devisNumber: "DEVIS-2026-014",
      senderName: "EODA Conseil",
      validUntil: new Date(2026, 9, 31),
      brand,
    });
    expect(mail.subject).toBe("Votre devis DEVIS-2026-014 — EODA Conseil");
    expect(mail.html).toContain("DEVIS-2026-014");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toMatch(/\d\s?€/);
  });
});

describe("note pour la structure dans l'envoi du devis", () => {
  it("reprend la note, échappée ; rien sans note", () => {
    const base = { structureName: "SAD Les Glycines (fictif)", devisNumber: "DEVIS-2026-001", senderName: "EODA", validUntil: new Date(2026, 9, 31) };
    expect(buildDevisEmail({ ...base, clientNote: "<b>Après l'appel</b>" }).html).toContain("&lt;b&gt;Après l&#39;appel&lt;/b&gt;");
    expect(buildDevisEmail({ ...base, clientNote: "   " }).html).not.toContain("padding:12px 16px;background");
  });
});

describe("inscription en libre-service", () => {
  it("confirmation : lien de confirmation, durée dite, rappel « pas une évaluation officielle »", () => {
    const mail = buildEmailConfirmationEmail({
      firstName: "Nadia (fictif)",
      structureName: hostile,
      confirmUrl: "https://app.example.org/confirmer-email/abc",
      validityHours: 24,
      brand,
    });
    expect(mail.subject).toBe("Confirmez votre adresse e-mail — EODA");
    expect(mail.html).toContain("https://app.example.org/confirmer-email/abc");
    expect(mail.html).toContain("valable 24 heures");
    expect(mail.html).toContain("pas une\n      évaluation officielle de la HAS");
    expect(mail.html).not.toContain("<script>");
  });

  it("confirmation sans prénom ni structure (renvoi du lien) : formule neutre", () => {
    const mail = buildEmailConfirmationEmail({ firstName: null, structureName: null, confirmUrl: "https://app.example.org/x", validityHours: 24 });
    expect(mail.html).toContain("Bonjour,");
    expect(mail.html).toContain("Votre espace est créé");
  });

  it("compte existant : aucun détail sur le compte, seulement un lien de connexion", () => {
    const mail = buildSelfServiceExistingAccountEmail({ loginUrl: "https://app.example.org/login", brand });
    expect(mail.subject).toBe("Votre compte EODA existe déjà");
    expect(mail.html).toContain("aucun nouvel espace n'a été créé");
  });
});

describe("alerte « être accompagné » au cabinet", () => {
  it("dit le jour et le moment, jamais le message de la structure", () => {
    const mail = buildAccompanimentRequestEmail({
      structureName: "SAD Les Coquelicots (fictif)",
      preferredDay: new Date(2026, 9, 16),
      momentLabel: "le matin",
      prospectUrl: "https://app.example.org/dashboard/cabinet/commercial/prospects/p1",
    });
    expect(mail.subject).toBe("Demande d'accompagnement — SAD Les Coquelicots (fictif)");
    expect(mail.html).toContain("16 octobre 2026");
    expect(mail.html).toContain("le matin");
    expect(mail.html).toContain("/prospects/p1");
  });
});

describe("relance d'une structure inscrite", () => {
  it("invite à reprendre le diagnostic", () => {
    const mail = buildProspectReminderEmail({
      firstName: "Nadia (fictif)",
      structureName: "SAD Les Glycines (fictif)",
      loginUrl: "https://app.example.org/login",
    });
    expect(mail.subject).toBe("Votre diagnostic vous attend");
    expect(mail.html).toContain("Reprendre mon diagnostic");
  });
});
