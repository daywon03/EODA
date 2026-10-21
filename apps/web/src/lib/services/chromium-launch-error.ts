// ─────────────────────────────────────────────────────────────────────────────
// CHROMIUM N'A PAS DÉMARRÉ — cause NOMMÉE, et le recours qui marche.
//
// Module pur, sans import de puppeteer (même doctrine que `devis-pdf-failure.ts`) :
// la couche qui sert les octets peut décider de son message sans traîner le moteur de
// rendu dans son graphe d'imports.
//
// Le lancement a exactement deux issues, et elles n'ont pas le même recours :
//   - le binaire SERVERLESS embarqué (`@sparticuz/chromium`) est un binaire Linux
//     (AL2023) ; sur un poste macOS il ne peut pas s'exécuter — mesuré le 16/10/2026 :
//     `spawn ENOEXEC`. Le recours est de renseigner `PUPPETEER_EXECUTABLE_PATH` sur un
//     Chrome installé (`.env.example`) ;
//   - le Chrome de bureau configuré refuse de démarrer : le recours est ce Chrome-là.
//
// Dans les deux cas, « Réessayez » est un mensonge : réessayer redonne le même échec.
// ─────────────────────────────────────────────────────────────────────────────

export class ChromiumLaunchError extends Error {
  /** Le repli embarqué a été utilisé (aucun `PUPPETEER_EXECUTABLE_PATH` configuré). */
  readonly usedEmbeddedBinary: boolean;

  constructor(cause: unknown, usedEmbeddedBinary: boolean) {
    super(
      `${chromiumLaunchHint(usedEmbeddedBinary)} Cause : ${
        cause instanceof Error ? cause.message : "erreur inconnue"
      }`,
      { cause }
    );
    this.name = "ChromiumLaunchError";
    this.usedEmbeddedBinary = usedEmbeddedBinary;
  }
}

// Le texte s'adresse à qui lit le JOURNAL serveur : il nomme la variable à poser.
// Le message montré à l'utilisateur, lui, se décide dans `document-pdf-response.ts` /
// `devis-pdf-failure.ts` — jamais le détail technique à l'écran.
export function chromiumLaunchHint(usedEmbeddedBinary: boolean): string {
  return usedEmbeddedBinary
    ? "Chromium n'a pas pu démarrer : c'est le binaire serverless embarqué qui a été utilisé. En développement, il ne s'exécute pas sur macOS : posez PUPPETEER_EXECUTABLE_PATH dans .env.local (chemin d'un Chrome installé). En production, la variable doit rester vide ; vérifiez que les fichiers @sparticuz/chromium/bin sont bien embarqués dans la fonction (outputFileTracingIncludes de next.config.ts, contrôlé par `pnpm check:chromium`)."
    : "Chromium n'a pas pu démarrer : le Chrome désigné par PUPPETEER_EXECUTABLE_PATH a refusé de se lancer.";
}
