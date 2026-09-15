import { describe, expect, it } from "vitest";
import { buildDraftDiff } from "./document-diff-service";

describe("buildDraftDiff", () => {
  it("marque comme inchangé un texte identique", () => {
    const segments = buildDraftDiff("Le règlement est révisé chaque année.", "Le règlement est révisé chaque année.");
    expect(segments.every((s) => s.kind === "unchanged")).toBe(true);
  });

  it("marque un ajout et une suppression sur une phrase modifiée", () => {
    const segments = buildDraftDiff("Le document mentionne la date.", "Le document mentionne la date de révision.");
    expect(segments.some((s) => s.kind === "added")).toBe(true);
    expect(segments.map((s) => s.text).join("")).toContain("de révision");
  });

  it("traite un ajout complet comme entièrement ajouté", () => {
    const segments = buildDraftDiff("", "Nouveau contenu généré.");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ text: "Nouveau contenu généré.", kind: "added" });
  });
});
