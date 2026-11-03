"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { setDocumentTypeFolder } from "@/lib/actions/document-folder";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

// « Dossier » d'une ligne (call du 29/10/2026) — vaut pour toutes les structures
// (setDocumentTypeFolder, CABINET_ADMIN). Le changement part au choix : pas de
// bouton à oublier.
export function DocumentFolderPicker({
  documentTypeId,
  folderId,
  folders,
}: {
  documentTypeId: string;
  folderId: string | null;
  folders: readonly { id: string; label: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(folderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectId = `document-folder-${documentTypeId}`;

  function choose(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setDocumentTypeFolder(documentTypeId, next);
      if ("error" in result) {
        setValue(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={selectId}>Dossier (pour toutes les structures)</Label>
      <div className="flex items-center gap-2">
        <Select id={selectId} value={value} onChange={(e) => choose(e.target.value)} disabled={isPending} className="w-72">
          <option value="">Aucun — à plat dans la liste</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.label}
            </option>
          ))}
        </Select>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-ink2" aria-label="Enregistrement…" />}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
