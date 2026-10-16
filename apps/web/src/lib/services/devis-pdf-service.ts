import type { Browser } from "puppeteer-core";
import { getEnv } from "@/lib/config/env";
import { DevisPdfError } from "@/lib/services/devis-pdf-failure";
import { launchHeadlessChromium } from "@/lib/services/headless-chromium-service";

// ─────────────────────────────────────────────────────────────────────────────
// PDF DU DEVIS POUR PIÈCE JOINTE — première génération de PDF côté serveur de ce
// projet (22/09/2026, demande du call Sandrine et le client pilote : le devis part
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

  // Le LANCEMENT vit dans `headless-chromium-service` (recette unique, partagée avec le
  // rendu des documents déposés). Chaque étape qui échoue est ÉTIQUETÉE (DevisPdfError) :
  // l'écran ne peut dire la vraie cause — et ne proposer de réessayer que quand ça a un
  // sens — que s'il la connaît (test de bout en bout du 12/10, Chromium non exécutable
  // en local).
  let browser: Browser;
  try {
    browser = await launchHeadlessChromium();
  } catch (error) {
    throw new DevisPdfError("LAUNCH", error);
  }

  try {
    const page = await browser.newPage();
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader });
    }
    // `printBackground` sans ce media type de rendu ignorerait les couleurs de la
    // charte — exactement ce que `.document-print` (globals.css) est fait pour
    // forcer, mais uniquement quand Chromium se comporte comme une impression.
    await page.emulateMediaType("print");
    const response = await page.goto(url.toString(), { waitUntil: "networkidle0" });
    // Une page de connexion ou d'erreur rendue en PDF partirait chez le prospect à la
    // place du devis : seul un 2xx sur la page imprimable est accepté.
    if (!response?.ok()) throw new DevisPdfError("PAGE");

    const pdf = await page.pdf({ format: "a4", printBackground: true });
    return Buffer.from(pdf);
  } catch (error) {
    if (error instanceof DevisPdfError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new DevisPdfError("TIMEOUT", error);
    }
    throw error;
  } finally {
    await browser.close();
  }
}
