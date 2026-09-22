import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { getEnv } from "@/lib/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// PDF DU DEVIS POUR PIÈCE JOINTE — première génération de PDF côté serveur de ce
// projet (22/09/2026, demande du call Sandrine/Assad Benoît : le devis part
// désormais en vrai e-mail via Resend, pièce jointe comprise, plutôt qu'en
// `mailto:` qui ne peut techniquement pas attacher de fichier).
//
// PAS de re-rendu du composant React en HTML isolé : ça exigerait d'extraire le
// CSS Tailwind compilé pour l'injecter à la main, un mécanisme séparé de celui du
// navigateur et donc une seconde source de vérité visuelle. À la place, Chromium
// headless navigue vers `/imprimer/devis/[id]`, LA MÊME page que le bouton
// « Télécharger » ouvre déjà pour l'impression manuelle — un seul rendu à
// maintenir. Les cookies de session sont transmis pour que cette page,
// authentifiée comme les autres, s'affiche normalement.
export async function renderDevisPdf(
  devisId: string,
  cookieHeader: string
): Promise<Buffer> {
  const base = getEnv().nextAuthUrl ?? "http://localhost:3000";
  const url = new URL(`/imprimer/devis/${devisId}`, base);

  const localExecutablePath = getEnv().puppeteerExecutablePath;

  // `chromium.args` (--single-process, --no-zygote, --disable-setuid-sandbox…) est
  // taillé pour le bac à sable serverless (Lambda/Vercel) — constaté le 22/09/2026 :
  // passés à un Chrome de bureau réel (repli PUPPETEER_EXECUTABLE_PATH, développement
  // local), ils font fermer la session Chromium juste après le lancement
  // ("Session closed", TargetCloseError). Ils ne s'appliquent donc qu'au binaire
  // serverless ; un override local se lance sans eux, comme n'importe quel Chrome.
  const browser = await puppeteer.launch({
    args: localExecutablePath ? [] : chromium.args,
    executablePath: localExecutablePath ?? (await chromium.executablePath()),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader });
    }
    // `printBackground` sans ce media type de rendu ignorerait les couleurs de la
    // charte — exactement ce que `.document-print` (globals.css) est fait pour
    // forcer, mais uniquement quand Chromium se comporte comme une impression.
    await page.emulateMediaType("print");
    await page.goto(url.toString(), { waitUntil: "networkidle0" });

    const pdf = await page.pdf({ format: "a4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
