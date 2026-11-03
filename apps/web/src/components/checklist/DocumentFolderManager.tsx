"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileSpreadsheet, FolderPlus, Loader2 } from "lucide-react";
import { createDocumentFolder, renameDocumentFolder } from "@/lib/actions/document-folder";
import { DOCUMENT_FOLDER_LABEL_MAX } from "@/lib/services/document-folder-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// L'import ne se charge qu'au clic : il embarque la lecture des .xlsx, et l'onglet
// Documents est la route la plus lourde du cabinet (budget de JavaScript).
const DocumentTypeImportFields = dynamic(
  () => import("./DocumentTypeImportFields").then((module) => module.DocumentTypeImportFields),
  { loading: () => <p className="text-sm text-ink2">Chargement…</p> }
);

type Folder = { id: string; label: string; lineCount: number };

// « Dossiers » et « Importer un tableur » de l'onglet Documents (call du 29/10/2026).
// Réservé à qui gère la liste (CABINET_ADMIN) : les dossiers valent pour toutes les
// structures.
export function DocumentFolderManager({ folders }: { folders: readonly Folder[] }) {
  const [open, setOpen] = useState<"folders" | "import" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === "folders" ? null : "folders")} aria-expanded={open === "folders"}>
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Gérer les dossiers
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === "import" ? null : "import")} aria-expanded={open === "import"}>
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
          Importer un tableur
        </Button>
      </div>
      {open === "folders" && <FolderList folders={folders} onClose={() => setOpen(null)} />}
      {open === "import" && <DocumentTypeImportFields folders={folders} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FolderList({ folders, onClose }: { folders: readonly Folder[]; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string } | { ok: true }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="document-folders-title" className="max-w-xl space-y-4 rounded-xl border border-line bg-card p-4">
      <h3 id="document-folders-title" className="text-base font-bold text-ink">
        Dossiers de la liste
      </h3>
      <p className="text-sm text-ink2">
        Un dossier range des lignes sous un même titre, pour <strong>toutes les structures</strong>. Pour y mettre une
        ligne, ouvrez-la et choisissez son dossier.
      </p>

      <ul className="space-y-2">
        {folders.map((folder) => (
          <li key={folder.id}>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const label = new FormData(event.currentTarget).get("label");
                run(() => renameDocumentFolder(folder.id, label));
              }}
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor={`folder-${folder.id}`}>
                  {folder.lineCount} ligne{folder.lineCount > 1 ? "s" : ""}
                </Label>
                <Input id={`folder-${folder.id}`} name="label" defaultValue={folder.label} maxLength={DOCUMENT_FOLDER_LABEL_MAX} disabled={isPending} />
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                Renommer
              </Button>
            </form>
          </li>
        ))}
      </ul>

      <form
        className="flex flex-wrap items-end gap-2 border-t border-line pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const label = new FormData(formElement).get("label");
          run(() => createDocumentFolder(label), () => formElement.reset());
        }}
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-document-folder">Nouveau dossier</Label>
          <Input id="new-document-folder" name="label" required maxLength={DOCUMENT_FOLDER_LABEL_MAX} disabled={isPending} placeholder="Par exemple : Process de la structure" />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />}
          Créer le dossier
        </Button>
      </form>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={isPending}>
        Fermer
      </Button>
    </section>
  );
}
