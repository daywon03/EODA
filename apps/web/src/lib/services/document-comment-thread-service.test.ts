import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_COMMENT_LENGTH,
  commentsForAnalysis,
  isNewJustification,
  newDocumentCommentError,
} from "./document-comment-thread-service";

// Retour de Sandrine (10/11/2026) : « J'ai cumulé les commentaires, car je ne vois pas
// l'historique. » Le commentaire d'un document devient un FIL : chaque commentaire
// s'empile avec sa date, rien ne s'écrase, et l'IA relit tous ceux qui sont cochés.

const at = (day: number) => new Date(2026, 10, day);

describe("commentsForAnalysis — ce que l'IA relit", () => {
  it("tous les commentaires cochés, du plus ancien au plus récent, datés", () => {
    expect(
      commentsForAnalysis(
        [
          { text: "DPO : Jean Exemple", aiEnabled: true, createdAt: at(10) },
          { text: "ignorer l'annexe 3", aiEnabled: false, createdAt: at(9) },
          { text: "Le CVS est remplacé par l'enquête", aiEnabled: true, createdAt: at(8) },
        ],
        null
      )
    ).toBe("- 08/11/2026 : Le CVS est remplacé par l'enquête\n- 10/11/2026 : DPO : Jean Exemple");
  });

  it("aucun commentaire coché : rien", () => {
    expect(commentsForAnalysis([{ text: "x", aiEnabled: false, createdAt: at(1) }], null)).toBeUndefined();
  });

  it("fil vide : l'ancien commentaire unique, seulement s'il était coché", () => {
    expect(commentsForAnalysis([], { text: " ancien ", usedByAi: true })).toBe("ancien");
    expect(commentsForAnalysis([], { text: "ancien", usedByAi: false })).toBeUndefined();
  });

  it("fil non vide : l'ancien champ n'est jamais relu en double", () => {
    expect(
      commentsForAnalysis([{ text: "nouveau", aiEnabled: true, createdAt: at(2) }], { text: "ancien", usedByAi: true })
    ).toBe("- 02/11/2026 : nouveau");
  });
});

describe("newDocumentCommentError", () => {
  it("refuse un commentaire vide ou trop long", () => {
    expect(newDocumentCommentError("   ")).toMatch(/vide/);
    expect(newDocumentCommentError("a".repeat(MAX_DOCUMENT_COMMENT_LENGTH + 1))).toMatch(/caractères/);
    expect(newDocumentCommentError("Le DPO est nommé page 4.")).toBeNull();
  });
});

describe("isNewJustification — une justification modifiée rejoint le fil", () => {
  it("seulement un texte non vide, différent du précédent", () => {
    expect(isNewJustification(null, "Il arrive la semaine prochaine")).toBe(true);
    expect(isNewJustification("même", " même ")).toBe(false);
    expect(isNewJustification("ancien", "")).toBe(false);
    expect(isNewJustification("ancien", null)).toBe(false);
  });
});
