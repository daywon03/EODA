import { describe, expect, it } from "vitest";
import {
  documentIdentityRule,
  formatLikeSample,
  isAwarenessSheetType,
  nextDocumentVersion,
  stampDocumentIdentity,
} from "./document-identity-service";

describe("documentIdentityRule — la fiche de sensibilisation garde sa date de dépôt (provisoire)", () => {
  it.each(["PA_FICHE_P1_PLAINTES", "PA_FICHE_P5_DONNEES", "QUALITE_FICHE_SENSIBILISATION"])("%s : date de dépôt", (code) => {
    expect(documentIdentityRule({ code, folderId: null })).toBe("UPLOAD_DATE");
  });

  it("une ligne du cabinet rangée dans un dossier « Sensibilisation… » est une fiche", () => {
    expect(isAwarenessSheetType({ code: "EODA_FICHE_CHUTES", folderId: "docfolder-sensibilisation-pro" })).toBe(true);
    expect(isAwarenessSheetType({ code: "EODA_FICHE_X", folderId: "docfolder-sensibilisation-pa" })).toBe(true);
  });

  it("tout autre document reçoit la version et la date de la plateforme", () => {
    expect(documentIdentityRule({ code: "L2002_LIVRET_ACCUEIL", folderId: null })).toBe("PLATFORM_STAMP");
    expect(documentIdentityRule({ code: "P12_PROCEDURE", folderId: "docfolder-process-has" })).toBe("PLATFORM_STAMP");
  });
});

// E3 (call du 09/11/2026, Sandrine sur la FAMO) : « la version proposée affiche
// 11/10/2026 au lieu d'aujourd'hui, et la version devrait passer en 1.1 ». La
// PLATEFORME écrit la version suivante et la date du jour à l'enregistrement de la
// version N+1 — l'IA n'y touche toujours pas (correction-proposal.test.ts).

// 10/11/2026 à 23 h 30 à Paris = 22 h 30 UTC : la date du jour se lit à PARIS.
const TODAY = new Date("2026-11-10T22:30:00Z");
const LATE_EVENING_UTC = new Date("2026-11-10T23:30:00Z"); // déjà le 11/11 à Paris

describe("nextDocumentVersion — règle d'incrément", () => {
  it.each([
    ["1", "1.1"],
    ["1.1", "1.2"],
    ["1.0", "1.1"],
    ["1.9", "1.10"],
    ["V2", "V2.1"],
    ["v1.0", "v1.1"],
    ["V 3", "V 3.1"],
    ["02", "02.1"],
    ["1,2", "1,3"],
    ["2.3.4", "2.3.5"],
  ])("%s → %s", (previous, next) => {
    expect(nextDocumentVersion(previous)).toBe(next);
  });

  it("une valeur qui n'est pas un numéro de version repart de 1.1, jamais d'une invention", () => {
    expect(nextDocumentVersion("[À compléter : version ou date]")).toBe("1.1");
    expect(nextDocumentVersion("")).toBe("1.1");
  });
});

describe("formatLikeSample — la date du jour au format du document", () => {
  it.each([
    ["11/10/2026", "10/11/2026"],
    ["1/9/2026", "10/11/2026"],
    ["11-10-2026", "10-11-2026"],
    ["11.10.2026", "10.11.2026"],
    ["11/10/26", "10/11/26"],
    ["2026-10-11", "2026-11-10"],
    ["11 octobre 2026", "10 novembre 2026"],
    ["1er Octobre 2026", "10 Novembre 2026"],
    ["octobre 2026", "novembre 2026"],
    ["Octobre 2026", "Novembre 2026"],
  ])("%s → %s", (sample, expected) => {
    expect(formatLikeSample(sample, TODAY)).toBe(expected);
  });

  it("le jour se lit à Paris, pas en UTC", () => {
    expect(formatLikeSample("11/10/2026", LATE_EVENING_UTC)).toBe("11/11/2026");
  });

  it("le premier du mois s'écrit « 1er » au format long", () => {
    expect(formatLikeSample("11 octobre 2026", new Date("2026-12-01T10:00:00Z"))).toBe("1er décembre 2026");
  });

  it("un échantillon illisible donne JJ/MM/AAAA", () => {
    expect(formatLikeSample("[À compléter : version ou date]", TODAY)).toBe("10/11/2026");
  });
});

