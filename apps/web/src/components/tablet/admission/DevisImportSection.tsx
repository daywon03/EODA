"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEVIS_MAX_PAGES } from "@/lib/services/devis-service";
import { TABLET_SECONDARY } from "../tablet-ui";
import type { ImportedDevis } from "./devis-client";

// « Importer le devis » AVANT le contrat (call du 30/10/2026) : le devis fait et signé
// dans le logiciel de la structure, enregistré en PDF (dossier « Devis » de la
// tablette), est posé dans l'annexe 1 du Word. Rien ne part au serveur.
export function DevisImportSection({ devis, onDevis, hasDevisAnnex }: {
  devis: ImportedDevis | null;
  onDevis: (next: ImportedDevis | null) => void;
  // Le Word d'EODA a-t-il une annexe 1 « Devis » où le poser ?
  hasDevisAnnex: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!devis) return setPreview(null);
    const url = URL.createObjectURL(new Blob([devis.pages[0]! as BlobPart], { type: "image/png" }));
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [devis]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    // Chargé à l'import seulement : pdf.js ne pèse pas sur l'ouverture de la tablette.
    const { importDevis } = await import("./devis-client");
    const result = await importDevis(file);
    setBusy(false);
    if ("error" in result) return setError(result.error);
    onDevis(result);
  }

  return (
    <section aria-labelledby="projet-devis" className="flex flex-col gap-3">
      <h2 id="projet-devis" className="text-[24px] font-bold">Le devis (annexe 1)</h2>
      <p className="text-[18px] text-ink2">
        {hasDevisAnnex
          ? "Importez le devis de la personne (PDF ou photo) : il sera mis dans l'annexe 1 du contrat."
          : "Importez le devis de la personne (PDF ou photo) : il sera joint au contrat."}{" "}
        Sur la tablette, il est dans « Mes fichiers › Stockage interne › Devis ».
      </p>
      {devis ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-ok-text bg-ok-soft p-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- image locale (blob:), jamais optimisée par le serveur
            <img src={preview} alt="Première page du devis" className="h-32 w-auto rounded border border-line bg-card" />
          )}
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[18px]">
            <span className="font-bold">{devis.fileName}</span>
            <span>
              {devis.pageCount} page{devis.pageCount > 1 ? "s" : ""}
              {devis.pageCount > DEVIS_MAX_PAGES && ` — les ${DEVIS_MAX_PAGES} premières dans l'annexe, le devis entier joint au contrat`}
            </span>
          </div>
          <button type="button" className={cn(TABLET_SECONDARY, "gap-2")} onClick={() => onDevis(null)}>
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            Retirer
          </button>
        </div>
      ) : (
        <button type="button" className={cn(TABLET_SECONDARY, "w-fit gap-2")} onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <FileUp className="h-6 w-6" aria-hidden="true" />}
          {busy ? "Lecture du devis…" : "Importer le devis"}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p role="alert" className="font-bold text-danger-text">{error}</p>}
    </section>
  );
}
