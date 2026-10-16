import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { getEnv } from "@/lib/config/env";

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

  return puppeteer.launch({
    args: localExecutablePath ? [] : chromium.args,
    executablePath: localExecutablePath ?? (await chromium.executablePath()),
    headless: true,
  });
}