describe("stampDocumentIdentity — bloc d'identification en tête", () => {
  it("remplace version ET date dans le bloc repéré par ses libellés (cas de la FAMO)", () => {
    const text = [
      "# Mode opératoire — fiche d'appel",
      "**Version :** 1",
      "**Date de mise à jour :** 11/10/2026",
      "",
      "## Objet",
      "Décrire l'accueil téléphonique, version 3 du logiciel, depuis le 01/02/2020.",
    ].join("\n");
    const stamped = stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY });
    expect(stamped.text).toBe(
      [
        "# Mode opératoire — fiche d'appel",
        "**Version :** 1.1",
        "**Date de mise à jour :** 10/11/2026",
        "",
        "## Objet",
        // Le corps n'est jamais touché : seule l'en-tête est réécrite.
        "Décrire l'accueil téléphonique, version 3 du logiciel, depuis le 01/02/2020.",
      ].join("\n")
    );
    expect(stamped).toMatchObject({ version: "1.1", date: "10/11/2026", added: false });
  });

  it("reconnaît « Dernière mise à jour », « Version V2 » et le format long", () => {
    const text = "Livret d'accueil\nVersion V2\nDernière mise à jour : 11 octobre 2026\n\nBienvenue.";
    expect(stampDocumentIdentity(text, { previousVersionLabel: "2", today: TODAY }).text).toBe(
      "Livret d'accueil\nVersion V2.1\nDernière mise à jour : 10 novembre 2026\n\nBienvenue."
    );
  });

  it("une ligne qui porte version et date ensemble (« Version 02 — 19 juillet 2026 »)", () => {
    const text = "MODE OPÉRATOIRE EODA\nVersion 02 — 19 juillet 2026\n\nTexte.";
    expect(stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY }).text).toBe(
      "MODE OPÉRATOIRE EODA\nVersion 02.1 — 10 novembre 2026\n\nTexte."
    );
  });

  it("lit une cellule de tableau (libellé sur une ligne, valeur sur la suivante)", () => {
    const text = "Procédure plaintes\n\nVersion\n\n1.0\n\nDate de mise à jour\n\n11/10/2026\n\n## 1. Objet";
    expect(stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY }).text).toBe(
      "Procédure plaintes\n\nVersion\n\n1.1\n\nDate de mise à jour\n\n10/11/2026\n\n## 1. Objet"
    );
  });

  it("remplit le champ à compléter laissé par la garde de l'IA", () => {
    const text = "# Règlement\nVersion : [À compléter : version ou date]\nDate de mise à jour : [À compléter : version ou date]";
    expect(stampDocumentIdentity(text, { previousVersionLabel: "3", today: TODAY }).text).toBe(
      "# Règlement\nVersion : 3.1\nDate de mise à jour : 10/11/2026"
    );
  });

  it("ne touche ni la date de prochaine révision, ni la date de création", () => {
    const text = [
      "# Projet de service",
      "Version : 1.2",
      "Date de création : 01/01/2024",
      "Date de mise à jour : 11/10/2026",
      "Date de prochaine révision : 11/10/2027",
      "Prochaine mise à jour : 11/10/2027",
    ].join("\n");
    expect(stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY }).text).toBe(
      [
        "# Projet de service",
        "Version : 1.3",
        "Date de création : 01/01/2024",
        "Date de mise à jour : 10/11/2026",
        "Date de prochaine révision : 11/10/2027",
        "Prochaine mise à jour : 11/10/2027",
      ].join("\n")
    );
  });

  it("une version sans date : la date du jour est ajoutée sous la version", () => {
    const text = "# Charte\nVersion : 4\n\nArticle 1.";
    expect(stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY }).text).toBe(
      "# Charte\nVersion : 4.1\nDate de mise à jour : 10/11/2026\n\nArticle 1."
    );
  });

  it("une date sans version : la version est ajoutée au-dessus, à partir de la version connue", () => {
    const text = "# Charte\nMise à jour le 11/10/2026\n\nArticle 1.";
    expect(stampDocumentIdentity(text, { previousVersionLabel: "2", today: TODAY }).text).toBe(
      "# Charte\nVersion : 2.1\nMise à jour le 10/11/2026\n\nArticle 1."
    );
  });

  it("sans bloc : une ligne d'identification normalisée sous le titre", () => {
    const text = "# Procédure d'accueil\n\nLe service accueille…";
    const stamped = stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY });
    expect(stamped.text).toBe(
      "# Procédure d'accueil\n\n**Version :** 1.1 · **Date de mise à jour :** 10/11/2026\n\nLe service accueille…"
    );
    expect(stamped.added).toBe(true);
  });

  it("sans titre ni bloc : la ligne normalisée en toute première ligne", () => {
    expect(stampDocumentIdentity("Le service accueille…", { previousVersionLabel: "1", today: TODAY }).text).toBe(
      "**Version :** 1.1 · **Date de mise à jour :** 10/11/2026\n\nLe service accueille…"
    );
  });

  it("une « version » citée loin dans le corps n'est pas un bloc d'identification", () => {
    const body = Array.from({ length: 50 }, (_, i) => `Paragraphe ${i + 1}.`).join("\n\n");
    const text = `# Procédure\n\n${body}\n\nVersion : 7`;
    const stamped = stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY });
    expect(stamped.text.endsWith("Version : 7")).toBe(true);
    expect(stamped.added).toBe(true);
  });

  it("une phrase qui contient le mot « version » n'est pas un libellé", () => {
    const text = "# Note\nLa version papier du livret est remise le 11/10/2026 à chaque personne.";
    const stamped = stampDocumentIdentity(text, { previousVersionLabel: "1", today: TODAY });
    expect(stamped.text).toContain("La version papier du livret est remise le 11/10/2026");
    expect(stamped.added).toBe(true);
  });
});
