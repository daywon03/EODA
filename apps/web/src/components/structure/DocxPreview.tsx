"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { isBrowserUnreadableImage, neutralizeDocxLinks } from "@/lib/services/docx-preview-safety";

// ─────────────────────────────────────────────────────────────────────────────
// APERÇU D'UN WORD AVEC SA MISE EN PAGE (demande de Damon, 21/10/2026 : « quand on
// met le doc avec un certain design, il ne faut pas que dans la preview le design
// change »).
//
// Le .docx déposé est DESSINÉ dans le navigateur par docx-preview : polices, couleurs,
// tableaux, en-têtes et pieds de page, images, sauts de page. La conversion serveur
// (mammoth → HTML → Chromium) ne gardait que le texte et les tableaux.
//
//  - la bibliothèque n'est chargée qu'à l'ouverture d'un Word (import dynamique) :
//    aucune page ne la paie si elle n'en montre pas ;
//  - le fichier vient d'un tiers, il est HOSTILE : docx-preview construit des nœuds
//    (pas de HTML brut injecté), les images et polices sont mises en `data:` (rien ne
//    part sur le réseau), et chaque lien est neutralisé s'il n'est pas http(s) ou
//    mailto (neutralizeDocxLinks, testé) ;
//  - la page est mise à la LARGEUR du panneau (zoom), sans défilement horizontal ;
//  - un échec n'est pas une impasse : on retombe sur les pages produites côté serveur.
// ─────────────────────────────────────────────────────────────────────────────

type State = "loading" | "ready" | "failed";

// Une image EMF / WMF devient un encadré de même taille qui dit ce qu'il cache.
function replaceUnreadableImages(root: HTMLElement): number {
  let count = 0;
  for (const image of Array.from(root.querySelectorAll("img"))) {
    if (!isBrowserUnreadableImage(image.getAttribute("src"))) continue;
    const box = document.createElement("div");
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", "Image au format Windows (EMF ou WMF), non affichable dans l'aperçu");
    box.textContent = "Image au format Windows (EMF ou WMF) : elle est dans le document Word, mais l'aperçu ne peut pas la dessiner.";
    box.style.cssText = `${image.style.cssText};display:flex;align-items:center;justify-content:center;padding:12px;border:2px dashed currentColor;font-size:14px;text-align:center;min-height:80px;`;
    image.replaceWith(box);
    count++;
  }
  return count;
}

// `data` : un Word fabriqué dans le navigateur (le DIPEC rempli sur la tablette, qui ne
// passe jamais par le serveur) ; sinon il est lu à `url`.
export function DocxPreview({ url, data, title, onFailed }: { url?: string; data?: Blob; title: string; onFailed: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");
  const [unreadableImages, setUnreadableImages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const target = body.current;
    if (!target) return;

    void (async () => {
      try {
        const docx = await import("docx-preview");
        let content = data;
        if (!content) {
          if (!url) throw new Error("Aperçu Word sans document");
          const response = await fetch(url, { credentials: "same-origin" });
          if (!response.ok) throw new Error(`Aperçu Word indisponible (${response.status})`);
          content = await response.blob();
        }
        if (cancelled) return;
        await docx.renderAsync(content, target, target, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          ignoreFonts: false,
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
          renderChanges: false,
          renderComments: false,
          experimental: false,
        });
        if (cancelled) return;
        neutralizeDocxLinks(target);
        setUnreadableImages(replaceUnreadableImages(target));
        setState("ready");
      } catch (error) {
        if (cancelled) return;
        console.error("Aperçu Word — rendu dans le navigateur échoué, repli sur les pages :", error);
        setState("failed");
        onFailed();
      }
    })();

    return () => {
      cancelled = true;
      target.replaceChildren();
    };
  }, [url, data, onFailed]);

  // Mise à la largeur : la page Word garde ses proportions, réduite si le panneau est
  // plus étroit qu'elle, jamais agrandie au-delà de 100 %.
  useEffect(() => {
    if (state !== "ready" || !frame.current || !body.current) return;
    const container = frame.current;
    const wrapper = body.current.querySelector<HTMLElement>(".docx-wrapper");
    const page = body.current.querySelector<HTMLElement>("section.docx");
    if (!wrapper || !page) return;
    const fit = () => {
      const available = container.clientWidth - 32;
      const zoom = Math.min(1, available / page.offsetWidth);
      wrapper.style.zoom = String(zoom > 0 ? zoom : 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [state]);

  return (
    <div ref={frame} className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-soft" aria-busy={state === "loading"}>
      {state === "loading" && (
        <p role="status" className="absolute inset-x-0 top-0 flex items-center gap-2 px-5 py-3 text-sm text-ink2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Mise en page du document…
        </p>
      )}
      {unreadableImages > 0 && (
        <p role="note" className="m-4 mb-0 rounded-xl border border-line bg-highlight px-4 py-3 text-sm text-ink">
          {unreadableImages > 1 ? `${unreadableImages} images de ce document sont` : "Une image de ce document est"} au format
          EMF ou WMF (Windows) : ni les navigateurs ni les tablettes ne savent l&apos;afficher. Elle est bien dans le
          fichier Word. Pour qu&apos;elle se voie partout, remplacez-la dans Word par une image PNG (clic droit sur
          l&apos;image › « Enregistrer en tant qu&apos;image » › PNG, puis Insérer › Images).
        </p>
      )}
      {/* Le fond gris par défaut de docx-preview laisse place au fond de la visionneuse. */}
      <div ref={body} role="document" aria-label={title} className="[&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-4" />
    </div>
  );
}
