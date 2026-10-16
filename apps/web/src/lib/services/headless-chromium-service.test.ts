import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// LA RECETTE DE LANCEMENT — un seul endroit, deux issues, et l'erreur est NOMMÉE.
//
// Ce fichier verrouille trois choses qu'aucun autre test ne voit :
//   - le binaire embarqué ne reçoit PAS `chromium.args` quand un Chrome de bureau est
//     configuré : ces drapeaux serverless font fermer la session juste après le
//     lancement (TargetCloseError, constaté le 22/09/2026) ;
//   - un échec de lancement devient un `ChromiumLaunchError` porteur du recours
//     (poser PUPPETEER_EXECUTABLE_PATH en développement), jamais l'erreur brute —
//     « spawn ENOEXEC » ne dit à personne quoi faire (constaté le 16/10/2026) ;
//   - l'extraction du binaire embarqué est dans le `try` : son échec se lit comme la
//     même cause unique.
// ─────────────────────────────────────────────────────────────────────────────

const launch = vi.fn();
const executablePath = vi.fn();
const SERVERLESS_ARGS = ["--single-process", "--no-zygote"];
let envExecutablePath: string | undefined;

vi.mock("puppeteer-core", () => ({
  default: { launch: (...args: unknown[]) => launch(...args) },
}));

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--single-process", "--no-zygote"],
    executablePath: () => executablePath(),
  },
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ puppeteerExecutablePath: envExecutablePath }),
}));

import { ChromiumLaunchError } from "@/lib/services/chromium-launch-error";

const { launchHeadlessChromium } = await import("@/lib/services/headless-chromium-service");

const LOCAL_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

describe("launchHeadlessChromium", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envExecutablePath = undefined;
    executablePath.mockResolvedValue("/tmp/chromium");
    launch.mockResolvedValue({ marker: "browser" });
  });

  it("lance le Chrome configuré, SANS les drapeaux serverless", async () => {
    envExecutablePath = LOCAL_CHROME;

    await launchHeadlessChromium();

    expect(launch).toHaveBeenCalledWith({
      args: [],
      executablePath: LOCAL_CHROME,
      headless: true,
    });
    // Le binaire serverless n'est même pas extrait : `args` est vide précisément parce
    // qu'un Chrome de bureau s'exécute comme n'importe quel Chrome.
    expect(executablePath).not.toHaveBeenCalled();
  });

  it("retombe sur le binaire embarqué, avec ses drapeaux, quand rien n'est configuré", async () => {
    await launchHeadlessChromium();

    expect(launch).toHaveBeenCalledWith({
      args: SERVERLESS_ARGS,
      executablePath: "/tmp/chromium",
      headless: true,
    });
  });

  it("nomme le recours quand le lancement échoue sur le binaire embarqué", async () => {
    const raw = new Error("spawn ENOEXEC");
    launch.mockRejectedValue(raw);

    const error = await launchHeadlessChromium().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ChromiumLaunchError);
    expect((error as ChromiumLaunchError).usedEmbeddedBinary).toBe(true);
    expect((error as Error).message).toContain("PUPPETEER_EXECUTABLE_PATH");
    // La cause d'origine survit : c'est elle qu'on lit dans le journal, et sans elle
    // l'enveloppe cacherait le vrai motif.
    expect((error as Error).cause).toBe(raw);
    expect((error as Error).message).toContain("spawn ENOEXEC");
  });

  it("distingue l'échec du Chrome configuré de celui du binaire embarqué", async () => {
    envExecutablePath = LOCAL_CHROME;
    launch.mockRejectedValue(new Error("Target closed"));

    const error = (await launchHeadlessChromium().catch((thrown: unknown) => thrown)) as
      | ChromiumLaunchError
      | undefined;

    expect(error).toBeInstanceOf(ChromiumLaunchError);
    expect(error?.usedEmbeddedBinary).toBe(false);
    // On n'envoie pas poser une variable déjà posée.
    expect(error?.message).not.toContain("posez PUPPETEER_EXECUTABLE_PATH");
  });

  it("enveloppe aussi l'échec d'extraction du binaire embarqué", async () => {
    executablePath.mockRejectedValue(new Error("ENOSPC: no space left on device"));

    const error = await launchHeadlessChromium().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ChromiumLaunchError);
    expect((error as Error).message).toContain("ENOSPC");
    expect(launch).not.toHaveBeenCalled();
  });
});
