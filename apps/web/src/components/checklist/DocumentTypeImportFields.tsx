"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { importDocumentTypes, previewDocumentTypeImport } from "@/lib/actions/document-folder";
import { readXlsxRows, XlsxReadError } from "@/lib/services/xlsx-rows-reader";
import { parseCsv } from "@/lib/services/criterion-matrix-service";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/services/structure-documents-service";
import { CREATABLE_DOCUMENT_CATEGORIES } from "@/lib/services/document-type-creation-service";
import {
  detectCsvDelimiter,
  ImportFormatError,
  readImportRows,
  type ImportLinePlan,
} from "@/lib/services/document-type-import-service";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = {
  folders: readonly { id: string; label: string }[];
  onClose: () => void;
};

const STATUS_LABELS: Record<ImportLinePlan["status"], string> = {
  NEW: "À créer",
  DUPLICATE: "Déjà dans la liste",
  INVALID: "À corriger dans le fichier",
};

// Le fichier se lit ICI, dans le navigateur (xlsx-rows-reader : tailles bornées,
// aucune formule évaluée) ; seuls les intitulés et les numéros de critères partent au
// serveur, qui propose, puis crée ce qui est coché — recalculé de son côté.
async function readCells(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    return parseCsv(text, detectCsvDelimiter(text));
  }
  return readXlsxRows(new Uint8Array(await file.arrayBuffer()));
}

// Import d'un tableur dans « Documents » (call du 29/10/2026). Chargé à la demande
// par DocumentTypeImport.
export function DocumentTypeImportFields({ folders, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("QUALITE_RISQUES");
  const [folderId, setFolderId] = useState<string>(folders[0]?.id ?? "");
  const [provider, setProvider] = useState<"EODA" | "STRUCTURE">("EODA");
  const [lines, setLines] = useState<ImportLinePlan[] | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    setLines(null);
    setDone(null);
    setError(null);
    if (!file) return;
    startTransition(async () => {
      try {
        const rows = readImportRows(await readCells(file));
        if (rows.length === 0) {
          setError("Aucune ligne remplie sous l'en-tête.");
          return;
        }
        const result = await previewDocumentTypeImport(
          rows.map(({ label, criteria }) => ({ label, criteria })),
          category
        );
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setLines(result.lines);
        setChecked(new Set(result.lines.flatMap((line, index) => (line.status === "NEW" ? [index] : []))));
      } catch (cause) {
        if (cause instanceof XlsxReadError || cause instanceof ImportFormatError) setError(cause.message);
        else setError("Le fichier n'a pas pu être lu. Enregistrez-le en .xlsx ou en .csv et réessayez.");
      }
    });
  }

  function toggle(index: number) {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function create() {
    if (!lines) return;
    const rows = lines.filter((_, index) => checked.has(index)).map(({ label, criteria }) => ({ label, criteria }));
    startTransition(async () => {
      const result = await importDocumentTypes({ rows, category, provider, folderId });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLines(null);
      setDone(`${result.created} ligne${result.created > 1 ? "s" : ""} créée${result.created > 1 ? "s" : ""}, pour toutes les structures.`);
      router.refresh();
    });
  }

  const selectedCount = checked.size;

  return (
    <section
      aria-labelledby="document-import-title"
      className="max-w-4xl space-y-4 rounded-xl border border-line bg-card p-4"
    >
      <h3 id="document-import-title" className="text-base font-bold text-ink">
        Importer des documents depuis un tableur
      </h3>
      <p className="text-sm text-ink2">
        Exportez l&apos;onglet récapitulatif en fichier Excel (.xlsx) ou CSV. Une colonne <strong>Intitulé</strong> (ou
        Titre, Nom du document) est lue ; les colonnes dont l&apos;en-tête contient <strong>critère</strong> donnent les
        critères HAS. Rien n&apos;est créé avant que vous ayez relu la liste.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="document-import-folder">Ranger dans le dossier</Label>
          <Select id="document-import-folder" value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={isPending}>
            <option value="">Aucun dossier</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document-import-category">Catégorie</Label>
          <Select
            id="document-import-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLines(null);
            }}
            disabled={isPending}
          >
            {CREATABLE_DOCUMENT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-bold text-ink">Qui les fournit ?</legend>
          <label className="flex min-h-11 items-center gap-2 text-ink">
            <input type="radio" name="import-provider" checked={provider === "EODA"} onChange={() => setProvider("EODA")} disabled={isPending} />
            EODA
          </label>
          <label className="flex min-h-11 items-center gap-2 text-ink">
            <input
              type="radio"
              name="import-provider"
              checked={provider === "STRUCTURE"}
              onChange={() => setProvider("STRUCTURE")}
              disabled={isPending}
            />
            La structure
          </label>
        </fieldset>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="document-import-file">Fichier (.xlsx ou .csv)</Label>
        <input
          id="document-import-file"
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          disabled={isPending}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block text-base text-ink"
        />
      </div>

      {isPending && (
        <p role="status" className="flex items-center gap-2 text-sm text-ink2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Lecture en cours…
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {lines && (
        <div className="space-y-3">
          <div className="relative overflow-x-auto rounded-xl border border-line" role="region" aria-label="Lignes lues dans le fichier" tabIndex={0}>
            <table className="w-full border-collapse text-left text-base">
              <caption className="sr-only">Lignes lues dans le fichier</caption>
              <thead className="bg-soft">
                <tr>
                  <th scope="col" className="px-3 py-2 text-sm font-bold text-ink2">
                    Créer
                  </th>
                  <th scope="col" className="px-3 py-2 text-sm font-bold text-ink2">
                    Intitulé
                  </th>
                  <th scope="col" className="px-3 py-2 text-sm font-bold text-ink2">
                    Critères
                  </th>
                  <th scope="col" className="px-3 py-2 text-sm font-bold text-ink2">
                    État
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${index}-${line.label}`} className="border-t border-line">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Créer « ${line.label} »`}
                        checked={checked.has(index)}
                        disabled={line.status !== "NEW" || isPending}
                        onChange={() => toggle(index)}
                        className="h-5 w-5"
                      />
                    </td>
                    <th scope="row" className="px-3 py-2 font-bold text-ink">
                      {line.label}
                    </th>
                    <td className="px-3 py-2 tabular-nums text-ink">{line.criteria.length > 0 ? line.criteria.join(", ") : "—"}</td>
                    <td className="px-3 py-2 text-sm text-ink">
                      <span className="font-bold">{STATUS_LABELS[line.status]}</span>
                      {line.problem && <span className="block text-ink2">{line.problem}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" size="sm" onClick={create} disabled={isPending || selectedCount === 0}>
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Créer {selectedCount} ligne{selectedCount > 1 ? "s" : ""} pour toutes les structures
          </Button>
        </div>
      )}

      {done && (
        <p role="status" className="flex items-center gap-2 text-sm text-ok-text">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {done}
        </p>
      )}

      <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={isPending}>
        Fermer
      </Button>
    </section>
  );
}
