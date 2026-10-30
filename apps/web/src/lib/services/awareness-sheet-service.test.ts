import { describe, expect, it } from "vitest";
import { allAdmissionPoints } from "@/content/admission/explications";
import { DEPARTEMENT_TAMPON_CODE, DEPARTEMENT_CONTRAT_CODE } from "./awareness-sheet-links";
import { AWARENESS_SHEET_CODES, DEPARTEMENT_DOCUMENT_CODES, selectTabletStructureDocuments } from "./awareness-sheet-service";

const version = (id: string, versionNumber: number, day: string, producedByCabinet: boolean) => ({
  id,
  versionNumber,
  uploadedAt: new Date(`${day}T09:00:00Z`),
  producedByCabinet,
  originalFilename: `${id}.docx`,
});

describe("selectTabletStructureDocuments", () => {
  it("ne montre qu'une fiche à la validation À JOUR, version d'EODA d'abord", () => {
    const sheets = selectTabletStructureDocuments([
      { code: "PA_FICHE_P1_PLAINTES", validatedAt: new Date("2026-10-20T00:00:00Z"), versions: [version("eoda", 1, "2026-10-19", true)] },
      // validée AVANT le dépôt de la structure : à relire, pas montrée
      { code: "PA_FICHE_P2_EVENEMENTS_INDESIRABLES", validatedAt: new Date("2026-10-10T00:00:00Z"), versions: [version("x", 1, "2026-10-15", false)] },
      // jamais validée
      { code: "PA_FICHE_P3_MALTRAITANCE", validatedAt: null, versions: [version("y", 1, "2026-10-15", true)] },
      // pas une fiche de sensibilisation
      { code: "L2002_DIPC", validatedAt: new Date("2026-10-20T00:00:00Z"), versions: [version("z", 1, "2026-10-19", true)] },
    ]);
    expect(sheets).toEqual({ PA_FICHE_P1_PLAINTES: { versionId: "eoda", originalFilename: "eoda.docx" } });
  });

  it("sert aussi le tampon et le contrat récapitulatif du Département, à la même règle", () => {
    const sheets = selectTabletStructureDocuments([
      { code: DEPARTEMENT_TAMPON_CODE, validatedAt: new Date("2026-10-31T00:00:00Z"), versions: [version("tampon", 1, "2026-10-30", true)] },
      { code: DEPARTEMENT_CONTRAT_CODE, validatedAt: null, versions: [version("contrat", 1, "2026-10-30", true)] },
    ]);
    expect(sheets).toEqual({ [DEPARTEMENT_TAMPON_CODE]: { versionId: "tampon", originalFilename: "tampon.docx" } });
  });

  it("les codes de l'écran sont ceux de la base", () => {
    expect([DEPARTEMENT_TAMPON_CODE, DEPARTEMENT_CONTRAT_CODE].sort()).toEqual([...DEPARTEMENT_DOCUMENT_CODES].sort());
  });
});

describe("fiches et lignes « À expliquer »", () => {
  it("chaque fiche citée par une ligne existe, et chaque fiche a sa ligne", () => {
    const cited = allAdmissionPoints().flatMap((point) => (point.sheet ? [point.sheet] : []));
    for (const code of cited) expect(AWARENESS_SHEET_CODES).toContain(code);
    expect([...cited].sort()).toEqual([...AWARENESS_SHEET_CODES].sort());
  });
});
