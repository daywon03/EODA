"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { frenchDay, type AdmissionRecord } from "@/lib/services/admission-service";
import { TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { downloadBlob, shareFilesOrDownload } from "./use-admissions";

// ─────────────────────────────────────────────────────────────────────────────
// LE DOSSIER D'UNE PERSONNE SUR LA TABLETTE (30/10/2026) — administrateur seulement.
//
// « Une fois les contrats signés, qu'ils soient mis au bon endroit » : tous les
// fichiers d'une personne, contrat après contrat (Word, attestation, formulaires du
// Département, devis), au même endroit — à envoyer, télécharger un par un, ou d'un coup
// (le même dossier que dans l'export : DIPEC/<NOM-Prenom>/). L'enquête n'y figure pas :
// ses réponses partent sans nom, rien ne les relie à la personne.
// ─────────────────────────────────────────────────────────────────────────────

type DossierFile = { fileName: string; blob: Blob };

export function PersonDossier({ name, records, recordFiles, zip, zipName, onBack }: {
  name: string;
  records: readonly AdmissionRecord[];
  recordFiles: (record: AdmissionRecord) => Promise<DossierFile[]>;
  zip: (records: readonly AdmissionRecord[]) => Promise<Blob>;
  zipName: string;
  onBack: () => void;
}) {
  const [files, setFiles] = useState<{ record: AdmissionRecord; files: DossierFile[] }[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // Le parent recrée la liste et la fonction à chaque rendu : on ne relit le dossier
  // que si les contrats eux-mêmes changent.
  const latest = useRef({ records, recordFiles });
  latest.current = { records, recordFiles };
  const recordIds = records.map((r) => r.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const { records: current, recordFiles: read } = latest.current;
    void Promise.all(current.map(async (record) => ({ record, files: await read(record) }))).then((rows) => {
      if (!cancelled) setFiles(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [recordIds]);

  const all = (files ?? []).flatMap((row) => row.files);

  return (
    <section aria-labelledby="dossier-titre" className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <h1 id="dossier-titre" className="flex items-center gap-3 text-[34px] font-bold leading-tight">
        <FolderOpen className="h-9 w-9" aria-hidden="true" />
        Dossier de {name}
      </h1>
      {files === null ? (
        <p role="status">Ouverture du dossier…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={TABLET_PRIMARY} disabled={all.length === 0} onClick={() => void zip(records).then((blob) => downloadBlob(zipName, blob))}>
              <Download className="h-6 w-6" aria-hidden="true" />
              Télécharger tout le dossier
            </button>
            <button
              type="button"
              className={TABLET_SECONDARY}
              disabled={all.length === 0}
              onClick={() =>
                void shareFilesOrDownload(all, `Dossier — ${name}`).then((result) =>
                  setFlash(result === "shared" ? "Le dossier est envoyé." : result === "downloaded" ? "Le dossier est téléchargé sur la tablette." : null)
                )
              }
            >
              <Send className="h-6 w-6" aria-hidden="true" />
              Envoyer le dossier
            </button>
          </div>
          {flash && <p className="text-[18px]">{flash}</p>}
          <ul className="flex flex-col gap-4">
            {files.map(({ record, files: list }) => (
              <li key={record.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-5">
                <p className="text-[21px] font-bold">
                  {record.outcome === "REFUS" ? "Refus" : "Contrat signé"} le {frenchDay(record.signedAt.slice(0, 10))}
                  <span className="font-normal text-ink2"> · DIPEC v{record.dipc.versionNumber}</span>
                </p>
                {list.length === 0 ? (
                  <p className="text-ink2">Les fichiers ne sont plus sur cette tablette : cherchez-les dans l&apos;export (Ximi ou serveur).</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {list.map((file) => (
                      <li key={file.fileName} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-0 break-all text-[17px]">{file.fileName}</span>
                        <button type="button" className={cn(TABLET_SECONDARY, "gap-2")} onClick={() => downloadBlob(file.fileName, file.blob)}>
                          <Download className="h-5 w-5" aria-hidden="true" />
                          Télécharger
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[17px] text-ink2">
            Pour que les fichiers téléchargés arrivent dans le dossier « DIPEC » de la tablette : dans Chrome, Paramètres › Téléchargements ›
            « Demander où télécharger les fichiers », puis choisissez « Stockage interne › DIPEC ».
          </p>
        </>
      )}
      <button type="button" className={cn(TABLET_SECONDARY, "w-full")} onClick={onBack}>
        Retour à la liste
      </button>
    </section>
  );
}
