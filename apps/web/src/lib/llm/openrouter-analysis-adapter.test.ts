import { describe, expect, it } from "vitest";
import { stripCodeFence } from "./openrouter-analysis-adapter";

describe("stripCodeFence", () => {
  it("laisse un JSON nu inchangé", () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });

  it("retire un bloc de code ```json ... ``` malgré la consigne de le rendre nu", () => {
    // Constaté avec MiniMax M2.7 (15/09/2026) : `response_format: json_object` ET
    // une consigne explicite n'empêchent pas toujours ce comportement.
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("retire un bloc de code sans étiquette de langage", () => {
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("ignore les espaces superflus autour du contenu", () => {
    expect(stripCodeFence('  \n```json\n  {"a":1}  \n```\n  ')).toBe('{"a":1}');
  });
});
