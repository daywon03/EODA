"use client";

import { useMemo, useState } from "react";
import { importTemplateFile } from "@/lib/actions/template-library";
import {
  MAX_IMPORT_FILES,
  TEMPLATE_STAGES,
  TEMPLATE_STAGE_LABELS,
  markDuplicateLines,
  planFolderImport,
  type FolderImportLine,
} from "@/lib/services/template-library-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, FolderUp, Loader2, Sparkles } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT D'UN DOSSIER
//
// « Il faudrait que l'on puisse mettre des dossiers facilement, et que les fichiers à
// l'intérieur se mettent tout seuls, et que l'on puisse ensuite les réarranger »
// (call du 03/09). L'arborescence existe déjà sur le poste de la consultante ; lui
// demander de créer une fiche puis de publier une version, cinquante fois, revient à
// lui demander de ne pas se servir de la bibliothèque.
//
// EN DEUX TEMPS, et c'est le point important : on PROPOSE un rangement, elle le
// corrige, et c'est seulement ensuite qu'on écrit. Un rangement automatique et
// silencieux se découvre trois semaines plus tard, quand la bibliothèque est déjà
// fausse et que plus personne ne sait ce qui a été deviné.
//
// L'aperçu est calculé DANS LE NAVIGATEUR par les mêmes règles pures que le serveur
// applique : cinquante lignes s'affichent sans aucun aller-retour.
// ─────────────────────────────────────────────────────────────────────────────

type Row = FolderImportLine & { file: File; duplicate: boolean };

type Outcome = { done: number; failures: string[] } | null;

