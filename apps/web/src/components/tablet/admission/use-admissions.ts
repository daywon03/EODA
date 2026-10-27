"use client";

import { useCallback, useEffect, useState } from "react";
import { admissionDatabaseName, parseStoredAdmission, type AdmissionRecord, type AdmissionSigner } from "@/lib/services/admission-service";
import type { AdmissionExtras } from "./AdmissionWizard";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRATS SIGNÉS GARDÉS SUR LA TABLETTE (26/10/2026).
//
// IndexedDB plutôt que le stockage local : un PDF signé pèse 100 à 300 Ko, cent
// contrats ne tiendraient pas dans les 5 Mo du `localStorage`. Rien ne part au
// serveur (verrou HDS, admission-service). La tablette n'est PAS un coffre : le
// navigateur peut effacer ses données ; l'écran le dit et pousse à l'export vers
// Ximi ou le serveur de la structure. On demande au navigateur de ne pas effacer
// (`navigator.storage.persist`) sans en dépendre.
// ─────────────────────────────────────────────────────────────────────────────

const STORE = "contrats";
type StoredRow = { id: string; record: unknown; pdf: Blob };

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB"));
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = window.indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB"));
  });
}

async function withStore<T>(name: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase(name);
  try {
    return await request(run(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

export function useAdmissions(establishmentId: string) {
  const name = admissionDatabaseName(establishmentId);
  const [records, setRecords] = useState<AdmissionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageWorks, setStorageWorks] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await withStore<StoredRow[]>(name, "readonly", (store) => store.getAll() as IDBRequest<StoredRow[]>);
      setRecords(rows.map((row) => parseStoredAdmission(row.record)).filter((r): r is AdmissionRecord => r !== null));
      setStorageWorks(true);
    } catch {
      setStorageWorks(false);
    }
    setLoaded(true);
  }, [name]);

  useEffect(() => {
    void reload();
    void navigator.storage?.persist?.().catch(() => false);
  }, [reload]);

  // Un contrat signé ne se réécrit jamais : un nouvel enregistrement à chaque
  // signature (révision annuelle comprise). À côté : le contrat Word signé et chaque
  // signature (reprise par le formulaire du Département), sous leurs propres clés.
  const save = useCallback(
    async (record: AdmissionRecord, pdf: Blob, extras: AdmissionExtras = { word: null, signatures: {} }): Promise<boolean> => {
      try {
        await withStore(name, "readwrite", (store) => store.add({ id: record.id, record, pdf } satisfies StoredRow));
        if (extras.word) {
          const word = extras.word;
          await withStore(name, "readwrite", (store) => store.put({ id: wordKey(record.id), record: null, pdf: word } satisfies StoredRow));
        }
        for (const [signer, blob] of Object.entries(extras.signatures) as [AdmissionSigner, Blob][]) {
          await withStore(name, "readwrite", (store) => store.put({ id: signatureKey(record.id, signer), record: null, pdf: blob } satisfies StoredRow));
        }
        await reload();
        return true;
      } catch {
        setStorageWorks(false);
        return false;
      }
    },
    [name, reload]
  );

  // Le formulaire du Département rempli pour un contrat : rangé à côté, sous sa propre
  // clé (`formulaire:<id du contrat>`) ; il se refait si on le refabrique.
  const saveForm = useCallback(
    async (recordId: string, pdf: Blob, kind: DepartementFormKind): Promise<boolean> => {
      try {
        await withStore(name, "readwrite", (store) => store.put({ id: formKey(recordId, kind), record: null, pdf } satisfies StoredRow));
        return true;
      } catch {
        return false;
      }
    },
    [name]
  );

  const pdfOf = useCallback(
    async (id: string): Promise<Blob | null> => {
      try {
        const row = await withStore<StoredRow | undefined>(name, "readonly", (store) => store.get(id) as IDBRequest<StoredRow | undefined>);
        return row?.pdf instanceof Blob ? row.pdf : null;
      } catch {
        return null;
      }
    },
    [name]
  );

  return { records, loaded, storageWorks, save, saveForm, pdfOf };
}

// Deux formulaires possibles par contrat, chacun sous sa clé : la déclaration
// initiale garde la clé d'origine (`formulaire:<id>`), déjà utilisée sur les tablettes.
export type DepartementFormKind = "INITIALE" | "CHANGEMENT";

export function formKey(recordId: string, kind: DepartementFormKind = "INITIALE"): string {
  return kind === "INITIALE" ? `formulaire:${recordId}` : `changement:${recordId}`;
}

// Le contrat Word signé, et chaque signature, rangés à côté de la fiche (27/10/2026).
export function wordKey(recordId: string): string {
  return `contrat-word:${recordId}`;
}

export function signatureKey(recordId: string, signer: AdmissionSigner): string {
  return `signature:${recordId}:${signer}`;
}

export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// « Envoyer à la personne » : la feuille de partage de la tablette (messagerie,
// AirDrop, impression…). Le fichier ne passe pas par le serveur d'EODA. Sans
// partage possible, on télécharge.
export async function shareOrDownload(fileName: string, blob: Blob, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  return shareFilesOrDownload([{ fileName, blob }], title);
}

// Plusieurs fichiers d'un coup (le formulaire du Département ET le contrat, que le
// Département exige ensemble). Sans partage possible : un téléchargement par fichier.
export async function shareFilesOrDownload(files: readonly { fileName: string; blob: Blob }[], title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const asFiles = files.map((f) => new File([f.blob], f.fileName, { type: f.blob.type || "application/pdf" }));
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: asFiles })) {
    try {
      await navigator.share({ files: asFiles, title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  files.forEach((f) => downloadBlob(f.fileName, f.blob));
  return "downloaded";
}
