import { describe, expect, it } from "vitest";
import type { ContentReviewCatalog } from "./content-review-service";
import {
  buildContentReviewCsv,
  buildContentReviewDocx,
  buildContentReviewParagraphs,
  parseContentReviewFormat,
} from "./content-review-export-service";

const CATALOG: ContentReviewCatalog = {
  status: "Provisoire, à valider par Sandrine",
  families: [
    {
      id: "QUIZ",
      title: "Quiz de sensibilisation",
      description: "Description.",
      groups: [
        {
          id: "quiz-x",
          title: "Quiz « Exemple »",
          version: "v2",
          provenance: "Source A\nSource B",
          items: [
            {
              id: "x-1",
              title: "1. Une question ; avec séparateur",
              fields: [
                { label: "Bonne réponse", value: "b) Oui" },
                { label: "Source", value: "=formule piégée" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("parseContentReviewFormat", () => {
  it("n'accepte que csv et docx", () => {
    expect(parseContentReviewFormat("csv")).toBe("csv");
    expect(parseContentReviewFormat("docx")).toBe("docx");
    for (const raw of [null, "", "CSV", "pdf", "docx;"]) expect(parseContentReviewFormat(raw)).toBeNull();
  });
});

describe("buildContentReviewCsv", () => {
  const csv = buildContentReviewCsv(CATALOG);
  const lines = csv.replace(/^﻿/, "").split("\r\n");

  it("BOM, en-tête et une colonne d'annotation vide", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Famille;Élément;Version;Identifiant;Intitulé;Détail;Statut;Annotation de Sandrine");
  });

  it("une ligne par élément, avec version et statut, cellules échappées et neutralisées", () => {
    const body = lines.slice(1).join("\r\n");
    expect(body).toContain("Quiz de sensibilisation;Quiz « Exemple »;v2;x-1;");
    expect(body).toContain('"1. Une question ; avec séparateur"');
    expect(body).toContain('"Bonne réponse : b) Oui\nSource : =formule piégée"');
    expect(body).toContain(";Provisoire, à valider par Sandrine;");
  });
});

describe("export Word", () => {
  it("titre, statut et emplacement d'annotation pour chaque élément", () => {
    const paragraphs = buildContentReviewParagraphs(CATALOG, "14/10/2026");
    // Titre + 2 lignes d'en-tête, famille (2), groupe (2), élément (titre, statut, 2 champs, annotation).
    expect(paragraphs).toHaveLength(3 + 2 + 2 + 5);
  });

  it("produit un fichier .docx (archive zip)", async () => {
    const buffer = await buildContentReviewDocx(CATALOG, "14/10/2026");
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
