import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readEodaLogoPng } from "./eoda-logo-asset";

// La page de garde lit le logo OFFICIEL (public/logo-eoda.png), jamais une copie ; un
// fichier introuvable ne bloque jamais l'enregistrement d'un document.

describe("readEodaLogoPng", () => {
  it("lit le PNG officiel du dépôt (signature PNG)", async () => {
    const logo = await readEodaLogoPng(path.resolve(__dirname, "../../.."));
    expect(logo?.subarray(1, 4).toString("latin1")).toBe("PNG");
  });

  it("rend null, sans lever, quand le fichier est absent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await readEodaLogoPng("/dossier/inexistant")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
