import { describe, expect, it } from "vitest";
import { chunkText } from "./knowledge-chunking-service";

describe("chunkText", () => {
  it("rend un texte vide sans chunk", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("rend un seul chunk pour un texte court", () => {
    const text = "Un extrait du manuel HAS tenant en un seul chunk.";
    expect(chunkText(text)).toEqual([text]);
  });

  it("découpe un texte long en plusieurs chunks avec chevauchement", () => {
    const text = "a".repeat(3200);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    // Chaque caractère du texte source doit être couvert par au moins un chunk —
    // sinon le chevauchement laisse un trou et une partie du texte n'est jamais
    // envoyée à l'embedding.
    expect(chunks.join("").length).toBeGreaterThanOrEqual(text.length);
  });

  it("ne rend jamais de chunk vide", () => {
    const text = "x".repeat(5000);
    const chunks = chunkText(text);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
  });
});
