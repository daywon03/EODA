import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { getEnv } from "@/lib/config/env";
import { ChromiumLaunchError } from "@/lib/services/chromium-launch-error";

// ─────────────────────────────────────────────────────────────────────────────
// LANCEMENT DE CHROMIUM SANS INTERFACE — recette unique du dépôt.
//
// Deux producteurs de PDF côté serveur s'appuient dessus : le PDF du devis
// (`devis-pdf-service`, qui imprime la page `/imprimer/devis/[id]`) et les pages
// d'un document déposé (`document-pdf-render-service`, qui imprime un HTML
// autonome). Le LANCEMENT était recopié ; deux copies auraient divergé au premier
// ajustement, et la cause d'un « Session closed » n'aurait plus été la même des
// deux côtés (D1).
//
// `chromium.args` (--single-process, --no-zygote, --disable-setuid-sandbox…) est
// taillé pour le bac à sable serverless (Lambda/Vercel) — constaté le 22/09/2026 :
// passés à un Chrome de bureau réel (repli PUPPETEER_EXECUTABLE_PATH, développement
// local), ils font fermer la session Chromium juste après le lancement
// (TargetCloseError). Ils ne s'appliquent donc qu'au binaire serverless ; un
// override local se lance sans eux, comme n'importe quel Chrome.
// ─────────────────────────────────────────────────────────────────────────────
export async function launchHeadlessChromium(): Promise<Browser> {
  const localExecutablePath = getEnv().puppeteerExecutablePath;

  try {
    // L'extraction du binaire embarqué est DANS le `try` : elle écrit et décompresse
    // dans le dossier temporaire, donc elle peut échouer (disque plein, image
    // incomplète) — et un échec de lancement doit se lire comme UNE cause à l'écran,
    // pas comme deux erreurs différentes.
    const executablePath = localExecutablePath ?? (await chromium.executablePath());
    return await puppeteer.launch({
      args: localExecutablePath ? [] : chromium.args,
      executablePath,
      headless: true,
    });
  } catch (error) {
    // Enveloppé, jamais relayé tel quel : « spawn ENOEXEC » ne dit à personne qu'il
    // faut poser PUPPETEER_EXECUTABLE_PATH pour tester en local (constaté le
    // 16/10/2026, en vérifiant l'aperçu de document sur un poste macOS). L'appelant
    // peut alors reconnaître CET échec-là et ne pas proposer de réessayer.
    throw new ChromiumLaunchError(error, localExecutablePath === undefined);
  }
}
