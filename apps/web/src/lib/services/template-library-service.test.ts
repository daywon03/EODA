import { describe, expect, it } from "vitest";
import {
  buildTemplateStorageKey,
  compareVersionLabelsDesc,
  normaliseVersionLabel,
  templateDownloadFilename,
  TEMPLATE_STAGES,
  versionLabelError,
} from "./template-library-service";

describe("normaliseVersionLabel", () => {
  it("ramène les écritures courantes à une seule forme", () => {
    // Sans ça, « v1.2 », « V1.2 », « 1.2 » et « version 1.2 » désignent le même
    // fichier sous quatre libellés, et la contrainte d'unicité ne protège plus rien.
    for (const written of ["v1.2", "V1.2", "1.2", "version 1.2", " V 1.2 "]) {
      expect(normaliseVersionLabel(written)).toBe("v1.2");
    }
  });

  it("laisse vide ce qui est vide", () => {
    expect(normaliseVersionLabel("   ")).toBe("");
  });
});

describe("versionLabelError", () => {
  it("exige un numéro", () => {
    expect(versionLabelError("")).toContain("obligatoire");
  });

  it("accepte une, deux ou trois composantes", () => {
    expect(versionLabelError("v1")).toBeNull();
    expect(versionLabelError("v1.2")).toBeNull();
    expect(versionLabelError("v1.2.3")).toBeNull();
  });

  it("refuse ce qui n'est pas un numéro de version", () => {
    expect(versionLabelError("vfinale")).toContain("v1.2");
    expect(versionLabelError("v1.")).toContain("v1.2");
  });
});

describe("compareVersionLabelsDesc", () => {
  it("compare segment par segment, pas alphabétiquement", () => {
    // Le piège : en tri de chaînes, « v10 » passe avant « v9 ». Il ne se voit qu'au
    // dixième document, quand la bibliothèque est déjà remplie.
    expect(["v9", "v10", "v2"].sort(compareVersionLabelsDesc)).toEqual(["v10", "v9", "v2"]);
  });

  it("traite les composantes manquantes comme des zéros", () => {
    expect(compareVersionLabelsDesc("v1.1", "v1")).toBeLessThan(0);
    expect(compareVersionLabelsDesc("v1", "v1.0")).toBe(0);
  });
});

describe("buildTemplateStorageKey", () => {
  it("préfixe par « modeles/ » — jamais l'espace d'un établissement", () => {
    const key = buildTemplateStorageKey({
      templateDocumentId: "tpl_1",
      stage: "VIERGE",
      versionLabel: "v1.2",
      originalFilename: "projet.docx",
      timestamp: 1_700_000_000_000,
    });
    expect(key.startsWith("modeles/tpl_1/")).toBe(true);
  });

  it("n'écrit jamais le nom d'origine tel quel", () => {
    // « ../../ » dans un nom de fichier échapperait au préfixe : écriture hors racine
    // sur le stockage local, écrasement d'un objet voisin sur un stockage S3.
    const key = buildTemplateStorageKey({
      templateDocumentId: "tpl_1",
      stage: "FINALE",
      versionLabel: "v1",
      originalFilename: "../../etc/passwd",
      timestamp: 1,
    });
    expect(key).not.toContain("..");
    expect(key.split("/")).toHaveLength(3);
  });
});

describe("templateDownloadFilename", () => {
  it("suit la convention de nommage EODA, sans nom de client", () => {
    // Un modèle n'a pas de client — c'est ce qui le distingue d'un livrable — d'où
    // « EODA » à la place, et « Interne » : un gabarit ne sort pas du cabinet.
    expect(
      templateDownloadFilename({
        title: "Projet de service",
        stage: "VIERGE",
        versionLabel: "v1.2",
        originalFilename: "projet.docx",
        createdAt: new Date(2026, 8, 3),
      })
    ).toBe("20260903_MODELE_EODA_Projet-de-service_VIERGE_v1.2_Interne.docx");
  });
});

describe("TEMPLATE_STAGES", () => {
  it("suit le cycle de production, pas l'ordre alphabétique", () => {
    expect([...TEMPLATE_STAGES]).toEqual(["VIERGE", "INITIALE", "FINALE"]);
  });
});
