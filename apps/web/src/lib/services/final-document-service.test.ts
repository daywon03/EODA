import { describe, expect, it } from "vitest";
import { buildCoverPage, prepareFinalDocumentMarkdown, stripCriteriaInserts } from "./final-document-service";

// E2 / E3 (call du 09/11/2026) : le document FINAL remis à la structure ne porte plus
// les critères HAS (ils passent sur une page de garde EODA détachable), et sa version
// et sa date sont écrites par la plateforme.

const TODAY = new Date("2026-11-10T10:00:00Z");

describe("stripCriteriaInserts — les encarts « critères HAS » sortent du corps", () => {
  it("retire une section titrée « Critères HAS couverts » jusqu'au titre suivant de même niveau", () => {
    const markdown = [
      "# Livret d'accueil",
      "## Critères HAS couverts",
      "- 1.1.1 — Droits",
      "- 3.12.1 — Plaintes",
      "## 1. Présentation du service",
      "Le service intervient à domicile.",
    ].join("\n");
    expect(stripCriteriaInserts(markdown)).toBe(
      ["# Livret d'accueil", "## 1. Présentation du service", "Le service intervient à domicile."].join("\n")
    );
  });

  it("une sous-section de critères n'emporte pas la section suivante de niveau supérieur", () => {
    const markdown = "## 2. Plaintes\nTexte.\n### Critères concernés\n3.12.1, 3.12.2\n## 3. Suite\nSuite.";
    expect(stripCriteriaInserts(markdown)).toBe("## 2. Plaintes\nTexte.\n## 3. Suite\nSuite.");
  });

  it("retire les lignes « Critères HAS : … » et l'encadré « Ce document couvre aussi les critères »", () => {
    const markdown = [
      "# Règlement",
      "**Critères HAS couverts :** 1.2.5, 3.12.2",
      "> Ce document couvre aussi les critères 2.2.7 et 3.13.2.",
      "Critère HAS : 3.12.1",
      "Article 1 — Objet",
    ].join("\n");
    expect(stripCriteriaInserts(markdown)).toBe("# Règlement\nArticle 1 — Objet");
  });

  it("ne retire pas une phrase qui parle des critères dans le texte", () => {
    const markdown = "Les critères d'admission du service sont les suivants :\n- résider dans la commune";
    expect(stripCriteriaInserts(markdown)).toBe(markdown);
  });

  it("un document sans encart est rendu tel quel", () => {
    expect(stripCriteriaInserts("# Titre\n\nTexte.")).toBe("# Titre\n\nTexte.");
  });
});

describe("prepareFinalDocumentMarkdown — encarts retirés, puis version et date de la plateforme", () => {
  it("document ordinaire : encarts retirés, version et date écrites", () => {
    const prepared = prepareFinalDocumentMarkdown("# Procédure\nVersion : 1\n## Critères HAS couverts\n- 3.12.1\n## Objet\nTexte.", {
      identityRule: "PLATFORM_STAMP",
      previousVersionLabel: "1",
      today: TODAY,
    });
    expect(prepared.markdown).toBe("# Procédure\nVersion : 1.1\nDate de mise à jour : 10/11/2026\n## Objet\nTexte.");
    expect(prepared.identity).toMatchObject({ version: "1.1", date: "10/11/2026" });
  });

  it("fiche de sensibilisation : la date de dépôt fait foi, aucun bloc ajouté", () => {
    const prepared = prepareFinalDocumentMarkdown("# Fiche — plaintes\nCritères HAS : 3.12.1\nVous pouvez…", {
      identityRule: "UPLOAD_DATE",
      previousVersionLabel: "1",
      today: TODAY,
    });
    expect(prepared.markdown).toBe("# Fiche — plaintes\nVous pouvez…");
    expect(prepared.identity).toBeNull();
  });
});

describe("buildCoverPage — page de garde EODA", () => {
  it("liste les critères rattachés au type, triés par code, et porte la paternité", () => {
    const cover = buildCoverPage({
      documentLabel: "Livret d'accueil",
      establishmentName: "Structure Exemple",
      criteria: [
        { code: "3.12.1", label: "Plaintes et réclamations" },
        { code: "1.10.2", label: "Expression" },
        { code: "1.2.5", label: "Droits" },
      ],
    });
    expect(cover.title).toBe("Livret d'accueil");
    expect(cover.criteria.map((c) => c.code)).toEqual(["1.2.5", "1.10.2", "3.12.1"]);
    expect(cover.coverageHeading).toBe("Ce que couvre ce document");
    expect(cover.coverageText).toContain("3 critères");
    expect(cover.detachNote).toMatch(/se détache/);
    expect(cover.ownershipMention).toContain("Structure Exemple");
  });

  it("sans critère rattaché, la page le dit au lieu de rester vide", () => {
    const cover = buildCoverPage({ documentLabel: "Note de service", establishmentName: "S", criteria: [] });
    expect(cover.criteria).toEqual([]);
    expect(cover.coverageText).toMatch(/aucun critère/i);
  });
});
