"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { prepareDocumentPages } from "@/lib/services/document-viewer-service";
import { DocumentViewer } from "./DocumentViewer";

// ─────────────────────────────────────────────────────────────────────────────
// OUVRIR ET FERMER UN DOCUMENT SANS ATTENDRE LE SERVEUR (21/10/2026).
//
// Le panneau était piloté par l'adresse (`?doc=…`) : chaque ouverture ET chaque
// fermeture relançaient le rendu serveur de toute la page — la checklist entière relue
// en base — avant que l'écran ne change. Retour de Damon : « ça prend du temps à
// s'ouvrir, et quand on appuie sur la croix ça prend du temps à nous remettre dans la
// page ».
//
// L'adresse reste la vérité (lien partageable, « Précédent » referme) ; elle se met à
// jour EN ARRIÈRE-PLAN. L'écran, lui, réagit dans le même rendu que le clic :
//   - la visionneuse s'affiche et l'aperçu commence à charger (son adresse se calcule
//     de l'identifiant de version) ;
//   - le détail de droite arrive avec la réponse du serveur, annoncé en attendant ;
//   - la fermeture retire la visionneuse sur-le-champ.
// Au survol d'une ligne Word / Excel, les pages sont préparées en cache (`?prepare=1`,
// sans octets servis, donc sans trace d'accès) : le clic tombe sur le cache.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceEntry = {
  title: string;
  versionId: string | null;
  originalFilename: string | null;
};

const PREPARE_DELAY_MS = 150;

function documentIdFromAnchor(target: EventTarget | null): { id: string; href: string } | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const id = url.searchParams.get("doc");
  return id ? { id, href: `${url.pathname}${url.search}` } : null;
}

export function DocumentWorkspace({
  entries,
  serverOpenedId,
  closeHref,
  panel,
  children,
}: {
  entries: Record<string, WorkspaceEntry>;
  serverOpenedId: string | null;
  closeHref: string;
  panel: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // `undefined` : l'écran suit le serveur. Une valeur : le geste de l'utilisateur, en
  // avance sur la réponse du serveur.
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const prepared = useRef(new Set<string>());
  const prepareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le serveur a rattrapé le geste : on recommence à le suivre (ce qui garde
  // « Précédent » et « Suivant » du navigateur justes).
  useEffect(() => {
    if (pending !== undefined && pending === serverOpenedId) setPending(undefined);
  }, [pending, serverOpenedId]);

  const displayedId = pending === undefined ? serverOpenedId : pending;
  const displayed = displayedId ? entries[displayedId] : undefined;

  function open(id: string, href: string) {
    setPending(id);
    startTransition(() => router.push(href, { scroll: false }));
  }

  function close() {
    setPending(null);
    startTransition(() => router.push(closeHref, { scroll: false }));
  }

  function prepare(id: string) {
    const entry = entries[id];
    if (!entry?.versionId || !entry.originalFilename || prepared.current.has(entry.versionId)) return;
    // Une seule préparation par version et par visite de la page : survoler dix fois
    // une ligne ne relance pas dix rendus.
    if (prepareDocumentPages(entry.versionId, entry.originalFilename)) prepared.current.add(entry.versionId);
  }

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    // Ctrl/Cmd-clic, clic du milieu : le navigateur ouvre un nouvel onglet, on le laisse.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const found = documentIdFromAnchor(event.target);
    if (!found || !entries[found.id]) return;
    event.preventDefault();
    open(found.id, found.href);
  }

  function scheduleFrom(target: EventTarget | null) {
    const found = documentIdFromAnchor(target);
    if (!found) return;
    if (prepareTimer.current) clearTimeout(prepareTimer.current);
    prepareTimer.current = setTimeout(() => prepare(found.id), PREPARE_DELAY_MS);
  }

  useEffect(
    () => () => {
      if (prepareTimer.current) clearTimeout(prepareTimer.current);
    },
    []
  );

  const detailsReady = displayedId !== null && displayedId === serverOpenedId;

  return (
    <div
      onClickCapture={handleClickCapture}
      onPointerOver={(event) => scheduleFrom(event.target)}
      onFocus={(event) => scheduleFrom(event.target)}
    >
      {children}
      {displayedId && displayed && (
        <DocumentViewer
          title={displayed.title}
          versionId={displayed.versionId}
          originalFilename={displayed.originalFilename}
          onClose={close}
          details={
            detailsReady ? (
              panel
            ) : (
              <p role="status" className="flex items-center gap-2 text-sm text-ink2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Chargement du détail…
              </p>
            )
          }
        />
      )}
    </div>
  );
}
