import { describe, expect, it } from "vitest";
import {
  NO_VERSION_ASSISTANT_REASON,
  RESTRICTED_ASSISTANT_REASON,
  cabinetConformityHref,
  documentAssistantEntry,
  isAssistantPanelOpen,
} from "./document-assistant-entry-service";

describe("documentAssistantEntry", () => {
  it("ouvre la mise en conformité du document, panneau de l'assistant ouvert", () => {
    expect(documentAssistantEntry({ canWrite: true, restrictedAccess: false, versionId: "v1" })).toEqual({
      kind: "OPEN",
      href: "/dashboard/cabinet/conformite/v1?assistant=1",
    });
  });

  it("ne montre rien à un rôle qui n'écrit pas", () => {
    expect(documentAssistantEntry({ canWrite: false, restrictedAccess: false, versionId: "v1" })).toEqual({ kind: "HIDDEN" });
  });

  it("dit pourquoi sur un document à accès restreint, même avec un fichier", () => {
    expect(documentAssistantEntry({ canWrite: true, restrictedAccess: true, versionId: "v1" })).toEqual({
      kind: "UNAVAILABLE",
      reason: RESTRICTED_ASSISTANT_REASON,
    });
    expect(documentAssistantEntry({ canWrite: true, restrictedAccess: true, versionId: null })).toEqual({
      kind: "UNAVAILABLE",
      reason: RESTRICTED_ASSISTANT_REASON,
    });
  });

  it("dit pourquoi tant qu'aucun fichier n'est déposé", () => {
    expect(documentAssistantEntry({ canWrite: true, restrictedAccess: false, versionId: null })).toEqual({
      kind: "UNAVAILABLE",
      reason: NO_VERSION_ASSISTANT_REASON,
    });
  });
});

describe("cabinetConformityHref", () => {
  it("encode l'identifiant de version", () => {
    expect(cabinetConformityHref("a/b", { assistant: false })).toBe("/dashboard/cabinet/conformite/a%2Fb");
  });
});

describe("isAssistantPanelOpen", () => {
  it("n'ouvre que sur ?assistant=1", () => {
    expect(isAssistantPanelOpen("1")).toBe(true);
    expect(isAssistantPanelOpen(undefined)).toBe(false);
    expect(isAssistantPanelOpen("true")).toBe(false);
    expect(isAssistantPanelOpen(["1", "1"])).toBe(false);
  });
});
