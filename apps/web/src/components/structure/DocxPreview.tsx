"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { neutralizeDocxLinks } from "@/lib/services/docx-preview-safety";

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

export function DocxPreview({ url, title, onFailed }: { url: string; title: string; onFailed: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    const target = body.current;
    if (!target) return;

    void (async () => {
      try {
        const [response, docx] = await Promise.all([fetch(url, { credentials: "same-origin" }), import("docx-preview")]);
        if (!response.ok) throw new Error(`Aperçu Word indisponible (${response.status})`);
        const data = await response.blob();
        if (cancelled) return;
        await docx.renderAsync(data, target, target, {
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
  }, [url, onFailed]);

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
      {/* Le fond gris par défaut de docx-preview laisse place au fond de la visionneuse. */}
      <div ref={body} role="document" aria-label={title} className="[&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-4" />
    </div>
  );
}
