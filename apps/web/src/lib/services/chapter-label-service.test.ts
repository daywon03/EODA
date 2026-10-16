import { describe, expect, it } from "vitest";
import { chapterDistinctName, chapterLabel } from "./chapter-label-service";
import { describeChapterMeasure } from "./structure-sheet-service";
import { describeChapterRatedMeasure } from "./self-assessment-service";
import { groupDiagnosticChapters } from "./diagnostic-service";

// Le seed du référentiel nomme chaque chapitre « Chapitre N » : l'écran affichait
// donc « Chapitre 1 — Chapitre 1 » (test de bout en bout du 12/10/2026). On corrige
// l'AFFICHAGE, pas les données — un nom réel (« La personne ») reste affiché.
describe("chapterLabel", () => {
  it("n'écrit pas deux fois « Chapitre N » quand le nom le répète", () => {
    expect(chapterLabel({ number: 1, name: "Chapitre 1" })).toBe("Chapitre 1");
    expect(chapterLabel({ number: 2, name: "  chapitre   2 " })).toBe("Chapitre 2");
  });

  it("garde le nom quand il apporte quelque chose", () => {
    expect(chapterLabel({ number: 1, name: "La personne" })).toBe("Chapitre 1 — La personne");
  });

  it("se contente du numéro sans nom", () => {
    expect(chapterLabel({ number: 3, name: "" })).toBe("Chapitre 3");
  });

  it("ne confond pas le nom d'un autre chapitre avec une répétition", () => {
    expect(chapterLabel({ number: 1, name: "Chapitre 10" })).toBe("Chapitre 1 — Chapitre 10");
  });
});

describe("chapterDistinctName", () => {
  it("renvoie null quand le nom ne fait que répéter le numéro", () => {
    expect(chapterDistinctName({ number: 1, name: "Chapitre 1" })).toBeNull();
    expect(chapterDistinctName({ number: 1, name: "" })).toBeNull();
  });

  it("renvoie le nom réel, sans espaces superflus", () => {
    expect(chapterDistinctName({ number: 1, name: " La personne " })).toBe("La personne");
  });
});

describe("libellés de chapitre des écrans", () => {
  it("mesure de score, mesure de cotation et diagnostic n'affichent pas « Chapitre 1 — Chapitre 1 »", () => {
    const chapter = { number: 1, name: "Chapitre 1" };
    expect(describeChapterMeasure({ ...chapter, score: null, imperatifsAtRisk: 0 }).label).toBe("Chapitre 1");
    expect(describeChapterRatedMeasure(chapter, { rated: 0, total: 0 }).label).toBe("Chapitre 1");
    expect(groupDiagnosticChapters([], [chapter], true)[0]?.title).toBe("Chapitre 1");
  });
});