export function FolderImport({ onImported }: { onImported?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const importable = useMemo(() => rows.filter((row) => !row.duplicate), [rows]);
  const isRunning = progress !== null;

  function handlePick(files: FileList | null) {
    setOutcome(null);
    if (!files || files.length === 0) {
      setRows([]);
      setTooMany(false);
      return;
    }

    const picked = Array.from(files)
      // Les dossiers d'un poste sont pleins de fichiers que le système y range tout
      // seul (.DS_Store, Thumbs.db, verrous Office « ~$… »). Les importer remplirait
      // la bibliothèque de lignes que personne n'a créées.
      .filter((file) => !isSystemFile(file.name));

    setTooMany(picked.length > MAX_IMPORT_FILES);

    const kept = picked.slice(0, MAX_IMPORT_FILES);
    const plan = planFolderImport(
      kept.map((file) => ({
        // `webkitRelativePath` est vide quand on choisit des fichiers isolés plutôt
        // qu'un dossier : le nom seul reste une entrée valable.
        relativePath: file.webkitRelativePath || file.name,
        sizeBytes: file.size,
      }))
    );
    const duplicates = markDuplicateLines(plan);

    setRows(
      plan.map((line, index) => ({
        ...line,
        file: kept[index] as File,
        duplicate: duplicates[index] ?? false,
      }))
    );
  }

  function updateRow(index: number, patch: Partial<FolderImportLine>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function runImport() {
    setOutcome(null);
    setProgress(0);
    const failures: string[] = [];
    let done = 0;

    // Séquentiel, jamais en parallèle : cinquante envois simultanés de fichiers de
    // plusieurs mégaoctets saturent la liaison montante et font expirer les premiers.
    // Et deux fichiers du même dossier partis ensemble créeraient deux fois le dossier.
    for (const row of importable) {
      const formData = new FormData();
      formData.set("categoryName", row.categoryName);
      formData.set("title", row.title);
      if (row.stage !== null) formData.set("stage", row.stage);
      if (row.versionLabel !== null) formData.set("versionLabel", row.versionLabel);
      formData.set("file", row.file);

      const result = await importTemplateFile(formData);
      if ("error" in result) failures.push(result.error);
      else done += 1;
      setProgress(done + failures.length);
    }

    setProgress(null);
    setOutcome({ done, failures });
    if (done > 0) {
      setRows([]);
      onImported?.();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="folder">Dossier à importer</Label>
        <Input
          id="folder"
          type="file"
          multiple
          // `webkitdirectory` fait choisir un DOSSIER entier au lieu d'un fichier.
          // L'attribut n'est pas dans les types React ; il est reconnu par tous les
          // navigateurs de bureau, et le champ reste un sélecteur de fichiers normal
          // là où il ne l'est pas — donc jamais d'impasse.
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          disabled={isRunning}
          onChange={(event) => handlePick(event.target.files)}
        />
        <p className="text-xs text-gris-mid">
          Le dossier choisi devient un dossier de la bibliothèque, chaque sous-dossier
          une fiche. Rien n&apos;est enregistré tant que vous n&apos;avez pas relu la
          proposition ci-dessous.
        </p>
      </div>

      {tooMany && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
          Ce dossier contient plus de {MAX_IMPORT_FILES} fichiers. Seuls les{" "}
          {MAX_IMPORT_FILES} premiers sont proposés — importez le reste en une seconde
          fois.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-xs">
              <caption className="sr-only">
                Rangement proposé pour les fichiers du dossier choisi
              </caption>
              <thead>
                <tr className="border-b border-gris-light text-gris-mid">
                  <th scope="col" className="py-2 pr-3 font-medium">Fichier</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Dossier</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Fiche</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Stade</th>
                  <th scope="col" className="py-2 font-medium">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gris-light">
                {rows.map((row, index) => (
                  <tr key={row.relativePath} className={row.duplicate ? "opacity-50" : undefined}>
                    <td className="py-2 pr-3 align-top">
                      <span className="block max-w-[16rem] truncate text-brun-ancre" title={row.relativePath}>
                        {row.file.name}
                      </span>
                      {row.duplicate && (
                        <span className="text-gris-mid">
                          Doublon dans ce dossier — ignoré.
                        </span>
                      )}
                      {/* Une valeur DEVINÉE et une valeur PAR DÉFAUT n'appellent pas
                          la même relecture : la seconde est presque toujours à
                          corriger, la première presque jamais. Les confondre ferait
                          relire les cinquante lignes ou aucune. */}
                      {!row.duplicate && !row.stageDetected && (
                        <span className="flex items-center gap-1 text-gris-mid">
                          <Sparkles className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                          stade à confirmer
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Input
                        aria-label={`Dossier de ${row.file.name}`}
                        value={row.categoryName}
                        maxLength={80}
                        disabled={isRunning || row.duplicate}
                        onChange={(e) => updateRow(index, { categoryName: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Input
                        aria-label={`Fiche de ${row.file.name}`}
                        value={row.title}
                        maxLength={200}
                        disabled={isRunning || row.duplicate}
                        onChange={(e) => updateRow(index, { title: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Select
                        aria-label={`Stade de ${row.file.name}`}
                        value={row.stage ?? "REFERENCE"}
                        disabled={isRunning || row.duplicate}
                        onChange={(e) =>
                          updateRow(index, {
                            stage:
                              e.target.value === "REFERENCE"
                                ? null
                                : (e.target.value as FolderImportLine["stage"]),
                            stageDetected: true,
                          })
                        }
                        className="h-9 text-xs"
                      >
                        {TEMPLATE_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {TEMPLATE_STAGE_LABELS[stage]}
                          </option>
                        ))}
                        {/* Le manuel HAS déposé au milieu d'un dossier de gabarits :
                            il n'a pas de stade, et le dire ici évite d'avoir à
                            ressortir ce fichier de l'import pour le traiter à part. */}
                        <option value="REFERENCE">Document de référence</option>
                      </Select>
                    </td>
                    <td className="py-2 align-top">
                      <Input
                        aria-label={`Version de ${row.file.name}`}
                        value={row.versionLabel ?? ""}
                        maxLength={40}
                        placeholder={row.stage === null ? "édition (facultatif)" : "v1"}
                        disabled={isRunning || row.duplicate}
                        onChange={(e) =>
                          updateRow(index, { versionLabel: e.target.value || null })
                        }
                        className="h-9 w-28 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" size="sm" onClick={() => void runImport()} disabled={isRunning || importable.length === 0}>
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FolderUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isRunning
              ? `Import en cours — ${progress} / ${importable.length}`
              : `Importer ${importable.length} fichier${importable.length > 1 ? "s" : ""}`}
          </Button>
        </>
      )}

      {/* L'issue est annoncée explicitement, succès comme échecs : un import qui se
          termine en silence laisse croire qu'il n'a rien fait, et on le relance. */}
      {outcome && (
        <div role="status" className="space-y-1 text-xs">
          {outcome.done > 0 && (
            <p className="flex items-center gap-1.5 text-vert-ok">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {outcome.done} fichier{outcome.done > 1 ? "s" : ""} rangé
              {outcome.done > 1 ? "s" : ""} dans la bibliothèque.
            </p>
          )}
          {outcome.failures.map((failure) => (
            <p key={failure} className="flex items-start gap-1.5 text-rouge-imp">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {failure}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Fichiers que le système d'exploitation range lui-même dans les dossiers. Ils n'ont
// aucun sens dans une bibliothèque documentaire, et « ~$… » désigne un document Word
// encore ouvert — ce n'est même pas un document, c'est un verrou.
function isSystemFile(name: string): boolean {
  return (
    name.startsWith(".") || name.startsWith("~$") || name === "Thumbs.db" || name === "desktop.ini"
  );
}
