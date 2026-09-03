import { describe, expect, it } from "vitest";
import {
  buildTemplateStorageKey,
  categoryNameError,
  categoryNameKey,
  compareVersionLabelsDesc,
  detectStage,
  detectVersionLabel,
  markDuplicateLines,
  MAX_CATEGORY_NAME_LENGTH,
  normaliseCategoryName,
  normaliseVersionLabel,
  planFolderImport,
  templateDownloadFilename,
  titleFromFilename,
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

describe("nom de dossier", () => {
  it("normalise les espaces — deux dossiers ne doivent pas différer par une espace finale", () => {
    expect(normaliseCategoryName("  Phase 4   accompagnement  ")).toBe("Phase 4 accompagnement");
  });

  it("refuse un nom vide et un nom trop long", () => {
    expect(categoryNameError("")).toContain("obligatoire");
    expect(categoryNameError("x".repeat(MAX_CATEGORY_NAME_LENGTH + 1))).toContain("dépasser");
    expect(categoryNameError("Phase 0 — prise de contact")).toBeNull();
  });

  it("considère comme un seul dossier deux noms qui ne diffèrent que par la casse ou les accents", () => {
    // Sans ce repli, « Qualité » et « qualite » coexistent : deux dossiers pour une
    // seule idée, et la moitié des gabarits dans le mauvais.
    expect(categoryNameKey("Qualité")).toBe(categoryNameKey("QUALITE"));
    expect(categoryNameKey("Phase 4 ")).toBe(categoryNameKey("phase 4"));
  });
});

describe("detectStage", () => {
  it("lit le stade dans le nom du fichier comme dans celui d'un sous-dossier", () => {
    expect(detectStage("Phase 4/livret vierge.docx")).toBe("VIERGE");
    expect(detectStage("Phase 4/vierges/livret.docx")).toBe("VIERGE");
    expect(detectStage("Phase 4/livret FINAL.docx")).toBe("FINALE");
    expect(detectStage("Phase 4/livret reçu du client.docx")).toBe("INITIALE");
  });

  it("ignore accents et casse", () => {
    expect(detectStage("Phase 4/livret corrigé.docx")).toBe("FINALE");
    expect(detectStage("Phase 4/LIVRET RECU.docx")).toBe("INITIALE");
  });

  it("tranche au mot le plus spécifique quand plusieurs se présentent", () => {
    // « livret vierge v1 final » : un fichier ne peut être qu'à un seul stade, il faut
    // bien trancher, et trancher au mot le plus rare se trompe le moins souvent.
    expect(detectStage("livret vierge v1 final.docx")).toBe("VIERGE");
  });

  it("ne devine rien quand rien ne le dit", () => {
    expect(detectStage("Phase 4/livret d'accueil.docx")).toBeNull();
  });
});

describe("detectVersionLabel", () => {
  it("lit un numéro préfixé", () => {
    expect(detectVersionLabel("livret v1.2.docx")).toBe("v1.2");
    // « V03 » reste « v03 » : le zéro vient de son écriture à elle, et la
    // comparaison des versions est numérique — « v03 » et « v3 » se rangent au même
    // endroit sans qu'il faille réécrire ce qu'elle a tapé.
    expect(detectVersionLabel("livret V03.docx")).toBe("v03");
    expect(detectVersionLabel("livret version 2.docx")).toBe("v2");
    expect(detectVersionLabel("livret_v1_2.docx")).toBe("v1.2");
  });

  it("EXIGE le préfixe — sinon une année devient un numéro de version", () => {
    // « Livret d'accueil 2024.docx » deviendrait la version 2024, et le tri des
    // versions cesserait de vouloir dire quoi que ce soit.
    expect(detectVersionLabel("Livret d'accueil 2024.docx")).toBeNull();
    expect(detectVersionLabel("livret.docx")).toBeNull();
  });
});

describe("titleFromFilename", () => {
  it("retire le numéro de version et le stade — sinon chaque version crée sa fiche", () => {
    // « livret v1 » et « livret v2 » doivent tomber sur LA MÊME fiche : c'est tout
    // l'intérêt d'un historique de versions.
    expect(titleFromFilename("livret d'accueil v1 final.docx")).toBe("livret d'accueil");
    expect(titleFromFilename("livret d'accueil v2 final.docx")).toBe("livret d'accueil");
  });

  it("garde le nom d'origine quand le nettoyage ne laisse rien", () => {
    expect(titleFromFilename("v1 final.docx")).toBe("v1 final");
  });
});

describe("planFolderImport", () => {
  it("range le premier dossier en catégorie et le dossier immédiat en fiche", () => {
    const [line] = planFolderImport([
      { relativePath: "Phase 4/Livret d'accueil/livret v1.2 final.docx", sizeBytes: 10 },
    ]);
    expect(line).toMatchObject({
      categoryName: "Phase 4",
      title: "Livret d'accueil",
      stage: "FINALE",
      stageDetected: true,
      versionLabel: "v1.2",
    });
  });

  it("nomme la fiche d'après le fichier quand il n'y a pas de sous-dossier", () => {
    const [line] = planFolderImport([
      { relativePath: "Phase 0/Projet de service.docx", sizeBytes: 10 },
    ]);
    expect(line?.categoryName).toBe("Phase 0");
    expect(line?.title).toBe("Projet de service");
  });

  it("propose VIERGE par défaut, en le SIGNALANT comme non deviné", () => {
    // La distinction n'est pas cosmétique : une valeur devinée et une valeur par
    // défaut n'appellent pas la même relecture avant confirmation.
    const [line] = planFolderImport([
      { relativePath: "Phase 4/Livret/livret.docx", sizeBytes: 10 },
    ]);
    expect(line?.stage).toBe("VIERGE");
    expect(line?.stageDetected).toBe(false);
    expect(line?.versionLabel).toBe("v1");
  });

  it("donne un dossier même à un fichier choisi hors arborescence", () => {
    // Sinon l'import échoue à la dernière ligne, faute d'endroit où ranger.
    const [line] = planFolderImport([{ relativePath: "manuel.pdf", sizeBytes: 10 }]);
    expect(line?.categoryName).toBe("Import sans dossier");
  });
});

describe("markDuplicateLines", () => {
  it("écarte le second fichier qui viserait la même fiche, le même stade et le même numéro", () => {
    // Le cas normal d'un dossier où « livret final.docx » et « livret final
    // (copie).docx » cohabitent. Écarté AVANT l'envoi, pas refusé par la base au
    // milieu de l'import, quand la moitié est déjà passée.
    const lines = planFolderImport([
      { relativePath: "Phase 4/Livret/livret v1 final.docx", sizeBytes: 10 },
      { relativePath: "Phase 4/Livret/livret v1 final copie.docx", sizeBytes: 10 },
      { relativePath: "Phase 4/Livret/livret v2 final.docx", sizeBytes: 10 },
    ]);
    expect(markDuplicateLines(lines)).toEqual([false, true, false]);
  });

  it("ne dédoublonne jamais un document de référence — il peut porter plusieurs fichiers", () => {
    const lines = planFolderImport([
      { relativePath: "Référentiel/Manuel/manuel.pdf", sizeBytes: 10 },
      { relativePath: "Référentiel/Manuel/manuel bis.pdf", sizeBytes: 10 },
    ]).map((line) => ({ ...line, stage: null, versionLabel: null }));
    expect(markDuplicateLines(lines)).toEqual([false, false]);
  });
});

describe("clé de stockage et nom de fichier sans stade", () => {
  it("nomme explicitement un document de référence plutôt que de laisser un trou", () => {
    const key = buildTemplateStorageKey({
      templateDocumentId: "abc",
      stage: null,
      versionLabel: null,
      originalFilename: "manuel HAS.pdf",
      timestamp: 1,
    });
    expect(key).toContain("REFERENCE");
    expect(key.startsWith("modeles/abc/")).toBe(true);

    const filename = templateDownloadFilename({
      title: "Manuel HAS",
      stage: null,
      versionLabel: null,
      originalFilename: "manuel.pdf",
      createdAt: new Date("2026-09-04T10:00:00"),
    });
    expect(filename).toBe("20260904_MODELE_EODA_Manuel-HAS_REFERENCE_Interne.pdf");
  });
});
