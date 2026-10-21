"use client";

import { useCallback, useEffect, useState } from "react";
import { FileX, Loader2 } from "lucide-react";
import { DocxPreview } from "./DocxPreview";
import { getDocumentPreviewData } from "@/lib/actions/document";
import { documentViewerSource } from "@/lib/services/document-viewer-service";
import type { FilePreviewData } from "@/lib/services/file-preview-types";
import { FilePreviewBody } from "@/components/shared/FilePreviewModalLazy";

// La colonne APERÇU de la visionneuse. L'adresse se calcule du seul identifiant de
// version (`documentViewerSource`) : le cadre commence à charger dans le même rendu que
// le clic, sans attendre une action serveur. Seul le repli (`.doc`, `.xls` : texte
// extrait) passe par `getDocumentPreviewData`.
//
// L'attente est DITE (`role="status"`) : le premier rendu d'un Word coûte un lancement
// de Chromium, et un cadre blanc muet passerait pour une panne.

function Waiting({ label }: { label: string }) {
  return (
    <p role="status" className="absolute inset-x-0 top-0 flex items-center gap-2 px-5 py-3 text-sm text-ink2">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

function FramedPreview({ url, title, waitingLabel }: { url: string; title: string; waitingLabel: string }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative h-full w-full bg-soft">
      {!ready && <Waiting label={waitingLabel} />}
      <iframe src={url} title={title} onLoad={() => setReady(true)} className="h-full w-full border-0" />
    </div>
  );
}

function ImagePreview({ url, title }: { url: string; title: string }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-soft p-4">
      {!ready && <Waiting label="Chargement de la photo…" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- document déposé servi par notre route, taille inconnue à l'avance. */}
      <img
        src={url}
        alt={title}
        onLoad={() => setReady(true)}
        className="max-h-full max-w-full object-contain shadow-eoda-sm"
      />
    </div>
  );
}

// Word : dessiné avec sa mise en page dans le navigateur (DocxPreview) ; si le dessin
// échoue, les pages produites côté serveur prennent le relais.
function WordPreview({ url, pagesUrl, title }: { url: string; pagesUrl: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const onFailed = useCallback(() => setFailed(true), []);
  if (failed) return <FramedPreview url={pagesUrl} title={title} waitingLabel="Préparation des pages…" />;
  return <DocxPreview url={url} title={title} onFailed={onFailed} />;
}

function FallbackPreview({ versionId }: { versionId: string }) {
  const [preview, setPreview] = useState<FilePreviewData | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void getDocumentPreviewData(versionId).then((data) => {
      if (!cancelled) setPreview(data);
    });
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  if (preview === undefined) {
    return (
      <div className="relative h-full w-full">
        <Waiting label="Chargement de l'aperçu…" />
      </div>
    );
  }
  if (preview === null) {
    return <p className="px-5 py-4 text-sm text-ink2">Ce document n&apos;est plus accessible.</p>;
  }
  return (
    <div className="h-full overflow-y-auto">
      <FilePreviewBody preview={preview} />
    </div>
  );
}

export function DocumentPreviewPane({
  versionId,
  originalFilename,
  title,
}: {
  versionId: string | null;
  originalFilename: string | null;
  title: string;
}) {
  if (!versionId || !originalFilename) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-soft px-6 text-center">
        <FileX className="h-10 w-10 text-ink2" aria-hidden="true" />
        <p className="text-base font-bold text-ink">Aucun document déposé</p>
        <p className="max-w-sm text-sm text-ink2">
          Le détail à droite permet de déposer une première version ou de répondre pour la structure.
        </p>
      </div>
    );
  }

  const source = documentViewerSource(versionId, originalFilename);
  // `key` : changer de document remet l'état « en chargement » à zéro.
  switch (source.kind) {
    case "pdf":
      return <FramedPreview key={versionId} url={source.url} title={title} waitingLabel="Chargement du PDF…" />;
    case "docx":
      return <WordPreview key={versionId} url={source.url} pagesUrl={source.pagesUrl} title={title} />;
    case "pages":
      return (
        <FramedPreview key={versionId} url={source.url} title={title} waitingLabel="Préparation des pages…" />
      );
    case "image":
      return <ImagePreview key={versionId} url={source.url} title={title} />;
    case "fallback":
      return <FallbackPreview key={versionId} versionId={versionId} />;
  }
}
