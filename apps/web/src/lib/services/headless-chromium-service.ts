import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { getEnv } from "@/lib/config/env";
import { ChromiumLaunchError } from "@/lib/services/chromium-launch-error";
import { findLocalBrowser } from "@/lib/services/local-browser-paths";

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
// Le binaire à lancer, et s'il s'agit d'un navigateur de BUREAU (auquel cas les
// drapeaux serverless ne s'appliquent pas).
async function resolveBrowser(): Promise<{ executablePath: string; isDesktop: boolean }> {
  const env = getEnv();
  if (env.puppeteerExecutablePath) {
    return { executablePath: env.puppeteerExecutablePath, isDesktop: true };
  }
  // En développement seulement : le binaire embarqué est Linux et ne démarre pas sur
  // macOS/Windows. On cherche le navigateur de la machine au lieu de renvoyer 503 à
  // chaque aperçu de document (constaté le 20/10/2026). En production la question ne
  // se pose pas — l'embarqué est le bon binaire, et un repli silencieux vers un Chrome
  // de bureau serait une surprise, pas une solution.
  if (env.isDevelopment) {
    const found = findLocalBrowser({ platform: process.platform, exists: existsSync });
    if (found) return { executablePath: found, isDesktop: true };
  }
  // Extraction DANS le `try` de l'appelant : elle écrit et décompresse dans le
  // dossier temporaire, donc elle peut échouer (disque plein, image incomplète).
  const embedded = await chromium.executablePath();
  if (!embedded) {
    throw new Error(
      "le paquet embarqué n'a rendu aucun chemin exécutable sur cette machine (binaire Linux sur macOS/Windows)"
    );
  }
  return { executablePath: embedded, isDesktop: false };
}

export async function launchHeadlessChromium(): Promise<Browser> {
  let isDesktop = false;
  try {
    const resolved = await resolveBrowser();
    isDesktop = resolved.isDesktop;
    return await puppeteer.launch({
      args: isDesktop ? [] : chromium.args,
      executablePath: resolved.executablePath,
      headless: true,
    });
  } catch (error) {
    // Enveloppé, jamais relayé tel quel : « spawn ENOEXEC » ne dit à personne qu'il
    // faut poser PUPPETEER_EXECUTABLE_PATH pour tester en local (constaté le
    // 16/10/2026, en vérifiant l'aperçu de document sur un poste macOS). L'appelant
    // peut alors reconnaître CET échec-là et ne pas proposer de réessayer.
    throw new ChromiumLaunchError(error, !isDesktop);
  }
}
